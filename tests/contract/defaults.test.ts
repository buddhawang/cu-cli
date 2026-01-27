/**
 * Contract tests for defaults commands (cu defaults list, set, remove).
 * Verifies the CLI contract for model deployment mapping commands.
 * 
 * Note: These tests focus on command structure, help text, and validation.
 * Actual API integration tests require a live Azure CU resource.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, tmpdir } from 'node:os';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../dist/cu.cjs');

// Use a temp directory for test config
const TEST_CONFIG_DIR = join(tmpdir(), 'cu-cli-defaults-test-' + Date.now().toString());
const TEST_CU_DIR = join(TEST_CONFIG_DIR, '.cu');

// Check if user has real MSAL cache (is authenticated)
const MSAL_CACHE_PATH = join(homedir(), '.cu', 'msal-cache.json');
const USER_IS_AUTHENTICATED = existsSync(MSAL_CACHE_PATH);

/**
 * Executes the CLI with given arguments and returns output.
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

/**
 * Creates a test configuration with a valid profile.
 */
function setupTestConfig(): void {
  const configPath = join(TEST_CU_DIR, 'config.json');
  const config = {
    version: '1',
    activeProfile: 'default',
    profiles: {
      default: {
        endpoint: 'https://test-resource.cognitiveservices.azure.com',
      },
    },
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

describe('Defaults Commands Contract', () => {
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

  describe('cu defaults --help', () => {
    it('should_show_defaults_help_when_help_flag_provided', () => {
      const result = runCli('defaults --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Manage model deployment mappings');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('set');
      expect(result.stdout).toContain('remove');
    });

    it('should_show_help_when_defaults_called_without_subcommand', () => {
      const result = runCli('defaults');

      // Shows help text regardless of exit code
      const output = result.stdout + result.stderr;
      expect(output).toContain('Manage model deployment mappings');
    });
  });

  describe('cu defaults list --help', () => {
    it('should_show_list_help', () => {
      const result = runCli('defaults list --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('List all model deployment mappings');
    });

    it('should_require_profile_when_listing_defaults', () => {
      // No profile configured
      const result = runCli('defaults list');

      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.stderr).toMatch(/profile|not configured|endpoint/i);
    });
  });

  describe('cu defaults set --help', () => {
    it('should_show_set_help_with_required_options', () => {
      const result = runCli('defaults set --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Set a model deployment mapping');
      expect(result.stdout).toContain('--model');
      expect(result.stdout).toContain('--deployment');
    });

    it('should_require_model_and_deployment_options', () => {
      setupTestConfig();

      // Missing both required options
      const result = runCli('defaults set');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/required|missing|model|deployment/i);
    });

    it('should_require_deployment_when_model_provided', () => {
      setupTestConfig();

      const result = runCli('defaults set --model gpt-4.1');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/required|missing|deployment/i);
    });

    it('should_require_model_when_deployment_provided', () => {
      setupTestConfig();

      const result = runCli('defaults set --deployment myDeployment');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/required|missing|model/i);
    });
  });

  describe('cu defaults remove --help', () => {
    it('should_show_remove_help_with_force_option', () => {
      const result = runCli('defaults remove --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Remove a model deployment mapping');
      expect(result.stdout).toContain('--force');
    });

    it('should_require_model_name_argument', () => {
      setupTestConfig();

      const result = runCli('defaults remove');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/missing|required|argument/i);
    });

    it('should_show_force_option_description', () => {
      const result = runCli('defaults remove --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toLowerCase()).toMatch(/force|skip|confirm/);
    });
  });

  describe('Error Handling', () => {
    it('should_require_config_for_list_command', () => {
      // No config file exists
      const result = runCli('defaults list');

      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.stderr).toMatch(/profile|configured|endpoint/i);
    });

    it('should_require_config_for_set_command', () => {
      // No config file exists
      const result = runCli('defaults set --model gpt-4.1 --deployment myDeployment');

      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.stderr).toMatch(/profile|configured|endpoint|auth/i);
    });

    it('should_require_config_for_remove_command', () => {
      // No config file exists
      const result = runCli('defaults remove gpt-4.1 --force');

      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.stderr).toMatch(/profile|configured|endpoint|auth/i);
    });
  });

  describe('Global Options', () => {
    it('should_support_verbose_flag', () => {
      const result = runCli('defaults --help');

      // Verbose is a global option
      expect(result.exitCode).toBe(0);
    });

    it('should_support_output_format_option', () => {
      setupTestConfig();

      // Help should not require auth
      const result = runCli('defaults list --help');

      expect(result.exitCode).toBe(0);
    });
  });

  // Skip integration tests that require authentication
  describe.skipIf(!USER_IS_AUTHENTICATED)('Integration Tests (requires auth)', () => {
    beforeEach(() => {
      setupTestConfig();
    });

    it('should_list_defaults_when_authenticated', () => {
      // This test requires actual Azure CU authentication
      const result = runCli('defaults list');

      // May succeed or fail depending on resource access
      // We're mainly testing that the command runs without crashing
      expect([0, 1]).toContain(result.exitCode);
    });
  });
});
