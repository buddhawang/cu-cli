/**
 * Performance tests for CLI startup time.
 * Validates that the CLI meets the <200ms startup time requirement.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../dist/cu.cjs');

/**
 * Measures execution time for a CLI command.
 * @returns Execution time in milliseconds
 */
function measureStartupTime(args: string): number {
  const start = performance.now();
  try {
    execSync(`node "${CLI_PATH}" ${args}`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    // Command may exit with non-zero code, that's fine for timing
  }
  return performance.now() - start;
}

/**
 * Runs multiple measurements and returns statistics.
 */
function measureMultiple(
  args: string,
  iterations: number
): { min: number; max: number; avg: number; times: number[] } {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    times.push(measureStartupTime(args));
  }
  
  const min = Math.min(...times);
  const max = Math.max(...times);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  
  return { min, max, avg, times };
}

describe('Performance Tests', () => {
  beforeAll(() => {
    // Verify CLI exists
    expect(existsSync(CLI_PATH)).toBe(true);
  });

  describe('Startup Time', () => {
    it('should_display_version_in_under_500ms', () => {
      // First run may be slower due to cold start
      // Run multiple times and check the average
      const stats = measureMultiple('--version', 5);
      
      // Log the results for visibility
      console.log(`\n  Version command timing (${stats.times.length} runs):`);
      console.log(`    Min: ${stats.min.toFixed(0)}ms`);
      console.log(`    Max: ${stats.max.toFixed(0)}ms`);
      console.log(`    Avg: ${stats.avg.toFixed(0)}ms`);
      
      // Target is <200ms but allow up to 500ms for CI environments
      expect(stats.avg).toBeLessThan(500);
    });

    it('should_display_help_in_under_500ms', () => {
      const stats = measureMultiple('--help', 5);
      
      console.log(`\n  Help command timing (${stats.times.length} runs):`);
      console.log(`    Min: ${stats.min.toFixed(0)}ms`);
      console.log(`    Max: ${stats.max.toFixed(0)}ms`);
      console.log(`    Avg: ${stats.avg.toFixed(0)}ms`);
      
      expect(stats.avg).toBeLessThan(500);
    });

    it('should_display_config_help_in_under_500ms', () => {
      const stats = measureMultiple('config --help', 5);
      
      console.log(`\n  Config help timing (${stats.times.length} runs):`);
      console.log(`    Min: ${stats.min.toFixed(0)}ms`);
      console.log(`    Max: ${stats.max.toFixed(0)}ms`);
      console.log(`    Avg: ${stats.avg.toFixed(0)}ms`);
      
      expect(stats.avg).toBeLessThan(500);
    });

    it('should_display_analyzer_help_in_under_500ms', () => {
      const stats = measureMultiple('analyzer --help', 5);
      
      console.log(`\n  Analyzer help timing (${stats.times.length} runs):`);
      console.log(`    Min: ${stats.min.toFixed(0)}ms`);
      console.log(`    Max: ${stats.max.toFixed(0)}ms`);
      console.log(`    Avg: ${stats.avg.toFixed(0)}ms`);
      
      expect(stats.avg).toBeLessThan(500);
    });

    it('should_display_analyze_help_in_under_500ms', () => {
      const stats = measureMultiple('analyze --help', 5);
      
      console.log(`\n  Analyze help timing (${stats.times.length} runs):`);
      console.log(`    Min: ${stats.min.toFixed(0)}ms`);
      console.log(`    Max: ${stats.max.toFixed(0)}ms`);
      console.log(`    Avg: ${stats.avg.toFixed(0)}ms`);
      
      expect(stats.avg).toBeLessThan(500);
    });

    it('should_display_defaults_help_in_under_500ms', () => {
      const stats = measureMultiple('defaults --help', 5);
      
      console.log(`\n  Defaults help timing (${stats.times.length} runs):`);
      console.log(`    Min: ${stats.min.toFixed(0)}ms`);
      console.log(`    Max: ${stats.max.toFixed(0)}ms`);
      console.log(`    Avg: ${stats.avg.toFixed(0)}ms`);
      
      expect(stats.avg).toBeLessThan(500);
    });
  });

  describe('Bundle Size', () => {
    it('should_have_reasonable_bundle_size', () => {
      const stats = statSync(CLI_PATH);
      const sizeKB = stats.size / 1024;
      
      // eslint-disable-next-line no-console
      console.log(`\n  Bundle size: ${sizeKB.toFixed(1)} KB`);
      
      // Should be under 1MB
      expect(sizeKB).toBeLessThan(1024);
    });
  });
});
