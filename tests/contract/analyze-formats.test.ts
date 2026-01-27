/**
 * Contract tests for cu analyze --format options.
 * Validates that the analyze command correctly handles format, output, and force options.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, type ExecSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as os from 'node:os';
import * as path from 'node:path';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../dist/cu.cjs');

// Use a unique temp directory for this test file
const TEST_DIR = path.join(os.tmpdir(), `cu-analyze-formats-test-${process.pid}`);
const CONFIG_DIR = path.join(TEST_DIR, '.cu');

/**
 * Executes the CLI with given arguments and returns output.
 */
function runCli(args: string, env: Record<string, string> = {}): { stdout: string; stderr: string; exitCode: number } {
  try {
    const options: ExecSyncOptionsWithStringEncoding = {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CU_CONFIG_DIR: CONFIG_DIR,
        ...env,
      },
    };
    const stdout = execSync(`node "${CLI_PATH}" ${args}`, options);
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

describe('analyze --format options contract', () => {
  beforeAll(() => {
    // Check CLI exists
    if (!existsSync(CLI_PATH)) {
      throw new Error(`CLI not found at ${CLI_PATH}. Run 'npm run build' first.`);
    }
    // Create test directories
    mkdirSync(CONFIG_DIR, { recursive: true });
  });

  afterAll(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('--format option', () => {
    it('should_show_format_option_in_help', () => {
      const result = runCli('analyze --help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--format');
      expect(result.stdout).toContain('json');
      expect(result.stdout).toContain('table');
      expect(result.stdout).toContain('overlay');
    });

    it('should_require_output_for_overlay_format', () => {
      // Create a sample image file
      const sampleFile = path.join(TEST_DIR, 'sample.jpg');
      writeFileSync(sampleFile, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])); // JPEG magic bytes

      const result = runCli(`analyze "${sampleFile}" --analyzer prebuilt-document --format overlay`);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--output');
    });

    it('should_require_local_file_for_overlay_format', () => {
      const outputFile = path.join(TEST_DIR, 'output.png');
      const result = runCli(`analyze "https://example.com/doc.pdf" --analyzer prebuilt-document --format overlay --output "${outputFile}"`);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('local image file');
    });

    it('should_reject_invalid_format', () => {
      const result = runCli('analyze "https://example.com/doc.pdf" --analyzer prebuilt-document --format xml');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid format');
    });
  });

  describe('--output option', () => {
    it('should_show_output_option_in_help', () => {
      const result = runCli('analyze --help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--output');
      expect(result.stdout).toContain('-o');
    });
  });

  describe('--force option', () => {
    it('should_show_force_option_in_help', () => {
      const result = runCli('analyze --help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--force');
    });
  });
});
