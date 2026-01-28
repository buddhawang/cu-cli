/**
 * Status command handler for displaying authentication and configuration status.
 * Implements: cu status
 */

import { Command } from 'commander';
import { getAuthService } from '../services/auth.js';
import { getConfigService } from '../services/config.js';
import { createJsonFormatter } from '../services/formatters/json.js';
import type { AuthState, AuthMethod } from '../models/auth.js';

/**
 * Output for status command in JSON format.
 */
interface StatusJsonOutput {
  authentication: {
    method: AuthMethod;
    isAuthenticated: boolean;
    user: {
      email: string;
      name: string;
      tenantId: string;
    } | null;
    expiresAt: string | null;
    needsRefresh: boolean;
  };
  configuration: {
    profile: string | null;
    endpoint: string | null;
    hasApiKey: boolean;
  };
}

/**
 * Formats time remaining until expiration.
 */
function formatTimeRemaining(expiresAt: Date): string {
  const now = Date.now();
  const expiresTime = expiresAt.getTime();
  const diffMs = expiresTime - now;

  if (diffMs <= 0) {
    return 'expired';
  }

  const minutes = Math.floor(diffMs / (60 * 1000));
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${minutes}m`;
}

/**
 * Determines the current authentication method.
 */
function getAuthMethod(authState: AuthState, hasApiKey: boolean): AuthMethod {
  if (hasApiKey) {
    return 'api-key';
  }
  if (authState.isAuthenticated) {
    return 'azure-ad';
  }
  return 'none';
}

/**
 * Creates the status command.
 * Displays current authentication status and configuration.
 */
export function createStatusCommand(): Command {
  const command = new Command('status')
    .description('Display authentication and configuration status')
    .action(async () => {
      const parent = command.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      const configService = getConfigService();
      const authService = getAuthService();

      // Get configuration info
      let profileName: string | null = null;
      let endpoint: string | null = null;
      let hasApiKey = false;

      try {
        const { name, profile } = configService.getActiveProfile();
        profileName = name;
        endpoint = profile.endpoint;
        hasApiKey = profile.apiKey !== undefined && profile.apiKey !== '';
      } catch {
        // No configuration set
      }

      // Get authentication state
      let authState: AuthState;
      if (hasApiKey) {
        // API key auth - no need to check Azure AD
        authState = {
          isAuthenticated: true,
          user: null,
          expiresAt: null,
          isApiKey: true,
          needsRefresh: false,
        };
      } else {
        // Check Azure AD auth state
        authState = await authService.getAuthState();
      }

      const authMethod = getAuthMethod(authState, hasApiKey);

      if (globalOpts.json === true) {
        const jsonFormatter = createJsonFormatter<StatusJsonOutput>();
        const output: StatusJsonOutput = {
          authentication: {
            method: authMethod,
            isAuthenticated: authState.isAuthenticated,
            user: authState.user !== null ? {
              email: authState.user.email,
              name: authState.user.name,
              tenantId: authState.user.tenantId,
            } : null,
            expiresAt: authState.expiresAt?.toISOString() ?? null,
            needsRefresh: authState.needsRefresh ?? false,
          },
          configuration: {
            profile: profileName,
            endpoint,
            hasApiKey,
          },
        };
        process.stdout.write(jsonFormatter.format(output) + '\n');
      } else {
        // Human-readable output
        process.stdout.write('\n');
        process.stdout.write('╭───────────────────────────────────────────╮\n');
        process.stdout.write('│           Authentication Status           │\n');
        process.stdout.write('├───────────────────────────────────────────┤\n');

        if (authMethod === 'api-key') {
          process.stdout.write('│  Method:     API Key                      │\n');
          process.stdout.write('│  Status:     ✓ Configured                 │\n');
          process.stdout.write('│  Expiry:     No expiration                │\n');
        } else if (authMethod === 'azure-ad' && authState.user !== null) {
          process.stdout.write(`│  Method:     Azure AD                     │\n`);
          process.stdout.write(`│  Status:     ✓ Authenticated              │\n`);
          process.stdout.write(`│  User:       ${authState.user.email.padEnd(27)}│\n`);
          if (authState.expiresAt !== null) {
            const timeRemaining = formatTimeRemaining(authState.expiresAt);
            const statusIndicator = authState.needsRefresh === true ? '⚠' : '✓';
            process.stdout.write(`│  Expires:    ${statusIndicator} ${timeRemaining.padEnd(25)}│\n`);
            if (authState.needsRefresh === true) {
              process.stdout.write('│  Note:       Token will refresh soon      │\n');
            }
          }
        } else {
          process.stdout.write('│  Method:     None                         │\n');
          process.stdout.write('│  Status:     ✗ Not authenticated          │\n');
        }

        process.stdout.write('├───────────────────────────────────────────┤\n');
        process.stdout.write('│           Configuration Status            │\n');
        process.stdout.write('├───────────────────────────────────────────┤\n');

        if (profileName !== null && endpoint !== null) {
          process.stdout.write(`│  Profile:    ${profileName.padEnd(27)}│\n`);
          // Truncate endpoint if too long
          const displayEndpoint = endpoint.length > 27 
            ? endpoint.substring(0, 24) + '...' 
            : endpoint;
          process.stdout.write(`│  Endpoint:   ${displayEndpoint.padEnd(27)}│\n`);
          if (hasApiKey) {
            process.stdout.write('│  API Key:    ✓ Configured                 │\n');
          }
        } else {
          process.stdout.write('│  Status:     ✗ Not configured             │\n');
          process.stdout.write('│  Hint:       Run `cu config set`          │\n');
        }

        process.stdout.write('╰───────────────────────────────────────────╯\n');
        process.stdout.write('\n');

        // Show helpful hints
        if (authMethod === 'none') {
          process.stdout.write('Hint: Run `cu login` or `cu config set --api-key <key>` to authenticate.\n');
        }
      }
    });

  return command;
}

/**
 * Registers the status command with the program.
 */
export function registerStatusCommands(program: Command): void {
  program.addCommand(createStatusCommand());
}
