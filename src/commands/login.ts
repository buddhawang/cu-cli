/**
 * Login command handlers for authentication.
 * Implements: cu login, cu logout, cu whoami
 */

import { Command } from 'commander';
import { getAuthService } from '../services/auth.js';
import { createJsonFormatter } from '../services/formatters/json.js';
import { CliError, ErrorCodes } from '../lib/errors.js';
import type { UserIdentity, AuthState } from '../models/auth.js';

/**
 * Output for whoami command in JSON format.
 */
interface WhoamiOutput {
  email: string;
  name: string;
  tenantId: string;
  expiresAt: string | null;
}

/**
 * Creates the login command.
 * Authenticates with Azure AD using browser-based sign-in.
 */
export function createLoginCommand(): Command {
  const command = new Command('login')
    .description('Authenticate with Azure AD')
    .option('--tenant <id>', 'Azure AD tenant ID (default: common)')
    .option('--device-code', 'Use device code flow (for headless environments)')
    .action(async (options: { tenant?: string; deviceCode?: boolean }) => {
      const parent = command.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};
      const jsonFormatter = createJsonFormatter<UserIdentity>();

      try {
        const authService = getAuthService(options.tenant);
        let identity: UserIdentity;

        if (options.deviceCode === true) {
          // Device code flow for headless environments
          identity = await authService.loginDeviceCode((message) => {
            process.stderr.write(message + '\n');
          });
        } else {
          // Interactive browser-based login
          process.stderr.write('Opening browser for Azure AD sign-in...\n');
          identity = await authService.loginInteractive();
        }

        if (globalOpts.json === true) {
          process.stdout.write(jsonFormatter.format(identity) + '\n');
        } else {
          process.stdout.write(`✔ Logged in as ${identity.email}\n`);
          process.stdout.write(`  Tenant: ${identity.tenantId}\n`);
        }
      } catch (error) {
        if (error instanceof CliError) {
          throw error;
        }
        throw new CliError(
          ErrorCodes.AUTH_FAILED,
          'Authentication failed',
          error instanceof Error ? error.message : 'Unknown error occurred',
          'Try logging in again with `cu login`'
        );
      }
    });

  return command;
}

/**
 * Creates the logout command.
 * Clears cached credentials.
 */
export function createLogoutCommand(): Command {
  const command = new Command('logout')
    .description('Clear cached credentials')
    .action(async () => {
      const parent = command.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      const authService = getAuthService();
      await authService.logout();

      if (globalOpts.json === true) {
        const jsonFormatter = createJsonFormatter<{ success: boolean }>();
        process.stdout.write(jsonFormatter.format({ success: true }) + '\n');
      } else {
        process.stdout.write('✔ Logged out successfully\n');
      }
    });

  return command;
}

/**
 * Creates the whoami command.
 * Displays current authenticated identity.
 */
export function createWhoamiCommand(): Command {
  const command = new Command('whoami')
    .description('Display current authenticated identity')
    .action(async () => {
      const parent = command.parent;
      const globalOpts = parent?.opts<{ json?: boolean }>() ?? {};

      const authService = getAuthService();
      const authState: AuthState = await authService.getAuthState();

      if (!authState.isAuthenticated || authState.user === null) {
        throw new CliError(
          ErrorCodes.AUTH_REQUIRED,
          'Not authenticated',
          'No cached credentials found',
          'Run `cu login` to authenticate',
          1
        );
      }

      if (globalOpts.json === true) {
        const jsonFormatter = createJsonFormatter<WhoamiOutput>();
        const output: WhoamiOutput = {
          email: authState.user.email,
          name: authState.user.name,
          tenantId: authState.user.tenantId,
          expiresAt: authState.expiresAt?.toISOString() ?? null,
        };
        process.stdout.write(jsonFormatter.format(output) + '\n');
      } else {
        process.stdout.write(`Email:    ${authState.user.email}\n`);
        process.stdout.write(`Name:     ${authState.user.name}\n`);
        process.stdout.write(`Tenant:   ${authState.user.tenantId}\n`);
        if (authState.expiresAt !== null) {
          process.stdout.write(`Expires:  ${formatDateTime(authState.expiresAt)}\n`);
        }
      }
    });

  return command;
}

/**
 * Formats a date for display.
 */
function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Registers all login-related commands with the program.
 */
export function registerLoginCommands(program: Command): void {
  program.addCommand(createLoginCommand());
  program.addCommand(createLogoutCommand());
  program.addCommand(createWhoamiCommand());
}
