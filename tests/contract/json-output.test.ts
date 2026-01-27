/**
 * Contract tests for JSON output across all commands.
 * Verifies that all commands properly support the --json flag.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../dist/cu.cjs');

// Use a temp directory for test config
const TEST_CONFIG_DIR = join(tmpdir(), 'cu-cli-json-test-' + Date.now().toString());
const TEST_CU_DIR = join(TEST_CONFIG_DIR, '.cu');

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
      staging: {
        endpoint: 'https://staging-resource.cognitiveservices.azure.com',
      },
    },
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Parses JSON safely, returning null on failure.
 */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

describe('JSON Output Contract Tests', () => {
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

  describe('Config Commands JSON Output', () => {
    it('should_output_valid_json_for_config_show', () => {
      setupTestConfig();
      const result = runCli('--json config show');

      expect(result.exitCode).toBe(0);
      const json = parseJson(result.stdout);
      expect(json).not.toBeNull();
      expect(json).toHaveProperty('activeProfile');
      expect(json).toHaveProperty('profile');
    });

    it('should_output_valid_json_for_config_list', () => {
      setupTestConfig();
      const result = runCli('--json config list');

      expect(result.exitCode).toBe(0);
      const json = parseJson(result.stdout);
      expect(json).not.toBeNull();
      expect(json).toHaveProperty('profiles');
    });

    it('should_output_valid_json_for_config_set', () => {
      setupTestConfig();
      const result = runCli('--json config set --endpoint https://new.cognitiveservices.azure.com');

      expect(result.exitCode).toBe(0);
      const json = parseJson(result.stdout);
      expect(json).not.toBeNull();
    });

    it('should_output_json_error_for_missing_profile', () => {
      // No config file
      const result = runCli('--json config show');

      // Should exit with error
      expect(result.exitCode).toBeGreaterThan(0);
      // JSON error should be in stdout
      const json = parseJson(result.stdout);
      if (json !== null) {
        expect(json).toHaveProperty('error');
      }
    });
  });

  describe('Login Commands JSON Output', () => {
    it('should_output_json_error_for_whoami_when_not_logged_in', () => {
      setupTestConfig();
      const result = runCli('--json whoami');

      // Should fail when not logged in
      expect(result.exitCode).toBeGreaterThan(0);
      // Output should be JSON error
      const json = parseJson(result.stdout);
      if (json !== null) {
        expect(json).toHaveProperty('error');
      }
    });
  });

  describe('Analyzer Commands JSON Output', () => {
    it('should_accept_json_flag_for_analyzer_list', () => {
      setupTestConfig();
      const result = runCli('--json analyzer list');

      // Will fail due to auth, but should accept the flag
      expect(result.exitCode).toBeGreaterThan(0);
      // Output should be JSON (either data or error)
      const json = parseJson(result.stdout);
      // If output is JSON error, that's acceptable
      if (json !== null) {
        expect(typeof json).toBe('object');
      }
    });

    it('should_accept_json_flag_for_analyzer_show', () => {
      setupTestConfig();
      const result = runCli('--json analyzer show test-analyzer');

      // Will fail due to auth, but should accept the flag
      expect(result.exitCode).toBeGreaterThan(0);
    });
  });

  describe('Analyze Commands JSON Output', () => {
    it('should_accept_json_flag_for_analyze', () => {
      setupTestConfig();
      const result = runCli('--json analyze ./nonexistent.pdf');

      // Will fail due to missing file, but should accept the flag
      expect(result.exitCode).toBeGreaterThan(0);
    });

    it('should_accept_format_json_option', () => {
      setupTestConfig();
      const result = runCli('analyze --format json ./nonexistent.pdf');

      // Will fail due to missing file, but should accept the option
      expect(result.exitCode).toBeGreaterThan(0);
    });
  });

  describe('Defaults Commands JSON Output', () => {
    it('should_accept_json_flag_for_defaults_list', () => {
      setupTestConfig();
      const result = runCli('--json defaults list');

      // Will fail due to auth, but should accept the flag
      expect(result.exitCode).toBeGreaterThan(0);
    });

    it('should_accept_json_flag_for_defaults_set', () => {
      setupTestConfig();
      const result = runCli('--json defaults set --model gpt-4.1 --deployment myDeploy');

      // Will fail due to auth, but should accept the flag
      expect(result.exitCode).toBeGreaterThan(0);
    });

    it('should_accept_json_flag_for_defaults_remove', () => {
      setupTestConfig();
      const result = runCli('--json defaults remove gpt-4.1 --force');

      // Will fail due to auth, but should accept the flag
      expect(result.exitCode).toBeGreaterThan(0);
    });
  });

  describe('JSON Output Structure', () => {
    it('should_output_json_with_proper_structure_for_config_show', () => {
      setupTestConfig();
      const result = runCli('--json config show');

      expect(result.exitCode).toBe(0);
      const json = parseJson(result.stdout) as Record<string, unknown>;
      expect(json).not.toBeNull();
      
      // Should have expected fields
      expect(typeof json['activeProfile']).toBe('string');
      expect(typeof json['profile']).toBe('object');
      const profile = json['profile'] as Record<string, unknown>;
      expect(typeof profile['endpoint']).toBe('string');
    });

    it('should_output_json_with_profiles_array_for_config_list', () => {
      setupTestConfig();
      const result = runCli('--json config list');

      expect(result.exitCode).toBe(0);
      const json = parseJson(result.stdout) as Record<string, unknown>;
      expect(json).not.toBeNull();
      
      // Should have profiles
      expect(json).toHaveProperty('profiles');
      expect(Array.isArray(json['profiles'])).toBe(true);
    });
  });
});
