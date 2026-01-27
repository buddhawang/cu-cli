/**
 * Analyze command handler.
 * Implements: cu analyze <file-or-url> --analyzer <id>
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { getContentUnderstandingClient } from '../services/content-understanding.js';
import { createTableFormatter } from '../services/formatters/table.js';
import { renderOverlay, renderPdfOverlayAllPages, getOverlaySummary } from '../services/formatters/overlay.js';
import { createSpinner } from '../lib/progress.js';
import { validateFilePath, validateUrl, validateSupportedFileType } from '../lib/validation.js';
import { CliError, ErrorCodes } from '../lib/errors.js';
import type {
  AnalysisResult,
  ExtractedField,
} from '../models/analysis-result.js';

/**
 * Supported output formats.
 */
type OutputFormat = 'json' | 'table' | 'overlay';

/**
 * Image formats supported by sharp for overlay rendering.
 */
const OVERLAY_SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.gif', '.webp', '.pdf']);

/**
 * MIME type mapping for supported file extensions.
 */
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.bmp': 'image/bmp',
  '.heif': 'image/heif',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.html': 'text/html',
};

/**
 * Row format for fields table.
 */
interface FieldRow {
  name: string;
  type: string;
  value: string;
  confidence: string;
}

/**
 * Detects MIME type from file extension.
 */
function detectMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Formats a field value for display.
 */
function formatFieldValue(field: ExtractedField): string {
  if (field.valueString !== undefined) {
    return field.valueString.length > 50
      ? field.valueString.substring(0, 47) + '...'
      : field.valueString;
  }
  if (field.valueNumber !== undefined) {
    return String(field.valueNumber);
  }
  if (field.valueBoolean !== undefined) {
    return field.valueBoolean ? 'true' : 'false';
  }
  if (field.valueArray !== undefined) {
    return `[${field.valueArray.length} items]`;
  }
  if (field.valueObject !== undefined) {
    return `{${Object.keys(field.valueObject).length} fields}`;
  }
  return '-';
}

/**
 * Formats confidence as percentage.
 */
