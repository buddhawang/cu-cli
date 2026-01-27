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
  profile: ConfigProfile & { hasApiKey?: boolean; apiKeyPreview?: string };
}

/**
 * Masks an API key for display, showing only last 3 characters.
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 3) {
    return '•••';
  }
  return '•••' + apiKey.slice(-3);
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
    .option('--endpoint <url>', 'Azure CU resource endpoint')
    .option('-n, --name <name>', 'Profile name to create/update', DEFAULT_PROFILE_NAME)
    .option('--subscription <id>', 'Azure subscription ID')
    .option('--resource-group <name>', 'Resource group name')
    .option('--resource-name <name>', 'Resource name')
    .option('--api-key <key>', 'API key for authentication (takes priority over Azure AD)')
    .action((options: {
      endpoint?: string;
      name: string;
      subscription?: string;
      resourceGroup?: string;
      resourceName?: string;
      apiKey?: string;
    }) => {
      const parent = command.parent?.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      const configService = getConfigService();
      
      // If only updating API key on existing profile
      if (options.endpoint === undefined && options.apiKey !== undefined) {
        const existingProfile = configService.getProfile(options.name);
        if (existingProfile === undefined) {
          process.stderr.write(`Error: Profile '${options.name}' not found. Use --endpoint to create a new profile.\n`);
          process.exit(2);
        }
        configService.updateProfileApiKey(options.name, options.apiKey);
        
        if (globalOpts.json === true) {
          const jsonFormatter = createJsonFormatter<{ success: boolean; profile: string; apiKeySet: boolean }>();
          process.stdout.write(jsonFormatter.format({
            success: true,
            profile: options.name,
            apiKeySet: options.apiKey !== '',
          }) + '\n');
        } else {
          if (options.apiKey === '') {
            process.stdout.write(`✔ API key removed from profile '${options.name}'\n`);
          } else {
            process.stdout.write(`✔ API key set for profile '${options.name}'\n`);
          }
        }
        return;
      }
      
      // Require endpoint for new profile creation
      if (options.endpoint === undefined) {
        process.stderr.write('Error: --endpoint is required when creating a new profile\n');
        process.exit(3);
      }
      
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

      const setOptions = options.apiKey !== undefined ? { apiKey: options.apiKey } : undefined;
      configService.setProfile(options.name, profile, setOptions);

      if (globalOpts.json === true) {
        const jsonFormatter = createJsonFormatter<{ success: boolean; profile: string; endpoint: string; apiKeySet: boolean }>();
        process.stdout.write(jsonFormatter.format({
          success: true,
          profile: options.name,
          endpoint: options.endpoint,
          apiKeySet: options.apiKey !== undefined && options.apiKey !== '',
        }) + '\n');
      } else {
        process.stdout.write(`✔ Configuration saved to profile '${options.name}'\n`);
        process.stdout.write(`  Endpoint: ${options.endpoint}\n`);
        if (options.apiKey !== undefined && options.apiKey !== '') {
          process.stdout.write(`  API Key:  configured\n`);
        }
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
        // Don't expose actual API key in JSON output
        const outputProfile: ConfigShowOutput['profile'] = {
          ...profile,
          hasApiKey: profile.apiKey !== undefined && profile.apiKey !== '',
        };
        if (profile.apiKey !== undefined && profile.apiKey !== '') {
          outputProfile.apiKeyPreview = maskApiKey(profile.apiKey);
        }
        // Remove actual apiKey from output
        delete outputProfile.apiKey;
        
        process.stdout.write(jsonFormatter.format({
          activeProfile: name,
          profile: outputProfile,
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
        if (profile.apiKey !== undefined && profile.apiKey !== '') {
          process.stdout.write(`  API Key:        ${maskApiKey(profile.apiKey)} (configured)\n`);
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
 * Creates the config unset command.
 * Removes a configuration value from a profile.
 */
function createConfigUnsetCommand(): Command {
  const command = new Command('unset')
    .description('Remove a configuration value')
    .argument('<key>', 'Configuration key to remove (e.g., api-key)')
    .option('-n, --name <name>', 'Profile name to update', DEFAULT_PROFILE_NAME)
    .action((key: string, options: { name: string }) => {
      const parent = command.parent?.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      const configService = getConfigService();
      
      if (key === 'api-key') {
        configService.updateProfileApiKey(options.name, '');
        
        if (globalOpts.json === true) {
          const jsonFormatter = createJsonFormatter<{ success: boolean; profile: string; removed: string }>();
          process.stdout.write(jsonFormatter.format({
            success: true,
            profile: options.name,
            removed: 'api-key',
          }) + '\n');
        } else {
          process.stdout.write(`✔ API key removed from profile '${options.name}'\n`);
        }
      } else {
        process.stderr.write(`Error: Unknown configuration key '${key}'\n`);
        process.stderr.write(`Supported keys: api-key\n`);
        process.exit(3);
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
  command.addCommand(createConfigUnsetCommand());

  return command;
}

/**
 * Registers all config commands with the program.
 */
export function registerConfigCommands(program: Command): void {
  program.addCommand(createConfigCommand());
}
