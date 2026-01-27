/**
 * Analyze command handler.
 * Implements: cu analyze <file-or-url> --analyzer <id>
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getContentUnderstandingClient } from '../services/content-understanding.js';
import { createJsonFormatter } from '../services/formatters/json.js';
import { createTableFormatter } from '../services/formatters/table.js';
import { createSpinner } from '../lib/progress.js';
import { validateFilePath, validateUrl, validateSupportedFileType } from '../lib/validation.js';
import { CliError, ErrorCodes } from '../lib/errors.js';
import type {
  AnalysisResult,
  ExtractedField,
  AnalyzedContent,
} from '../models/analysis-result.js';

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
 * Output format for JSON.
 */
interface AnalyzeJsonOutput {
  operationId: string;
  status: string;
  analyzerId: string;
  createdAt: string;
  contents: Array<{
    kind: string;
    mimeType: string;
    markdown?: string;
    pageRange?: string;
    fields: Record<string, {
      type: string;
      value: string | number | boolean | null;
      confidence?: number;
    }>;
    tableCount?: number;
    figureCount?: number;
  }>;
  usage?: {
    documentPagesStandard?: number;
    tokens?: Record<string, number>;
  };
  warnings: Array<{ code: string; message: string }>;
}

/**
 * Converts analysis result to JSON output format.
 */
function toJsonOutput(result: AnalysisResult): AnalyzeJsonOutput {
  return {
    operationId: result.id,
    status: result.status,
    analyzerId: result.analyzerId,
    createdAt: result.createdAt.toISOString(),
    contents: (result.contents ?? []).map(content => ({
      kind: content.kind,
      mimeType: content.mimeType,
      markdown: content.markdown,
      pageRange: content.startPageNumber !== undefined && content.endPageNumber !== undefined
        ? `${content.startPageNumber}-${content.endPageNumber}`
        : undefined,
      fields: Object.fromEntries(
        Object.entries(content.fields).map(([name, field]) => [
          name,
          {
            type: field.type,
            value: field.valueString ?? field.valueNumber ?? field.valueBoolean ?? null,
            confidence: field.confidence,
          },
        ])
      ),
      tableCount: content.tables?.length,
      figureCount: content.figures?.length,
    })),
    usage: result.usage,
    warnings: result.warnings,
  };
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
    .action(async (source: string, options: {
      analyzer: string;
      range?: string;
      timeout?: string;
    }) => {
      const parent = command.parent;
      const globalOpts = parent?.opts<{ json?: boolean; verbose?: boolean }>() ?? {};

      const spinner = createSpinner();
      const timeoutMs = parseInt(options.timeout ?? '300', 10) * 1000;

      try {
        const client = getContentUnderstandingClient();
        let result: AnalysisResult;

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

          const operation = await client.submitAnalysis(options.analyzer, {
            inputs: [{
              url: source,
              range: options.range,
            }],
          });

          spinner.update('Waiting for analysis to complete...');

          result = await client.pollForResult(operation, {
            maxWaitMs: timeoutMs,
            onProgress: (status) => {
              if (globalOpts.verbose === true) {
                spinner.update(`Analysis status: ${status}`);
              }
            },
          });

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

          result = await client.pollForResult(operation, {
            maxWaitMs: timeoutMs,
            onProgress: (status) => {
              if (globalOpts.verbose === true) {
                spinner.update(`Analysis status: ${status}`);
              }
            },
          });

          spinner.succeed('Analysis complete');
        }

        // Output result
        if (globalOpts.json === true) {
          const jsonFormatter = createJsonFormatter<AnalyzeJsonOutput>();
          process.stdout.write(jsonFormatter.format(toJsonOutput(result)) + '\n');
        } else {
          displayTableResult(result);
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