function formatConfidence(confidence: number | undefined): string {
  if (confidence === undefined) {
    return '-';
  }
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Checks if input is a URL.
 */
function isUrl(input: string): boolean {
  return input.startsWith('http://') || input.startsWith('https://');
}

/**
 * Handles CLI errors and exits with appropriate code.
 */
function handleError(error: unknown): never {
  if (error instanceof CliError) {
    process.stderr.write(error.format() + '\n');
    process.exit(error.exitCode);
  }

  // Unknown error
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(7);
}

/**
 * Displays analysis result in table format.
 */
function displayTableResult(result: AnalysisResult): void {
  process.stdout.write(`\nAnalysis Complete\n`);
  process.stdout.write(`─────────────────\n`);
  process.stdout.write(`Analyzer:  ${result.analyzerId}\n`);
  process.stdout.write(`Status:    ${result.status}\n`);

  if (result.usage?.documentPagesStandard !== undefined) {
    process.stdout.write(`Pages:     ${result.usage.documentPagesStandard}\n`);
  }

  for (const content of result.contents ?? []) {
    process.stdout.write(`\n`);

    if (content.startPageNumber !== undefined && content.endPageNumber !== undefined) {
      process.stdout.write(`Content (pages ${content.startPageNumber}-${content.endPageNumber})\n`);
    } else {
      process.stdout.write(`Content\n`);
    }
    process.stdout.write(`Type: ${content.kind} (${content.mimeType})\n`);

    // Display fields as table
    const fieldEntries = Object.entries(content.fields);
    if (fieldEntries.length > 0) {
      process.stdout.write(`\nExtracted Fields:\n`);

      const tableFormatter = createTableFormatter<FieldRow>({
        columns: [
          { accessor: 'name', header: 'FIELD', width: 24 },
          { accessor: 'type', header: 'TYPE', width: 10 },
          { accessor: 'value', header: 'VALUE', width: 40 },
          { accessor: 'confidence', header: 'CONF', width: 6, align: 'right' },
        ],
      });

      const rows: FieldRow[] = fieldEntries.map(([name, field]) => ({
        name,
        type: field.type,
        value: formatFieldValue(field),
        confidence: formatConfidence(field.confidence),
      }));

      process.stdout.write(tableFormatter.format(rows) + '\n');
    } else {
      process.stdout.write(`\nNo fields extracted.\n`);
    }

    // Display table count
    if (content.tables !== undefined && content.tables.length > 0) {
      process.stdout.write(`\nTables: ${content.tables.length} detected\n`);
    }

    // Display figure count
    if (content.figures !== undefined && content.figures.length > 0) {
      process.stdout.write(`Figures: ${content.figures.length} detected\n`);
    }
  }

  // Display warnings
  if (result.warnings.length > 0) {
    process.stdout.write(`\nWarnings:\n`);
    for (const warning of result.warnings) {
      process.stdout.write(`  ⚠ ${warning.code}: ${warning.message}\n`);
    }
  }
}

/**
 * Prompts user for confirmation.
 */
async function confirmOverwrite(filePath: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`File "${filePath}" already exists. Overwrite? [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Creates the analyze command.
 * Analyzes a document using the specified analyzer.
 */
export function createAnalyzeCommand(): Command {
  const command = new Command('analyze')
    .description('Analyze a document using Azure Content Understanding')
    .argument('<source>', 'File path or URL to analyze')
    .requiredOption('-a, --analyzer <id>', 'Analyzer ID to use (e.g., prebuilt-document)')
    .option('-r, --range <pages>', 'Page range to analyze (e.g., "1-3")')
    .option('-t, --timeout <seconds>', 'Maximum wait time in seconds', '300')
    .option('-f, --format <format>', 'Output format: json, table, overlay', 'table')
    .option('-o, --output <file>', 'Write output to file (required for overlay format)')
    .option('--force', 'Overwrite output file without confirmation')
    .option('--dpi <number>', 'DPI for PDF rendering in overlay mode (default: 150)', '150')
    .option('--page <number>', 'Specific page to render for PDF overlay (default: all pages)')
    .action(async (source: string, options: {
      analyzer: string;
      range?: string;
      timeout?: string;
      format?: string;
      output?: string;
      force?: boolean;
      dpi?: string;
      page?: string;
    }) => {
      const parent = command.parent;
      const globalOpts = parent?.opts<{ json?: boolean; verbose?: boolean }>() ?? {};

      // Determine output format
      let format: OutputFormat = 'table';
      if (globalOpts.json === true) {
        format = 'json';
      } else if (options.format !== undefined) {
        const validFormats: OutputFormat[] = ['json', 'table', 'overlay'];
        if (validFormats.includes(options.format as OutputFormat)) {
          format = options.format as OutputFormat;
        } else {
          throw new CliError(
            ErrorCodes.CONFIG_INVALID,
            'Invalid format',
            `Unknown format: ${options.format}`,
            'Use one of: json, table, overlay'
          );
        }
      }

      // Overlay format requires --output
      if (format === 'overlay' && options.output === undefined) {
        throw new CliError(
          ErrorCodes.CONFIG_INVALID,
          'Output file required',
          'The overlay format requires an output file',
          'Specify output file: --output result.png'
        );
      }

      // Overlay format requires a local file, not a URL
      if (format === 'overlay' && isUrl(source)) {
        throw new CliError(
          ErrorCodes.UNSUPPORTED_FILE_TYPE,
          'Overlay not supported for URLs',
          'The overlay format requires a local image file as source',
          'Download the file first, then use: cu analyze ./local-file.png --format overlay --output result.png'
        );
      }

      // Overlay format requires an image file (not PDF, docx, etc.)
      if (format === 'overlay' && !isUrl(source)) {
        const ext = path.extname(source).toLowerCase();
        if (!OVERLAY_SUPPORTED_EXTENSIONS.has(ext)) {
          throw new CliError(
            ErrorCodes.UNSUPPORTED_FILE_TYPE,
            'Overlay not supported for this file type',
            `The overlay format requires an image file, but got: ${ext || 'unknown'}`,
            'Use --format json or --format table for non-image files, or convert the document to an image first'
          );
        }
      }

      // Check if output file exists and prompt for confirmation
      if (options.output !== undefined && fs.existsSync(options.output) && options.force !== true) {
        const confirmed = await confirmOverwrite(options.output);
        if (!confirmed) {
          process.stderr.write('Operation cancelled.\n');
          process.exit(0);
        }
      }

      const spinner = createSpinner();
      const timeoutMs = parseInt(options.timeout ?? '300', 10) * 1000;

      try {
        const client = getContentUnderstandingClient();
        let result: AnalysisResult;
        let rawResult: unknown = undefined; // For raw JSON output

        if (isUrl(source)) {
          // URL-based analysis
          const urlValidation = validateUrl(source);
          if (!urlValidation.valid) {
            throw new CliError(
              ErrorCodes.INVALID_URL,
              'Invalid URL',
              urlValidation.error ?? 'The provided URL is not valid',
              'Provide a valid HTTP or HTTPS URL'
            );
          }

          spinner.start(`Submitting URL for analysis...`);

          const input: { url: string; range?: string } = { url: source };
          if (options.range !== undefined) {
            input.range = options.range;
          }

          const operation = await client.submitAnalysis(options.analyzer, {
            inputs: [input],
          });

          spinner.update('Waiting for analysis to complete...');

          if (format === 'json') {
            // For JSON format, get raw API response
            rawResult = await client.pollForResultRaw(operation, {
              maxWaitMs: timeoutMs,
              onProgress: (status) => {
                if (globalOpts.verbose === true) {
                  spinner.update(`Analysis status: ${status}`);
                }
              },
            });
            // Also get parsed result for internal use if needed
            result = await client.getAnalysisResult(operation.operationId);
          } else {
            result = await client.pollForResult(operation, {
              maxWaitMs: timeoutMs,
              onProgress: (status) => {
                if (globalOpts.verbose === true) {
                  spinner.update(`Analysis status: ${status}`);
                }
              },
            });
          }

          spinner.succeed('Analysis complete');
        } else {
          // File-based analysis
          const fileValidation = validateFilePath(source);
          if (!fileValidation.valid) {
            throw new CliError(
              ErrorCodes.FILE_NOT_FOUND,
              'File not found',
              fileValidation.error ?? `File not found: ${source}`,
              'Check the file path and try again'
            );
          }

          const absolutePath = fileValidation.normalizedValue ?? source;
          const typeValidation = validateSupportedFileType(absolutePath);
          if (!typeValidation.valid) {
            throw new CliError(
              ErrorCodes.UNSUPPORTED_FILE_TYPE,
              'Unsupported file type',
              typeValidation.error ?? 'The file type is not supported',
              'Use a supported file format: PDF, PNG, JPG, TIFF, BMP, DOCX, XLSX, PPTX, HTML'
            );
          }

          const mimeType = detectMimeType(absolutePath);
          const content = fs.readFileSync(absolutePath);

          spinner.start(`Uploading ${path.basename(absolutePath)}...`);

          const operation = await client.submitBinaryAnalysis(
            options.analyzer,
            content,
            mimeType
          );

          spinner.update('Waiting for analysis to complete...');

          if (format === 'json') {
            // For JSON format, get raw API response
            rawResult = await client.pollForResultRaw(operation, {
              maxWaitMs: timeoutMs,
              onProgress: (status) => {
                if (globalOpts.verbose === true) {
                  spinner.update(`Analysis status: ${status}`);
                }
              },
            });
            // Also get parsed result for internal use if needed
            result = await client.getAnalysisResult(operation.operationId);
          } else {
            result = await client.pollForResult(operation, {
              maxWaitMs: timeoutMs,
              onProgress: (status) => {
                if (globalOpts.verbose === true) {
                  spinner.update(`Analysis status: ${status}`);
                }
              },
            });
          }

          spinner.succeed('Analysis complete');
        }

        // Output result based on format
        switch (format) {
          case 'json': {
            // Output raw API response directly (no transformation)
            const jsonOutput = JSON.stringify(rawResult, null, 2) + '\n';
            if (options.output !== undefined) {
              fs.writeFileSync(options.output, jsonOutput);
              process.stdout.write(`Output written to: ${options.output}\n`);
            } else {
              process.stdout.write(jsonOutput);
            }
            break;
          }

          case 'overlay': {
            // Overlay requires the source to be an image or PDF file
            if (isUrl(source)) {
              throw new CliError(
                ErrorCodes.UNSUPPORTED_FILE_TYPE,
                'Overlay not supported for URLs',
                'The overlay format requires a local image file as source',
                'Download the file first, then use: cu analyze ./local-file.png --format overlay --output result.png'
              );
            }

            const absolutePath = path.resolve(source);
            const ext = path.extname(absolutePath).toLowerCase();
            const isPdf = ext === '.pdf';
            const dpi = parseInt(options.dpi ?? '150', 10);
            const pageNum = options.page !== undefined ? parseInt(options.page, 10) : undefined;

            spinner.start('Rendering overlay...');

            try {
              if (isPdf && pageNum === undefined) {
                // Multi-page PDF: render all pages
                const pdfResult = await renderPdfOverlayAllPages(absolutePath, result, { dpi });
                
                if (pdfResult.totalPages === 1) {
                  // Single page PDF - write directly to output
                  const page = pdfResult.pages[0];
                  if (page !== undefined) {
                    fs.writeFileSync(options.output!, page.buffer);
                    spinner.succeed(`Overlay written to: ${options.output} (${page.boxCount} bounding boxes)`);
                  }
                } else {
                  // Multi-page PDF - generate numbered output files
                  const outputBase = options.output!;
                  const outputExt = path.extname(outputBase);
                  const outputName = outputBase.slice(0, -outputExt.length);
                  
                  let totalBoxes = 0;
                  for (const page of pdfResult.pages) {
                    const pageOutput = `${outputName}-${page.pageNumber}${outputExt}`;
                    fs.writeFileSync(pageOutput, page.buffer);
                    totalBoxes += page.boxCount;
                  }
                  spinner.succeed(`Overlay written to ${pdfResult.totalPages} files: ${outputName}-1${outputExt} to ${outputName}-${pdfResult.totalPages}${outputExt} (${totalBoxes} total bounding boxes)`);
                }
              } else {
                // Single page (image or specific PDF page)
                const overlayOpts: { dpi: number; pageNumber?: number } = { dpi };
                if (pageNum !== undefined) {
                  overlayOpts.pageNumber = pageNum;
                }
                const overlayResult = await renderOverlay(absolutePath, result, overlayOpts);
                fs.writeFileSync(options.output!, overlayResult.buffer);
                spinner.succeed(`Overlay written to: ${options.output} (${overlayResult.boxCount} bounding boxes)`);
              }
            } catch (overlayError) {
              spinner.fail('Failed to render overlay');
              if (overlayError instanceof CliError) {
                throw overlayError;
              }
              // Fallback: show summary instead
              process.stdout.write(getOverlaySummary(result) + '\n');
              throw new CliError(
                ErrorCodes.API_ERROR,
                'Overlay rendering failed',
                overlayError instanceof Error ? overlayError.message : String(overlayError),
                'Ensure sharp is installed: npm install sharp'
              );
            }
            break;
          }

          case 'table':
          default: {
            if (options.output !== undefined) {
              // Capture table output to file
              const originalWrite = process.stdout.write.bind(process.stdout);
              let tableOutput = '';
              process.stdout.write = (chunk: string | Uint8Array): boolean => {
                tableOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
                return true;
              };
              displayTableResult(result);
              process.stdout.write = originalWrite;
              fs.writeFileSync(options.output, tableOutput);
              process.stdout.write(`Output written to: ${options.output}\n`);
            } else {
              displayTableResult(result);
            }
            break;
          }
        }
      } catch (error) {
        spinner.fail('Analysis failed');
        handleError(error);
      }
    });

  return command;
}

/**
 * Registers analyze commands with the program.
 */
export function registerAnalyzeCommands(program: Command): void {
  program.addCommand(createAnalyzeCommand());
}
