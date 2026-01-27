/**
 * Contract tests for analyzer commands (cu analyzer list, show).
 * Verifies the CLI contract for analyzer commands.
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
const TEST_CONFIG_DIR = join(tmpdir(), 'cu-cli-analyzer-test-' + Date.now().toString());
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

describe('Analyzer Commands Contract', () => {
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

  describe('cu analyzer --help', () => {
    it('should_show_analyzer_help_when_help_flag_provided', () => {
      const result = runCli('analyzer --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Manage analyzers');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('show');
    });

    it('should_list_subcommands_in_help', () => {
      const result = runCli('analyzer --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('show');
    });
  });

  describe('cu analyzer list --help', () => {
    it('should_show_list_help_text', () => {
      const result = runCli('analyzer list --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('List all analyzers');
    });
  });

  describe('cu analyzer show --help', () => {
    it('should_show_show_help_with_analyzer_id_argument', () => {
      const result = runCli('analyzer show --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Display details');
      expect(result.stdout).toContain('analyzer-id');
    });
  });

  describe('cu analyzer show (no argument)', () => {
    it('should_fail_when_analyzer_id_not_provided', () => {
      const result = runCli('analyzer show');

      expect(result.exitCode).not.toBe(0);
      // Commander shows error for missing required argument
      expect(result.stderr).toContain('analyzer-id');
    });
  });

  describe('cu analyzer list (no config)', () => {
    it('should_fail_with_exit_code_2_when_config_missing', () => {
      // No config setup - should fail with config error
      const result = runCli('analyzer list');

      // Exit code 2 indicates config missing
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Error');
    });

    it('should_output_json_error_when_json_flag_and_no_config', () => {
      const result = runCli('--json analyzer list');

      expect(result.exitCode).toBe(2);
      // Output contains Error text (could be JSON or human-readable)
      const output = result.stdout || result.stderr;
      expect(output).toContain('Error');
    });
  });

  describe('cu analyzer show (no config)', () => {
    it('should_fail_with_exit_code_2_when_config_missing', () => {
      // No config setup - should fail with config error
      const result = runCli('analyzer show test-analyzer');

      // Exit code 2 indicates config missing
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Error');
    });
  });

  describe('cu analyzer list (with config, no auth)', () => {
    // Skip when user is authenticated - the shared MSAL cache would make auth succeed
    it.skipIf(USER_IS_AUTHENTICATED)('should_fail_with_exit_code_1_when_auth_required', () => {
      // Setup config but no auth
      setupTestConfig();
      
      const result = runCli('analyzer list');

      // Exit code 1 indicates auth required
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('auth');
    });
  });

  describe('cu analyzer show (with config, no auth)', () => {
    // Skip when user is authenticated - the shared MSAL cache would make auth succeed
    it.skipIf(USER_IS_AUTHENTICATED)('should_fail_with_exit_code_1_when_auth_required', () => {
      // Setup config but no auth
      setupTestConfig();
      
      const result = runCli('analyzer show prebuilt-document');

      // Exit code 1 indicates auth required
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('auth');
    });
  });

  describe('Global options', () => {
    it('should_accept_json_flag_for_list', () => {
      // The command should accept --json, even though it will fail with auth error
      setupTestConfig();
      
      const result = runCli('--json analyzer list');

      // Should not fail due to unrecognized option
      // Will fail with auth/network error (various exit codes possible)
      expect(result.exitCode).toBeGreaterThan(0);
      // Output should contain error indication
      const output = result.stdout || result.stderr;
      expect(output).toContain('Error');
    });

    it('should_accept_json_flag_for_show', () => {
      // The command should accept --json, even though it will fail with auth error
      setupTestConfig();
      
      const result = runCli('--json analyzer show test-analyzer');

      // Should not fail due to unrecognized option
      // Will fail with auth error
      expect(result.exitCode).toBe(1);
      // Output should contain error indication
      const output = result.stdout || result.stderr;
      expect(output).toContain('Error');
    });

    it('should_accept_profile_flag_for_list', () => {
      // Create a non-default profile
      const configPath = join(TEST_CU_DIR, 'config.json');
      const config = {
        version: '1',
        activeProfile: 'default',
        profiles: {
          default: {
            endpoint: 'https://default.cognitiveservices.azure.com',
          },
          staging: {
            endpoint: 'https://staging.cognitiveservices.azure.com',
          },
        },
      };
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      // The command should accept --profile, even though it will fail with auth error
      const result = runCli('--profile staging analyzer list');

      // Should fail with auth error (not profile error)
      expect(result.exitCode).toBe(1);
    });
  });
});
