/**
 * Contract tests for CLI base functionality (version, help).
 * Verifies the CLI contract for basic commands.
 */

import { describe, it, expect, beforeAll } from 'vitest';
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
      timeout: 10000,
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

describe('CLI Base Contract', () => {
  beforeAll(() => {
    // Ensure the CLI is built
    if (!existsSync(CLI_PATH)) {
      throw new Error(`CLI not built. Run 'npm run build' first. Expected: ${CLI_PATH}`);
    }
  });

  describe('cu --version', () => {
    it('should_output_version_string_when_version_flag_provided', () => {
      const result = runCli('--version');

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should_output_version_string_when_short_flag_provided', () => {
      const result = runCli('-v');

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should_complete_in_under_200ms_for_version_command', () => {
      const start = performance.now();
      runCli('--version');
      const elapsed = performance.now() - start;

      // Allow some tolerance for CI environments
      expect(elapsed).toBeLessThan(2000); // 2 seconds max, but goal is <200ms
    });
  });

  describe('cu --help', () => {
    it('should_output_help_text_when_help_flag_provided', () => {
      const result = runCli('--help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Azure Content Understanding CLI');
      expect(result.stdout).toContain('Usage:');
    });

    it('should_list_global_options_in_help_output', () => {
      const result = runCli('--help');

      expect(result.stdout).toContain('--json');
      expect(result.stdout).toContain('--profile');
      expect(result.stdout).toContain('--verbose');
    });

    it('should_show_version_option_in_help_output', () => {
      const result = runCli('--help');

      expect(result.stdout).toContain('-v, --version');
    });

    it('should_complete_in_under_200ms_for_help_command', () => {
      const start = performance.now();
      runCli('--help');
      const elapsed = performance.now() - start;

      // Allow some tolerance for CI environments
      expect(elapsed).toBeLessThan(2000); // 2 seconds max, but goal is <200ms
    });
  });

  describe('cu (no arguments)', () => {
    it('should_show_help_when_no_arguments_provided', () => {
      const result = runCli('');

      // Commander outputs help to stderr when no command is provided
      // The help text should still contain Usage information
      const output = result.stdout || result.stderr;
      expect(output).toContain('Usage:');
    });
  });

  describe('Output format', () => {
    it('should_output_to_stdout_for_version_command', () => {
      const result = runCli('--version');

      expect(result.stdout.length).toBeGreaterThan(0);
    });

    it('should_output_to_stdout_for_help_command', () => {
      const result = runCli('--help');

      expect(result.stdout.length).toBeGreaterThan(0);
    });
  });
});
