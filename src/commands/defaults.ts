/**
 * Defaults command handlers.
 * Implements: cu defaults list/set/remove
 * 
 * Manages model deployment mappings for Azure Content Understanding.
 * These mappings configure which Azure OpenAI deployments to use for each model.
 */

import { Command } from 'commander';
import * as readline from 'node:readline';
import { getDefaultsManager } from '../services/defaults-manager.js';
import { createJsonFormatter } from '../services/formatters/json.js';
import { CliError } from '../lib/errors.js';

/**
 * JSON output format for defaults list.
 */
interface DefaultsListJsonOutput {
  modelDeployments: Record<string, string>;
}

/**
 * JSON output format for defaults set/remove.
 */
interface DefaultsUpdateJsonOutput {
  modelDeployments: Record<string, string>;
}

/**
 * Prompts for confirmation before removing a mapping.
 */
async function confirmRemove(modelName: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `Are you sure you want to remove the mapping for model '${modelName}'? [y/N] `,
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      }
    );
  });
}

/**
 * Creates the defaults list command.
 */
export function createDefaultsListCommand(): Command {
  const cmd = new Command('list')
    .description('List all model deployment mappings')
    .action(async () => {
      const parent = cmd.parent?.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      try {
        const manager = getDefaultsManager();
        const result = await manager.getDefaults();

        if (globalOpts.json === true) {
          const jsonFormatter = createJsonFormatter<DefaultsListJsonOutput>();
          process.stdout.write(jsonFormatter.format(result) + '\n');
        } else {
          const entries = Object.entries(result.modelDeployments);
          
          if (entries.length === 0) {
            process.stdout.write('No model deployment mappings configured.\n');
            process.stdout.write('\nTo add a mapping, run:\n');
            process.stdout.write('  cu defaults set --model <model-name> --deployment <deployment-name>\n');
          } else {
            process.stdout.write('\nModel Deployment Mappings\n');
            process.stdout.write('─────────────────────────\n');

            // Calculate column widths
            const modelWidth = Math.max(5, ...entries.map(([m]) => m.length));
            const deploymentWidth = Math.max(10, ...entries.map(([, d]) => d.length));

            // Header
            process.stdout.write(
              `${'Model'.padEnd(modelWidth)}  ${'Deployment'}\n`
            );
            process.stdout.write(
              `${'─'.repeat(modelWidth)}  ${'─'.repeat(deploymentWidth)}\n`
            );

            for (const [model, deployment] of entries) {
              process.stdout.write(`${model.padEnd(modelWidth)}  ${deployment}\n`);
            }
            process.stdout.write('\n');
          }
        }
      } catch (error) {
        if (error instanceof CliError) {
          process.stderr.write(`Error: ${error.message}\nWhy: ${error.why}\nFix: ${error.fix}\n`);
          process.exit(error.exitCode);
        }
        throw error;
      }
    });

  return cmd;
}

/**
 * Creates the defaults set command.
 */
export function createDefaultsSetCommand(): Command {
  interface SetOptions {
    model: string;
    deployment: string;
  }

  const cmd = new Command('set')
    .description('Set a model deployment mapping')
    .requiredOption('--model <name>', 'Model name (e.g., gpt-4.1, text-embedding-3-large)')
    .requiredOption('--deployment <name>', 'Deployment name in your Azure OpenAI resource')
    .action(async (options: SetOptions) => {
      const parent = cmd.parent?.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      try {
        const manager = getDefaultsManager();
        const result = await manager.setModelDeployment(options.model, options.deployment);

        if (globalOpts.json === true) {
          const jsonFormatter = createJsonFormatter<DefaultsUpdateJsonOutput>();
          process.stdout.write(jsonFormatter.format(result) + '\n');
        } else {
          process.stdout.write(`✓ Set '${options.model}' → '${options.deployment}'\n`);
        }
      } catch (error) {
        if (error instanceof CliError) {
          process.stderr.write(`Error: ${error.message}\nWhy: ${error.why}\nFix: ${error.fix}\n`);
          process.exit(error.exitCode);
        }
        throw error;
      }
    });

  return cmd;
}

/**
 * Creates the defaults remove command.
 */
export function createDefaultsRemoveCommand(): Command {
  interface RemoveOptions {
    force?: boolean;
  }

  const cmd = new Command('remove')
    .description('Remove a model deployment mapping')
    .argument('<model>', 'Model name to remove mapping for')
    .option('--force', 'Skip confirmation prompt')
    .action(async (model: string, options: RemoveOptions) => {
      const parent = cmd.parent?.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      try {
        // Confirm unless --force is specified
        if (options.force !== true) {
          const confirmed = await confirmRemove(model);
          if (!confirmed) {
            process.stdout.write('Operation cancelled.\n');
            return;
          }
        }

        const manager = getDefaultsManager();
        const result = await manager.removeModelDeployment(model);

        if (globalOpts.json === true) {
          const jsonFormatter = createJsonFormatter<DefaultsUpdateJsonOutput & { removed: string }>();
          process.stdout.write(
            jsonFormatter.format({
              removed: model,
              modelDeployments: result.modelDeployments,
            }) + '\n'
          );
        } else {
          process.stdout.write(`✓ Removed mapping for '${model}'\n`);
        }
      } catch (error) {
        if (error instanceof CliError) {
          process.stderr.write(`Error: ${error.message}\nWhy: ${error.why}\nFix: ${error.fix}\n`);
          process.exit(error.exitCode);
        }
        throw error;
      }
    });

  return cmd;
}

/**
 * Creates the defaults command group.
 */
export function createDefaultsCommand(): Command {
  const cmd = new Command('defaults')
    .description('Manage model deployment mappings');

  cmd.addCommand(createDefaultsListCommand());
  cmd.addCommand(createDefaultsSetCommand());
  cmd.addCommand(createDefaultsRemoveCommand());

  return cmd;
}

/**
 * Registers all defaults commands with the program.
 */
export function registerDefaultsCommands(program: Command): void {
  program.addCommand(createDefaultsCommand());
}
