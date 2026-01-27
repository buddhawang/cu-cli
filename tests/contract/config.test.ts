/**
 * Contract tests for config commands (cu config set, show, list, use).
 * Verifies the CLI contract for configuration commands.
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
const TEST_CONFIG_DIR = join(tmpdir(), 'cu-cli-test-' + Date.now().toString());
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

describe('Config Commands Contract', () => {
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

  describe('cu config --help', () => {
    it('should_show_config_help_when_help_flag_provided', () => {
      const result = runCli('config --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Manage CLI configuration profiles');
      expect(result.stdout).toContain('set');
      expect(result.stdout).toContain('show');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('use');
    });
  });

  describe('cu config set --help', () => {
    it('should_show_set_help_with_endpoint_option', () => {
      const result = runCli('config set --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--endpoint');
      expect(result.stdout).toContain('--name');
    });
  });

  describe('cu config set', () => {
    it('should_save_config_when_valid_endpoint_provided', () => {
      const result = runCli('config set --endpoint https://test.cognitiveservices.azure.com');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration saved');
      expect(result.stdout).toContain('default');
    });

    it('should_save_config_to_named_profile', () => {
      const result = runCli('config set --endpoint https://staging.cognitiveservices.azure.com -n staging');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('staging');
    });

    it('should_fail_when_endpoint_is_invalid_url', () => {
      // Use a URL with invalid characters that cannot be parsed even with https:// prefix
      const result = runCli('config set --endpoint "https://invalid url with spaces"');

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Invalid');
    });

    it('should_fail_when_endpoint_is_http_not_https', () => {
      const result = runCli('config set --endpoint http://insecure.example.com');

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('HTTPS');
    });

    it('should_fail_when_endpoint_not_provided', () => {
      const result = runCli('config set');

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('endpoint');
    });

    it('should_output_json_when_json_flag_provided', () => {
      const result = runCli('--json config set --endpoint https://test.cognitiveservices.azure.com');

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as { success: boolean; profile: string };
      expect(output.success).toBe(true);
      expect(output.profile).toBe('default');
    });
  });

  describe('cu config show', () => {
    it('should_display_active_profile_when_configured', () => {
      // First set up config
      runCli('config set --endpoint https://test.cognitiveservices.azure.com');
      
      const result = runCli('config show');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('default');
      expect(result.stdout).toContain('https://test.cognitiveservices.azure.com');
    });

    it('should_fail_when_no_config_exists', () => {
      const result = runCli('config show');

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('No configuration');
    });

    it('should_output_json_when_json_flag_provided', () => {
      // First set up config
      runCli('config set --endpoint https://test.cognitiveservices.azure.com');
      
      const result = runCli('--json config show');

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as { activeProfile: string; profile: { endpoint: string } };
      expect(output.activeProfile).toBe('default');
      expect(output.profile.endpoint).toBe('https://test.cognitiveservices.azure.com');
    });
  });

  describe('cu config list', () => {
    it('should_list_all_profiles_when_configured', () => {
      // Set up multiple profiles
      runCli('config set --endpoint https://dev.cognitiveservices.azure.com -n dev');
      runCli('config set --endpoint https://staging.cognitiveservices.azure.com -n staging');
      
      const result = runCli('config list');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('dev');
      expect(result.stdout).toContain('staging');
    });

    it('should_show_active_profile_indicator', () => {
      runCli('config set --endpoint https://dev.cognitiveservices.azure.com -n dev');
      
      const result = runCli('config list');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('✓');
    });

    it('should_show_message_when_no_profiles', () => {
      const result = runCli('config list');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No profiles configured');
    });

    it('should_output_json_when_json_flag_provided', () => {
      runCli('config set --endpoint https://test.cognitiveservices.azure.com');
      
      const result = runCli('--json config list');

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as { profiles: Array<{ name: string; isActive: boolean }> };
      expect(output.profiles).toHaveLength(1);
      expect(output.profiles[0]?.isActive).toBe(true);
    });
  });

  describe('cu config use', () => {
    it('should_switch_active_profile_when_exists', () => {
      // Set up two profiles
      runCli('config set --endpoint https://dev.cognitiveservices.azure.com -n dev');
      runCli('config set --endpoint https://staging.cognitiveservices.azure.com -n staging');
      
      const result = runCli('config use staging');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Switched to profile');
      expect(result.stdout).toContain('staging');

      // Verify with show
      const showResult = runCli('config show');
      expect(showResult.stdout).toContain('staging');
    });

    it('should_fail_when_profile_not_found', () => {
      runCli('config set --endpoint https://test.cognitiveservices.azure.com');
      
      const result = runCli('config use nonexistent');

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('not found');
    });

    it('should_fail_when_no_profile_argument_provided', () => {
      const result = runCli('config use');

      expect(result.exitCode).not.toBe(0);
    });

    it('should_output_json_when_json_flag_provided', () => {
      runCli('config set --endpoint https://dev.cognitiveservices.azure.com -n dev');
      runCli('config set --endpoint https://staging.cognitiveservices.azure.com -n staging');
      
      const result = runCli('--json config use staging');

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as { success: boolean; activeProfile: string };
      expect(output.success).toBe(true);
      expect(output.activeProfile).toBe('staging');
    });
  });

  describe('command availability', () => {
    it('should_list_config_command_in_main_help', () => {
      const result = runCli('--help');

      expect(result.stdout).toContain('config');
    });
  });

  describe('cu config set --api-key', () => {
    it('should_save_api_key_when_provided', () => {
      const result = runCli('config set --endpoint https://test.cognitiveservices.azure.com --api-key my-test-api-key-123');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration saved');
      expect(result.stdout).toContain('API Key');
    });

    it('should_show_masked_api_key_in_config_show', () => {
      runCli('config set --endpoint https://test.cognitiveservices.azure.com --api-key my-test-api-key-123');
      
      const result = runCli('config show');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('API Key');
      // Should be masked - not show the full key
      expect(result.stdout).not.toContain('my-test-api-key-123');
      // Should show last 4 characters with masking
      expect(result.stdout).toMatch(/•+123/);
    });

    it('should_output_api_key_set_status_in_json', () => {
      const result = runCli('--json config set --endpoint https://test.cognitiveservices.azure.com --api-key test-key');

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as { success: boolean; apiKeySet: boolean };
      expect(output.success).toBe(true);
      expect(output.apiKeySet).toBe(true);
    });

    it('should_allow_setting_endpoint_only_without_api_key', () => {
      const result = runCli('config set --endpoint https://test.cognitiveservices.azure.com');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration saved');
      expect(result.stdout).not.toContain('API Key');
    });
  });

  describe('cu config unset api-key', () => {
    it('should_remove_api_key_from_profile', () => {
      // First set up config with API key
      runCli('config set --endpoint https://test.cognitiveservices.azure.com --api-key my-key');
      
      const result = runCli('config unset api-key');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('removed');
      
      // Verify it's gone
      const showResult = runCli('config show');
      expect(showResult.stdout).not.toContain('API Key');
    });

    it('should_remove_api_key_from_named_profile', () => {
      // Set up named profile with API key
      runCli('config set --endpoint https://test.cognitiveservices.azure.com --api-key my-key -n myprofile');
      
      const result = runCli('config unset api-key --name myprofile');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('myprofile');
    });

    it('should_succeed_even_if_no_api_key_was_set', () => {
      // Set up config without API key
      runCli('config set --endpoint https://test.cognitiveservices.azure.com');
      
      const result = runCli('config unset api-key');

      expect(result.exitCode).toBe(0);
    });

    it('should_fail_when_profile_not_found', () => {
      const result = runCli('config unset api-key --name nonexistent');

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('not found');
    });

    it('should_output_json_when_json_flag_provided', () => {
      runCli('config set --endpoint https://test.cognitiveservices.azure.com --api-key my-key');
      
      const result = runCli('--json config unset api-key');

      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as { success: boolean; profile: string };
      expect(output.success).toBe(true);
    });

    it('should_show_unset_in_help', () => {
      const result = runCli('config unset --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('api-key');
    });
  });
});
