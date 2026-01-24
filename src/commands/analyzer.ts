/**
 * Analyzer command handlers.
 * Implements: cu analyzer list, cu analyzer show
 */

import { Command } from 'commander';
import { getContentUnderstandingClient } from '../services/content-understanding.js';
import { createJsonFormatter } from '../services/formatters/json.js';
import { createTableFormatter } from '../services/formatters/table.js';
import type { Analyzer } from '../models/analyzer.js';
import { CliError } from '../lib/errors.js';

/**
 * Output format for analyzer list in JSON.
 */
interface AnalyzerListOutput {
  analyzers: Array<{
    id: string;
    status: string;
    description?: string;
    createdAt: string;
    supportedContentKinds?: string[];
  }>;
}

/**
 * Output format for analyzer show in JSON.
 */
interface AnalyzerShowOutput {
  id: string;
  status: string;
  description?: string;
  createdAt: string;
  modifiedAt: string;
  baseAnalyzerId?: string;
  supportedContentKinds?: string[];
  fieldSchema?: {
    name: string;
    fields: Record<string, {
      type: string;
      method: string;
      description?: string;
      enum?: string[];
    }>;
  };
}

/**
 * Row format for analyzer list table.
 */
interface AnalyzerListRow {
  id: string;
  status: string;
  description: string;
  created: string;
}

/**
 * Row format for analyzer fields table.
 */
interface AnalyzerFieldRow {
  name: string;
  type: string;
  method: string;
  description: string;
}

/**
 * Formats a Date object as YYYY-MM-DD.
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

/**
 * Formats a Date object as YYYY-MM-DD HH:mm:ss.
 */
function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
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
 * Creates the analyzer list command.
 * Lists all analyzers in the configured resource.
 */
function createAnalyzerListCommand(): Command {
  const command = new Command('list')
    .description('List all analyzers in the configured resource')
    .action(async () => {
      const parent = command.parent?.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      try {
        const client = getContentUnderstandingClient();
        const result = await client.listAnalyzers();

        if (globalOpts.json === true) {
          const jsonFormatter = createJsonFormatter<AnalyzerListOutput>();
          const output: AnalyzerListOutput = {
            analyzers: result.value.map(analyzer => ({
              id: analyzer.id,
              status: analyzer.status,
              ...(analyzer.description !== undefined && { description: analyzer.description }),
              createdAt: analyzer.createdAt.toISOString(),
              ...(analyzer.supportedContentKinds !== undefined && { supportedContentKinds: analyzer.supportedContentKinds }),
            })),
          };
          process.stdout.write(jsonFormatter.format(output) + '\n');
        } else {
          if (result.value.length === 0) {
            process.stdout.write('No analyzers found.\n');
            return;
          }

          const tableFormatter = createTableFormatter<AnalyzerListRow>({
            columns: [
              { accessor: 'id', header: 'ID', width: 24 },
              { accessor: 'status', header: 'STATUS', width: 10 },
              { accessor: 'description', header: 'DESCRIPTION', width: 30 },
              { accessor: 'created', header: 'CREATED', width: 12 },
            ],
          });

          const rows: AnalyzerListRow[] = result.value.map(analyzer => ({
            id: analyzer.id,
            status: analyzer.status,
            description: analyzer.description ?? '',
            created: formatDate(analyzer.createdAt),
          }));

          process.stdout.write(tableFormatter.format(rows) + '\n');
        }
      } catch (error) {
        handleError(error);
      }
    });

  return command;
}

/**
 * Creates the analyzer show command.
 * Displays details of a specific analyzer.
 */
