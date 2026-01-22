/**
 * cu-cli - Azure Content Understanding CLI
 *
 * Entry point for the CLI application.
 * Lazy loads heavy dependencies for <200ms startup time.
 */

import { Command } from 'commander';

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

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}

// Declare version constant (injected by esbuild)
declare const __VERSION__: string;
