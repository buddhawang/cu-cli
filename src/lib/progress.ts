/**
 * Progress indicator utilities for CLI operations.
 * Provides spinner, progress bar, and status updates for long-running operations.
 */

/**
 * Spinner frames for animated progress indicator.
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Progress indicator state.
 */
interface ProgressState {
  /** Current message */
  message: string;
  /** Whether the indicator is active */
  isActive: boolean;
  /** Current frame index */
  frameIndex: number;
  /** Interval timer */
  timer: ReturnType<typeof setInterval> | null;
  /** Start time for elapsed calculation */
  startTime: number;
}

/**
 * Creates a spinner progress indicator.
 * Writes to stderr to not interfere with stdout data output.
 */
export function createSpinner(): {
  start: (message: string) => void;
  update: (message: string) => void;
  succeed: (message: string) => void;
  fail: (message: string) => void;
  stop: () => void;
  isActive: () => boolean;
} {
  const state: ProgressState = {
    message: '',
    isActive: false,
    frameIndex: 0,
    timer: null,
    startTime: 0,
  };

  // Check if we're in a TTY (interactive terminal)
  const isTTY = process.stderr.isTTY ?? false;

  const clearLine = (): void => {
    if (isTTY) {
      process.stderr.write('\r\x1b[K');
    }
  };

  const render = (): void => {
    if (!state.isActive) return;

    clearLine();
    const frame = SPINNER_FRAMES[state.frameIndex];
    const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
    process.stderr.write(`${frame} ${state.message} (${elapsed}s)`);

    state.frameIndex = (state.frameIndex + 1) % SPINNER_FRAMES.length;
  };

  return {
    start(message: string): void {
      if (state.isActive) {
        this.stop();
      }

      state.message = message;
      state.isActive = true;
      state.frameIndex = 0;
      state.startTime = Date.now();

      if (isTTY) {
        render();
        state.timer = setInterval(render, 80);
      } else {
        // Non-TTY: just print the message once
        process.stderr.write(`${message}...\n`);
      }
    },

    update(message: string): void {
      state.message = message;
      if (!isTTY && state.isActive) {
        process.stderr.write(`${message}...\n`);
      }
    },

    succeed(message: string): void {
      this.stop();
      const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
      if (isTTY) {
        process.stderr.write(`\r\x1b[K✓ ${message} (${elapsed}s)\n`);
      } else {
        process.stderr.write(`✓ ${message} (${elapsed}s)\n`);
      }
    },

    fail(message: string): void {
      this.stop();
      const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
      if (isTTY) {
        process.stderr.write(`\r\x1b[K✗ ${message} (${elapsed}s)\n`);
      } else {
        process.stderr.write(`✗ ${message} (${elapsed}s)\n`);
      }
    },

    stop(): void {
      if (state.timer !== null) {
        clearInterval(state.timer);
        state.timer = null;
      }
      if (isTTY && state.isActive) {
        clearLine();
      }
      state.isActive = false;
    },

    isActive(): boolean {
      return state.isActive;
    },
  };
}

/**
 * Progress bar for operations with known progress.
 */
export function createProgressBar(total: number, width = 30): {
  update: (current: number, message?: string) => void;
  complete: (message?: string) => void;
} {
  const isTTY = process.stderr.isTTY ?? false;
  let lastRendered = -1;

  return {
    update(current: number, message?: string): void {
      const percent = Math.min(100, Math.floor((current / total) * 100));

      // Only re-render if percent changed (avoid flicker)
      if (percent === lastRendered) return;
      lastRendered = percent;

      const filled = Math.floor((percent / 100) * width);
      const empty = width - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);

      if (isTTY) {
        const msg = message !== undefined && message !== '' ? ` ${message}` : '';
        process.stderr.write(`\r\x1b[K[${bar}] ${percent}%${msg}`);
      } else if (percent % 25 === 0) {
        // Non-TTY: print at 0%, 25%, 50%, 75%, 100%
        process.stderr.write(`Progress: ${percent}%\n`);
      }
    },

    complete(message?: string): void {
      const bar = '█'.repeat(width);
      const msg = message ?? 'Complete';
      if (isTTY) {
        process.stderr.write(`\r\x1b[K[${bar}] 100% ${msg}\n`);
      } else {
        process.stderr.write(`Progress: 100% - ${msg}\n`);
      }
    },
  };
}

/**
 * Simple status logger for non-interactive feedback.
 */
export const status = {
  info(message: string): void {
    process.stderr.write(`ℹ ${message}\n`);
  },

  success(message: string): void {
    process.stderr.write(`✓ ${message}\n`);
  },

  warning(message: string): void {
    process.stderr.write(`⚠ ${message}\n`);
  },

  error(message: string): void {
    process.stderr.write(`✗ ${message}\n`);
  },

  debug(message: string): void {
    if (process.env['CU_DEBUG'] === '1' || process.env['CU_VERBOSE'] === '1') {
      process.stderr.write(`[DEBUG] ${message}\n`);
    }
  },
};

/**
 * Wraps an async operation with a spinner.
 * @param message - Message to display while operation is in progress
 * @param operation - Async operation to execute
 * @param successMessage - Optional success message (defaults to original message)
 * @returns Result of the operation
 */
export async function withSpinner<T>(message: string, operation: () => Promise<T>, successMessage?: string): Promise<T> {
  const spinner = createSpinner();
  spinner.start(message);

  try {
    const result = await operation();
    spinner.succeed(successMessage ?? message);
    return result;
  } catch (error) {
    spinner.fail(message);
    throw error;
  }
}