function createAnalyzerShowCommand(): Command {
  const command = new Command('show')
    .description('Display details of a specific analyzer')
    .argument('<analyzer-id>', 'Analyzer identifier')
    .action(async (analyzerId: string) => {
      const parent = command.parent?.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      try {
        const client = getContentUnderstandingClient();
        const analyzer = await client.getAnalyzer(analyzerId);

        if (globalOpts.json === true) {
          const jsonFormatter = createJsonFormatter<AnalyzerShowOutput>();
          const output: AnalyzerShowOutput = {
            id: analyzer.id,
            status: analyzer.status,
            ...(analyzer.description !== undefined && { description: analyzer.description }),
            createdAt: analyzer.createdAt.toISOString(),
            modifiedAt: analyzer.modifiedAt.toISOString(),
            ...(analyzer.baseAnalyzerId !== undefined && { baseAnalyzerId: analyzer.baseAnalyzerId }),
            ...(analyzer.supportedContentKinds !== undefined && { supportedContentKinds: analyzer.supportedContentKinds }),
          };

          if (analyzer.fieldSchema !== undefined) {
            output.fieldSchema = {
              name: analyzer.fieldSchema.name,
              fields: {},
            };
            for (const [fieldName, field] of Object.entries(analyzer.fieldSchema.fields)) {
              output.fieldSchema.fields[fieldName] = {
                type: field.type,
                method: field.method,
                ...(field.description !== undefined && { description: field.description }),
                ...(field.enum !== undefined && { enum: field.enum }),
              };
            }
          }

          process.stdout.write(jsonFormatter.format(output) + '\n');
        } else {
          // Format human-readable output
          formatAnalyzerDetails(analyzer);
        }
      } catch (error) {
        handleError(error);
      }
    });

  return command;
}

/**
 * Formats analyzer details for human-readable output.
 */
function formatAnalyzerDetails(analyzer: Analyzer): void {
  process.stdout.write(`Analyzer: ${analyzer.id}\n\n`);
  process.stdout.write(`Status:       ${analyzer.status}\n`);
  
  if (analyzer.description !== undefined) {
    process.stdout.write(`Description:  ${analyzer.description}\n`);
  }
  
  process.stdout.write(`Created:      ${formatDateTime(analyzer.createdAt)}\n`);
  process.stdout.write(`Modified:     ${formatDateTime(analyzer.modifiedAt)}\n`);
  
  if (analyzer.baseAnalyzerId !== undefined) {
    process.stdout.write(`Base:         ${analyzer.baseAnalyzerId}\n`);
  }

  // Supported content types
  if (analyzer.supportedContentKinds !== undefined && analyzer.supportedContentKinds.length > 0) {
    process.stdout.write(`\nSupported Content Types:\n`);
    for (const kind of analyzer.supportedContentKinds) {
      process.stdout.write(`  • ${kind}\n`);
    }
  }

  // Field schema
  if (analyzer.fieldSchema !== undefined && Object.keys(analyzer.fieldSchema.fields).length > 0) {
    process.stdout.write(`\nFields:\n`);
    
    const tableFormatter = createTableFormatter<AnalyzerFieldRow>({
      columns: [
        { accessor: 'name', header: 'NAME', width: 18 },
        { accessor: 'type', header: 'TYPE', width: 10 },
        { accessor: 'method', header: 'METHOD', width: 10 },
        { accessor: 'description', header: 'DESCRIPTION', width: 30 },
      ],
    });

    const rows: AnalyzerFieldRow[] = [];
    for (const [name, field] of Object.entries(analyzer.fieldSchema.fields)) {
      rows.push({
        name,
        type: field.type,
        method: field.method,
        description: field.description ?? '',
      });
    }

    // Add indentation to each line of the table
    const tableOutput = tableFormatter.format(rows);
    const indentedOutput = tableOutput.split('\n').map(line => '  ' + line).join('\n');
    process.stdout.write(indentedOutput + '\n');
  }
}

/**
 * Registers analyzer commands with the CLI program.
 * @param program - Commander program instance
 */
export function registerAnalyzerCommands(program: Command): void {
  const analyzerCommand = new Command('analyzer')
    .description('Manage analyzers');

  analyzerCommand.addCommand(createAnalyzerListCommand());
  analyzerCommand.addCommand(createAnalyzerShowCommand());

  program.addCommand(analyzerCommand);
}
