/**
 * Contract tests for login commands (cu login, cu logout, cu whoami).
 * Verifies the CLI contract for authentication commands.
 */

import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../dist/cu.cjs');

/**
 * Executes the CLI with given arguments and returns output.
 */
function runCli(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node "${CLI_PATH}" ${args}`, {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: execError.status ?? 1,
    };
  }
}

/**
 * Check if user is currently authenticated
 */
function isAuthenticated(): boolean {
  const result = runCli('whoami');
  return result.exitCode === 0;
}

describe('Login Commands Contract', () => {
  beforeAll(() => {
    // Ensure the CLI is built
    if (!existsSync(CLI_PATH)) {
      throw new Error(`CLI not built. Run 'npm run build' first. Expected: ${CLI_PATH}`);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cu login --help', () => {
    it('should_show_login_help_when_help_flag_provided', () => {
      const result = runCli('login --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Authenticate with Azure AD');
    });

    it('should_list_tenant_option_in_help', () => {
      const result = runCli('login --help');

      expect(result.stdout).toContain('--tenant');
      expect(result.stdout).toContain('Azure AD tenant ID');
    });

    it('should_list_device_code_option_in_help', () => {
      const result = runCli('login --help');

      expect(result.stdout).toContain('--device-code');
      expect(result.stdout).toContain('device code flow');
    });
  });

  describe('cu logout --help', () => {
    it('should_show_logout_help_when_help_flag_provided', () => {
      const result = runCli('logout --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Clear cached credentials');
    });
  });

  describe('cu whoami --help', () => {
    it('should_show_whoami_help_when_help_flag_provided', () => {
      const result = runCli('whoami --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Display current authenticated identity');
    });
  });

  describe('cu whoami (not authenticated)', () => {
    // These tests require unauthenticated state - skip if user is already logged in
    it.skipIf(isAuthenticated())('should_return_exit_code_1_when_not_authenticated', () => {
      // This test runs against a fresh environment with no cached credentials
      // It should fail with auth required error
      const result = runCli('whoami');

      // Exit code 1 indicates authentication required
      expect(result.exitCode).toBe(1);
    });

    it.skipIf(isAuthenticated())('should_show_auth_required_error_when_not_authenticated', () => {
      const result = runCli('whoami');

      expect(result.stderr).toContain('Not authenticated');
      expect(result.stderr).toContain('cu login');
    });

    it.skipIf(isAuthenticated())('should_output_json_error_when_json_flag_provided_and_not_authenticated', () => {
      const result = runCli('--json whoami');

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('"code"');
      expect(result.stdout).toContain('AUTH_REQUIRED');
    });
  });

  describe('cu logout (not authenticated)', () => {
    it('should_succeed_even_when_not_authenticated', () => {
      // Logout should always succeed, even with no cached credentials
      const result = runCli('logout');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Logged out successfully');
    });

    it('should_output_json_when_json_flag_provided', () => {
      const result = runCli('--json logout');

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as { success: boolean };
      expect(output.success).toBe(true);
    });
  });

  describe('command availability', () => {
    it('should_list_login_command_in_main_help', () => {
      const result = runCli('--help');

      expect(result.stdout).toContain('login');
    });

    it('should_list_logout_command_in_main_help', () => {
      const result = runCli('--help');

      expect(result.stdout).toContain('logout');
    });

    it('should_list_whoami_command_in_main_help', () => {
      const result = runCli('--help');

      expect(result.stdout).toContain('whoami');
    });
  });
});
