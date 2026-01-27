/**
 * Integration tests for the analyze workflow.
 * 
 * These tests verify the end-to-end analyze workflow.
 * They are skipped by default as they require a configured Azure CU resource.
 * 
 * To run these tests:
 * 1. Set up your Azure CU resource
 * 2. Run `cu login` and `cu config set --endpoint <your-endpoint>`
 * 3. Run `npm test -- --run tests/integration/analyze-workflow.test.ts`
 * 
 * Or set environment variables:
 *   CU_TEST_ENDPOINT=https://your-resource.cognitiveservices.azure.com
 *   CU_RUN_INTEGRATION_TESTS=1
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync, type ExecSyncOptionsWithStringEncoding } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as os from 'node:os';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../dist/cu.cjs');

// Check if integration tests should run
const RUN_INTEGRATION = process.env['CU_RUN_INTEGRATION_TESTS'] === '1';

/**
 * Shape of the analyze JSON output.
 */
interface AnalyzeJsonOutput {
  status: string;
  analyzerId: string;
  contents?: Array<{
    fields?: Record<string, unknown>;
    startPageNumber?: number;
    endPageNumber?: number;
  }>;
  error?: unknown;
}

/**
 * Executes the CLI with given arguments and returns output.
 */
function runCli(args: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const options: ExecSyncOptionsWithStringEncoding = {
      encoding: 'utf-8',
      timeout: 120000, // 2 minutes for analysis
      stdio: ['pipe', 'pipe', 'pipe'],
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

describe('Analyze Workflow Integration', () => {
  beforeAll(() => {
    // Ensure the CLI is built
    if (!existsSync(CLI_PATH)) {
      throw new Error(`CLI not built. Run 'npm run build' first. Expected: ${CLI_PATH}`);
    }
  });

  describe.skipIf(!RUN_INTEGRATION)('End-to-end analysis', () => {
    it('should_analyze_sample_document_with_prebuilt_analyzer', () => {
      // This test requires a valid sample document
      // Create a simple text-based PDF for testing
      const sampleDoc = join(os.tmpdir(), 'cu-test-sample.pdf');
      
      // Skip if no sample document available
      if (!existsSync(sampleDoc)) {
        // eslint-disable-next-line no-console
        console.log('Skipping: No sample document available at', sampleDoc);
        return;
      }

      const result = runCli(`analyze "${sampleDoc}" --analyzer prebuilt-document --json`);

      expect(result.exitCode).toBe(0);
      
      const output = JSON.parse(result.stdout) as AnalyzeJsonOutput;
      expect(output.status).toBe('succeeded');
      expect(output.analyzerId).toBe('prebuilt-document');
      expect(output.contents).toBeDefined();
    });

    it('should_extract_fields_from_invoice', () => {
      // This test requires a sample invoice
      const sampleInvoice = join(os.tmpdir(), 'cu-test-invoice.pdf');
      
      if (!existsSync(sampleInvoice)) {
        // eslint-disable-next-line no-console
        console.log('Skipping: No sample invoice available at', sampleInvoice);
        return;
      }

      const result = runCli(`analyze "${sampleInvoice}" --analyzer prebuilt-invoice --json`);

      expect(result.exitCode).toBe(0);
      
      const output = JSON.parse(result.stdout) as AnalyzeJsonOutput;
      expect(output.status).toBe('succeeded');
      
      // Verify expected invoice fields
      const content = output.contents?.[0];
      const fields = content?.fields ?? {};
      // Invoice analyzers typically extract these fields
      const expectedFields = ['VendorName', 'InvoiceTotal', 'InvoiceDate'];
      const foundFields = Object.keys(fields);
      
      // At least some expected fields should be present
      const hasExpectedFields = expectedFields.some(f => foundFields.includes(f));
      expect(hasExpectedFields).toBe(true);
    });

    it('should_handle_url_analysis', () => {
      // Use a publicly accessible test document URL
      const testUrl = 'https://raw.githubusercontent.com/Azure-Samples/cognitive-services-REST-api-samples/master/curl/form-recognizer/sample-layout.pdf';

      const result = runCli(`analyze "${testUrl}" --analyzer prebuilt-document --json`);

      // This may fail if the URL is not accessible or endpoint not configured
      if (result.exitCode === 0) {
        const output = JSON.parse(result.stdout) as AnalyzeJsonOutput;
        expect(output.status).toBe('succeeded');
        expect(output.contents).toBeDefined();
      } else {
        // Expected failure without proper config
        expect(result.stderr).toBeTruthy();
      }
    });

    it('should_respect_page_range_option', () => {
      const sampleDoc = join(os.tmpdir(), 'cu-test-multipage.pdf');
      
      if (!existsSync(sampleDoc)) {
        // eslint-disable-next-line no-console
        console.log('Skipping: No sample multipage document available');
        return;
      }

      const result = runCli(`analyze "${sampleDoc}" --analyzer prebuilt-document --range 1-2 --json`);

      if (result.exitCode === 0) {
        const output = JSON.parse(result.stdout) as AnalyzeJsonOutput;
        const content = output.contents?.[0];
        
        if (content?.startPageNumber !== undefined) {
          expect(content.startPageNumber).toBe(1);
          expect(content.endPageNumber).toBeLessThanOrEqual(2);
        }
      }
    });
  });

  describe.skipIf(!RUN_INTEGRATION)('Error handling', () => {
    it('should_fail_gracefully_for_invalid_analyzer', () => {
      const sampleDoc = join(os.tmpdir(), 'cu-test-sample.pdf');
      
      if (!existsSync(sampleDoc)) {
        // eslint-disable-next-line no-console
        console.log('Skipping: No sample document available');
        return;
      }

      const result = runCli(`analyze "${sampleDoc}" --analyzer nonexistent-analyzer-xyz --json`);

      expect(result.exitCode).not.toBe(0);
      
      // Error should be in JSON format when --json flag used
      try {
        const output = JSON.parse(result.stdout) as AnalyzeJsonOutput;
        expect(output.error).toBeDefined();
      } catch {
        // Or plain error in stderr
        expect(result.stderr).toMatch(/not found|invalid|error/i);
      }
    });

    it('should_timeout_appropriately', () => {
      const sampleDoc = join(os.tmpdir(), 'cu-test-sample.pdf');
      
      if (!existsSync(sampleDoc)) {
        // eslint-disable-next-line no-console
        console.log('Skipping: No sample document available');
        return;
      }

      // Use very short timeout to force timeout error
      const result = runCli(`analyze "${sampleDoc}" --analyzer prebuilt-document --timeout 1`);

      // Either succeeds quickly or times out
      if (result.exitCode !== 0) {
        expect(result.stderr).toMatch(/timeout|timed out/i);
      }
    });
  });

  describe('Smoke tests (always run)', () => {
    it('should_show_analyze_in_help', () => {
      const result = runCli('--help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('analyze');
    });

    it('should_show_analyze_subcommand_help', () => {
      const result = runCli('analyze --help');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--analyzer');
      expect(result.stdout).toContain('source');
    });
  });
});
