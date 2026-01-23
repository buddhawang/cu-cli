/**
 * Configuration command handlers.
 * Implements: cu config set, cu config show, cu config list, cu config use
 */

import { Command } from 'commander';
import { getConfigService } from '../services/config.js';
import { createJsonFormatter } from '../services/formatters/json.js';
import { createTableFormatter } from '../services/formatters/table.js';
import { type ConfigProfile, DEFAULT_PROFILE_NAME } from '../models/config.js';

/**
 * Output for config show in JSON format.
 */
interface ConfigShowOutput {
  activeProfile: string;
  profile: ConfigProfile;
}

/**
 * Output for config list in JSON format.
 */
interface ConfigListOutput {
  activeProfile: string;
  profiles: Array<{
    name: string;
    endpoint: string;
    isActive: boolean;
  }>;
}

/**
 * Creates the config set command.
 * Sets configuration values for a profile.
 */
function createConfigSetCommand(): Command {
  const command = new Command('set')
    .description('Set configuration values')
    .requiredOption('--endpoint <url>', 'Azure CU resource endpoint (required)')
    .option('-n, --name <name>', 'Profile name to create/update', DEFAULT_PROFILE_NAME)
    .option('--subscription <id>', 'Azure subscription ID')
    .option('--resource-group <name>', 'Resource group name')
    .option('--resource-name <name>', 'Resource name')
    .action((options: {
      endpoint: string;
      name: string;
      subscription?: string;
      resourceGroup?: string;
      resourceName?: string;
    }) => {
      const parent = command.parent?.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      const configService = getConfigService();
      
      const profile: ConfigProfile = {
        endpoint: options.endpoint,
      };
      
      if (options.subscription !== undefined) {
        profile.subscriptionId = options.subscription;
      }
      if (options.resourceGroup !== undefined) {
        profile.resourceGroup = options.resourceGroup;
      }
      if (options.resourceName !== undefined) {
        profile.resourceName = options.resourceName;
      }

      configService.setProfile(options.name, profile);

      if (globalOpts.json === true) {
        const jsonFormatter = createJsonFormatter<{ success: boolean; profile: string; endpoint: string }>();
        process.stdout.write(jsonFormatter.format({
          success: true,
          profile: options.name,
          endpoint: options.endpoint,
        }) + '\n');
      } else {
        process.stdout.write(`✔ Configuration saved to profile '${options.name}'\n`);
        process.stdout.write(`  Endpoint: ${options.endpoint}\n`);
      }
    });

  return command;
}

/**
 * Creates the config show command.
 * Displays current configuration.
 */
function createConfigShowCommand(): Command {
  const command = new Command('show')
    .description('Display current configuration')
    .action(() => {
      const parent = command.parent?.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      const configService = getConfigService();
      const { name, profile } = configService.getActiveProfile();

      if (globalOpts.json === true) {
        const jsonFormatter = createJsonFormatter<ConfigShowOutput>();
        process.stdout.write(jsonFormatter.format({
          activeProfile: name,
          profile,
        }) + '\n');
      } else {
        process.stdout.write(`Profile: ${name} (active)\n\n`);
        process.stdout.write(`  Endpoint:       ${profile.endpoint}\n`);
        if (profile.subscriptionId !== undefined) {
          process.stdout.write(`  Subscription:   ${profile.subscriptionId}\n`);
        }
        if (profile.resourceGroup !== undefined) {
          process.stdout.write(`  Resource Group: ${profile.resourceGroup}\n`);
        }
        if (profile.resourceName !== undefined) {
          process.stdout.write(`  Resource Name:  ${profile.resourceName}\n`);
        }
      }
    });

  return command;
}

/**
 * Creates the config list command.
 * Lists all configuration profiles.
 */
function createConfigListCommand(): Command {
  const command = new Command('list')
    .description('List all configuration profiles')
    .action(() => {
      const parent = command.parent?.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      const configService = getConfigService();
      const profiles = configService.listProfiles();

      if (profiles.length === 0) {
        if (globalOpts.json === true) {
          const jsonFormatter = createJsonFormatter<ConfigListOutput>();
          process.stdout.write(jsonFormatter.format({
            activeProfile: '',
            profiles: [],
          }) + '\n');
        } else {
          process.stdout.write('No profiles configured.\n');
          process.stdout.write('Run `cu config set --endpoint <url>` to create one.\n');
        }
        return;
      }

      if (globalOpts.json === true) {
        const jsonFormatter = createJsonFormatter<ConfigListOutput>();
        const activeProfile = profiles.find(p => p.isActive)?.name ?? '';
        process.stdout.write(jsonFormatter.format({
          activeProfile,
          profiles: profiles.map(p => ({
            name: p.name,
            endpoint: p.profile.endpoint,
            isActive: p.isActive,
          })),
        }) + '\n');
      } else {
        const tableFormatter = createTableFormatter<{
          name: string;
          endpoint: string;
          active: string;
        }>({
          columns: [
            { accessor: 'name', header: 'PROFILE', width: 15 },
            { accessor: 'endpoint', header: 'ENDPOINT', width: 50 },
            { accessor: 'active', header: 'ACTIVE', width: 6 },
          ],
        });

        const rows = profiles.map(p => ({
          name: p.name,
          endpoint: p.profile.endpoint,
          active: p.isActive ? '✓' : '',
        }));

        process.stdout.write(tableFormatter.format(rows) + '\n');
      }
    });

  return command;
}

/**
 * Creates the config use command.
 * Switches active configuration profile.
 */
function createConfigUseCommand(): Command {
  const command = new Command('use')
    .description('Switch active configuration profile')
    .argument('<profile-name>', 'Profile to activate')
    .action((profileName: string) => {
      const parent = command.parent?.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      const configService = getConfigService();
      configService.useProfile(profileName);

      if (globalOpts.json === true) {
        const jsonFormatter = createJsonFormatter<{ success: boolean; activeProfile: string }>();
        process.stdout.write(jsonFormatter.format({
          success: true,
          activeProfile: profileName,
        }) + '\n');
      } else {
        process.stdout.write(`✔ Switched to profile '${profileName}'\n`);
      }
    });

  return command;
}

/**
 * Creates the config command group.
 */
export function createConfigCommand(): Command {
  const command = new Command('config')
    .description('Manage CLI configuration profiles');

  command.addCommand(createConfigSetCommand());
  command.addCommand(createConfigShowCommand());
  command.addCommand(createConfigListCommand());
  command.addCommand(createConfigUseCommand());

  return command;
}

/**
 * Registers all config commands with the program.
 */
export function registerConfigCommands(program: Command): void {
  program.addCommand(createConfigCommand());
}
