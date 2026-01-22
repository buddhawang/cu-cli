/**
 * JSON output formatter.
 * Provides consistent JSON formatting for CLI output.
 */

import type { OutputFormatter } from './index.js';

/**
 * Options for JSON formatting.
 */
export interface JsonFormatterOptions {
  /** Number of spaces for indentation (default: 2) */
  indent?: number;
  /** Whether to output compact (no whitespace) JSON */
  compact?: boolean;
}

/**
 * JSON formatter implementation.
 */
export class JsonFormatter<T = unknown> implements OutputFormatter<T> {
  private readonly indent: number;
  private readonly compact: boolean;

  constructor(options: JsonFormatterOptions = {}) {
    this.indent = options.indent ?? 2;
    this.compact = options.compact ?? false;
  }

  /**
   * Formats data as JSON string.
   * @param data - Data to format
   * @returns JSON string
   */
  format(data: T): string {
    if (this.compact) {
      return JSON.stringify(data);
    }
    return JSON.stringify(data, null, this.indent);
  }
}

/**
 * Creates a JSON formatter with default options.
 */
export function createJsonFormatter<T = unknown>(options?: JsonFormatterOptions): OutputFormatter<T> {
  return new JsonFormatter<T>(options);
}
