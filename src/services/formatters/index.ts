/**
 * Output formatter interfaces and registry.
 * Provides consistent output formatting across all CLI commands.
 */

/**
 * Supported output formats.
 */
export type OutputFormat = 'json' | 'table' | 'markdown' | 'overlay';

/**
 * Base interface for output formatters.
 */
export interface OutputFormatter<T = unknown> {
  /**
   * Formats the data for output.
   * @param data - The data to format
   * @returns Formatted string for output
   */
  format(data: T): string;
}

/**
 * Options for table formatting.
 */
export interface TableColumn<T> {
  /** Column header text */
  header: string;
  /** Key or accessor function to get value from data */
  accessor: keyof T | ((item: T) => string | number | boolean | null | undefined);
  /** Optional width (for fixed-width tables) */
  width?: number;
  /** Text alignment */
  align?: 'left' | 'right' | 'center';
}

/**
 * Options for table formatter.
 */
export interface TableOptions<T> {
  /** Column definitions */
  columns: TableColumn<T>[];
  /** Whether to show row borders */
  borders?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * Creates a type-safe formatter factory.
 */
export interface FormatterFactory {
  json: <T>() => OutputFormatter<T>;
  table: <T>(options: TableOptions<T>) => OutputFormatter<T[]>;
}

/**
 * Gets the output format from CLI options.
 * @param options - CLI options object
 * @param defaultFormat - Default format if none specified
 * @returns The output format to use
 */
export function getOutputFormat(
  options: { json?: boolean; format?: string },
  defaultFormat: OutputFormat = 'table'
): OutputFormat {
  if (options.json === true) {
    return 'json';
  }
  if (options.format !== undefined && options.format !== '' && isValidFormat(options.format)) {
    return options.format;
  }
  return defaultFormat;
}

/**
 * Validates if a string is a valid output format.
 */
export function isValidFormat(format: string): format is OutputFormat {
  return ['json', 'table', 'markdown', 'overlay'].includes(format);
}

/**
 * Writes formatted output to stdout.
 * @param data - Data to output
 * @param formatter - Formatter to use
 */
export function output<T>(data: T, formatter: OutputFormatter<T>): void {
  process.stdout.write(formatter.format(data) + '\n');
}

// Re-export formatters for convenience
export { JsonFormatter } from './json.js';
export { TableFormatter } from './table.js';
