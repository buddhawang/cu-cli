/**
 * Contract tests for cu analyze command.
 * Verifies the CLI contract for document analysis.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
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
const TEST_DIR = path.join(os.tmpdir(), `cu-analyze-test-${process.pid}`);
const CONFIG_DIR = path.join(TEST_DIR, '.cu');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const SAMPLE_FILE = path.join(TEST_DIR, 'sample.pdf');

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

describe('cu analyze Contract', () => {
  beforeAll(() => {
    // Ensure the CLI is built
    if (!existsSync(CLI_PATH)) {
      throw new Error(`CLI not built. Run 'npm run build' first. Expected: ${CLI_PATH}`);
    }
  });

  beforeEach(() => {
    // Create fresh test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(CONFIG_DIR, { recursive: true });

    // Create a minimal sample PDF (just header bytes for testing)
    // Real PDF would need valid content; we're testing CLI behavior
    writeFileSync(SAMPLE_FILE, Buffer.from('%PDF-1.4\n'));
  });

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('cu analyze --help', () => {
    it('should_display_help_text', () => {
      const result = runCli('analyze --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Analyze a document');
      expect(result.stdout).toContain('--analyzer');
      expect(result.stdout).toContain('--range');
      expect(result.stdout).toContain('--timeout');
    });

    it('should_show_analyzer_option_as_required', () => {
      const result = runCli('analyze --help');

      expect(result.stdout).toContain('-a, --analyzer');
      // Commander marks required options with <id> syntax rather than "required" text
      expect(result.stdout).toContain('--analyzer <id>');
    });
  });

  describe('cu analyze (missing arguments)', () => {
    it('should_error_when_no_source_provided', () => {
      const result = runCli('analyze --analyzer prebuilt-document');

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("missing required argument 'source'");
    });

    it('should_error_when_analyzer_not_specified', () => {
      const result = runCli(`analyze "${SAMPLE_FILE}"`);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('--analyzer');
    });
  });

  describe('cu analyze (config validation)', () => {
    it('should_error_when_not_configured', () => {
      // No config file exists
      const result = runCli(`analyze "${SAMPLE_FILE}" --analyzer prebuilt-document`);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/configuration|config/i);
    });
  });

  describe('cu analyze (file validation)', () => {
    beforeEach(() => {
      // Set up config for these tests
      writeFileSync(CONFIG_FILE, JSON.stringify({
        version: '1',
        activeProfile: 'test',
        profiles: {
          test: {
            endpoint: 'https://test-resource.cognitiveservices.azure.com',
          },
        },
      }));
    });

    it('should_error_when_file_not_found', () => {
      const result = runCli('analyze /nonexistent/file.pdf --analyzer prebuilt-document');

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/not found|file/i);
    });

    it('should_error_for_unsupported_file_type', () => {
      const unsupportedFile = path.join(TEST_DIR, 'video.mp4');
      writeFileSync(unsupportedFile, 'fake video content');

      const result = runCli(`analyze "${unsupportedFile}" --analyzer prebuilt-document`);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/unsupported|file type/i);
    });
  });

  describe('cu analyze --json (output format)', () => {
    beforeEach(() => {
      // Set up config
      writeFileSync(CONFIG_FILE, JSON.stringify({
        version: '1',
        activeProfile: 'test',
        profiles: {
          test: {
            endpoint: 'https://test-resource.cognitiveservices.azure.com',
          },
        },
      }));
    });

    it('should_include_json_flag_in_help', () => {
      const result = runCli('--help');

      expect(result.stdout).toContain('--json');
    });
  });

  describe('cu analyze (timeout option)', () => {
    it('should_accept_timeout_option', () => {
      const result = runCli('analyze --help');

      expect(result.stdout).toContain('--timeout');
      expect(result.stdout).toContain('seconds');
    });
  });

  describe('cu analyze (range option)', () => {
    it('should_accept_range_option', () => {
      const result = runCli('analyze --help');

      expect(result.stdout).toContain('--range');
      expect(result.stdout).toContain('pages');
    });
  });
});

/**
 * Note: Full integration tests that actually call the Azure API
 * are in tests/integration/analyze-workflow.test.ts and require
 * valid Azure credentials and a configured endpoint.
 */
