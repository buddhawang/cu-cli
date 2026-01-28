/**
 * Contract tests for status command (cu status).
 * Verifies the CLI contract for authentication status display.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../dist/cu.cjs');

// Use a temp directory for test config to avoid polluting user's actual config
const TEST_CONFIG_DIR = join(tmpdir(), 'cu-cli-status-test-' + Date.now().toString());
const TEST_CU_DIR = join(TEST_CONFIG_DIR, '.cu');

/**
 * Executes the CLI with given arguments and returns output.
 * Sets CU_CONFIG_DIR to temp directory to use test config.
 */
function runCli(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node "${CLI_PATH}" ${args}`, {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CU_CONFIG_DIR: TEST_CU_DIR,
      },
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

describe('Status Command Contract', () => {
  beforeAll(() => {
    // Verify CLI exists
    expect(existsSync(CLI_PATH)).toBe(true);
  });

  beforeEach(() => {
    // Create fresh temp config directory for each test
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_CU_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
  });

  describe('cu status --help', () => {
    it('should_show_status_help_when_help_flag_provided', () => {
      const result = runCli('status --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Display authentication and configuration status');
    });
  });

  describe('cu status (no config)', () => {
    it('should_show_not_configured_status_when_no_config_exists', () => {
      const result = runCli('status');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Not configured');
    });

    it('should_show_not_authenticated_status_when_no_auth_exists', () => {
      const result = runCli('status');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Not authenticated');
    });

    it('should_output_json_when_json_flag_provided', () => {
      const result = runCli('--json status');

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as {
        authentication: { method: string; isAuthenticated: boolean };
        configuration: { profile: null };
      };
      expect(output.authentication.method).toBe('none');
      expect(output.authentication.isAuthenticated).toBe(false);
      expect(output.configuration.profile).toBeNull();
    });
  });

  describe('cu status (with config)', () => {
    it('should_show_profile_info_when_config_exists', () => {
      // Set up config first
      runCli('config set --endpoint https://test.cognitiveservices.azure.com');
      
      const result = runCli('status');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('default');
      // Note: endpoint may be truncated in display, check for partial match
      expect(result.stdout).toContain('test.cognitivese');
    });

    it('should_show_api_key_configured_when_api_key_set', () => {
      // Set up config with API key
      runCli('config set --endpoint https://test.cognitiveservices.azure.com --api-key my-test-key');
      
      const result = runCli('status');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('API Key');
      expect(result.stdout).toContain('Configured');
    });

    it('should_output_api_key_method_in_json_when_api_key_set', () => {
      // Set up config with API key
      runCli('config set --endpoint https://test.cognitiveservices.azure.com --api-key my-test-key');
      
      const result = runCli('--json status');

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as {
        authentication: { method: string; isAuthenticated: boolean };
        configuration: { hasApiKey: boolean };
      };
      expect(output.authentication.method).toBe('api-key');
      expect(output.authentication.isAuthenticated).toBe(true);
      expect(output.configuration.hasApiKey).toBe(true);
    });
  });

  describe('cu status (JSON output structure)', () => {
    it('should_include_all_required_fields_in_json_output', () => {
      runCli('config set --endpoint https://test.cognitiveservices.azure.com');
      
      const result = runCli('--json status');

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as {
        authentication: {
          method: string;
          isAuthenticated: boolean;
          user: null;
          expiresAt: null;
          needsRefresh: boolean;
        };
        configuration: {
          profile: string;
          endpoint: string;
          hasApiKey: boolean;
        };
      };

      // Verify authentication structure
      expect(output.authentication).toBeDefined();
      expect(typeof output.authentication.method).toBe('string');
      expect(typeof output.authentication.isAuthenticated).toBe('boolean');
      expect(typeof output.authentication.needsRefresh).toBe('boolean');

      // Verify configuration structure
      expect(output.configuration).toBeDefined();
      expect(output.configuration.profile).toBe('default');
      expect(output.configuration.endpoint).toBe('https://test.cognitiveservices.azure.com');
      expect(typeof output.configuration.hasApiKey).toBe('boolean');
    });
  });

  describe('command availability', () => {
    it('should_list_status_command_in_main_help', () => {
      const result = runCli('--help');

      expect(result.stdout).toContain('status');
    });
  });
});
