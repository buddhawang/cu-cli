/**
 * cu-cli - Azure Content Understanding CLI
 *
 * Entry point for the CLI application.
 * Lazy loads heavy dependencies for <200ms startup time.
 */

import { Command } from 'commander';
import { CliError } from './lib/errors.js';
import { registerLoginCommands } from './commands/login.js';
import { registerConfigCommands } from './commands/config.js';

// Declare version constant (injected by esbuild)
declare const __VERSION__: string;

const program = new Command();

program
  .name('cu')
  .description('Azure Content Understanding CLI - analyze documents, discover analyzers, manage models')
  .version(__VERSION__, '-v, --version', 'Display CLI version');

// Global options
program
  .option('--json', 'Output in JSON format')
  .option('--profile <name>', 'Use specific configuration profile')
  .option('--verbose', 'Enable verbose output');

// Register command groups
registerLoginCommands(program);
registerConfigCommands(program);

/**
 * Handles CLI errors with proper formatting and exit codes.
 */
function handleError(error: unknown): void {
  if (error instanceof CliError) {
    const opts = program.opts<{ json?: boolean }>();
    if (opts.json === true) {
      // JSON output for script consumption
      process.stdout.write(JSON.stringify({ error: error.toJSON() }, null, 2) + '\n');
    } else {
      // Human-friendly output
      process.stderr.write(error.format() + '\n');
    }
    process.exit(error.exitCode);
  } else if (error instanceof Error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  } else {
    process.stderr.write('An unknown error occurred\n');
    process.exit(1);
  }
}

// Global error handling
process.on('uncaughtException', handleError);
process.on('unhandledRejection', handleError);

// Parse and execute
try {
  program.parse(process.argv);
} catch (error) {
  handleError(error);
}

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}
