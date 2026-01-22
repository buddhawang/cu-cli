/**
 * Table output formatter.
 * Provides ASCII table formatting for CLI output.
 */

import type { OutputFormatter, TableColumn, TableOptions } from './index.js';

/**
 * Table formatter implementation.
 */
export class TableFormatter<T> implements OutputFormatter<T[]> {
  private readonly columns: TableColumn<T>[];
  private readonly borders: boolean;
  private readonly emptyMessage: string;

  constructor(options: TableOptions<T>) {
    this.columns = options.columns;
    this.borders = options.borders ?? false;
    this.emptyMessage = options.emptyMessage ?? 'No data available';
  }

  /**
   * Gets the value from a data item for a column.
   */
  private getValue(item: T, column: TableColumn<T>): string {
    let value: unknown;

    if (typeof column.accessor === 'function') {
      value = column.accessor(item);
    } else {
      value = item[column.accessor];
    }

    if (value === null || value === undefined) {
      return '-';
    }

    return String(value);
  }

  /**
   * Pads a string to the specified width.
   */
  private pad(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
    const padding = width - text.length;
    if (padding <= 0) {
      return text.slice(0, width);
    }

    switch (align) {
      case 'right':
        return ' '.repeat(padding) + text;
      case 'center': {
        const left = Math.floor(padding / 2);
        const right = padding - left;
        return ' '.repeat(left) + text + ' '.repeat(right);
      }
      default:
        return text + ' '.repeat(padding);
    }
  }

  /**
   * Calculates column widths based on content.
   */
  private calculateWidths(data: T[]): number[] {
    return this.columns.map((column, _index) => {
      // Start with header width
      let maxWidth = column.header.length;

      // Check all data values
      for (const item of data) {
        const value = this.getValue(item, column);
        maxWidth = Math.max(maxWidth, value.length);
      }

      // Apply column width constraint if specified
      if (column.width !== undefined) {
        return Math.min(maxWidth, column.width);
      }

      // Cap at reasonable max width
      return Math.min(maxWidth, 50);
    });
  }

  /**
   * Formats data as an ASCII table.
   * @param data - Array of data items
   * @returns Formatted table string
   */
  format(data: T[]): string {
    if (data.length === 0) {
      return this.emptyMessage;
    }

    const widths = this.calculateWidths(data);
    const lines: string[] = [];

    if (this.borders) {
      // Top border
      lines.push('┌' + widths.map((w) => '─'.repeat(w + 2)).join('┬') + '┐');
    }

    // Header row
    const headerCells = this.columns.map((col, i) => this.pad(col.header, widths[i] ?? 0, 'left'));

    if (this.borders) {
      lines.push('│ ' + headerCells.join(' │ ') + ' │');
      lines.push('├' + widths.map((w) => '─'.repeat(w + 2)).join('┼') + '┤');
    } else {
      lines.push(headerCells.join('  '));
      lines.push(widths.map((w) => '─'.repeat(w)).join('  '));
    }

    // Data rows
    for (const item of data) {
      const cells = this.columns.map((col, colIndex) => {
        const value = this.getValue(item, col);
        return this.pad(value, widths[colIndex] ?? 0, col.align ?? 'left');
      });

      if (this.borders) {
        lines.push('│ ' + cells.join(' │ ') + ' │');
      } else {
        lines.push(cells.join('  '));
      }
    }

    if (this.borders) {
      // Bottom border
      lines.push('└' + widths.map((w) => '─'.repeat(w + 2)).join('┴') + '┘');
    }

    return lines.join('\n');
  }
}

/**
 * Creates a table formatter with the specified options.
 */
export function createTableFormatter<T>(options: TableOptions<T>): OutputFormatter<T[]> {
  return new TableFormatter<T>(options);
}

/**
 * Simple helper to create a table from an array of objects.
 * Automatically detects columns from the first object.
 */
export function autoTable<T extends Record<string, unknown>>(data: T[], options?: Partial<TableOptions<T>>): string {
  if (data.length === 0) {
    return options?.emptyMessage ?? 'No data available';
  }

  // Get all keys from first object
  const keys = Object.keys(data[0] ?? {}) as (keyof T)[];

  const columns: TableColumn<T>[] = keys.map((key) => ({
    header: formatHeader(String(key)),
    accessor: key,
  }));

  const formatter = new TableFormatter<T>({
    columns,
    ...options,
  });

  return formatter.format(data);
}

/**
 * Formats a camelCase or snake_case key as a readable header.
 */
function formatHeader(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1') // camelCase to spaces
    .replace(/_/g, ' ') // snake_case to spaces
    .replace(/^\s/, '') // trim leading space
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
