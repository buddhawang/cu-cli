/**
 * Custom error types for the cu-cli application.
 * All CLI errors follow the what/why/how pattern for user-friendly messages.
 */

/**
 * Base error class for CLI operations.
 * Provides structured error information with remediation guidance.
 */
export class CliError extends Error {
  /**
   * Creates a new CLI error with full context.
   * @param code - Machine-readable error code (e.g., "AUTH_REQUIRED")
   * @param message - What happened (brief description)
   * @param why - Why it happened (context/reason)
   * @param fix - How to fix it (remediation steps)
   * @param exitCode - Process exit code (default: 1)
   */
  constructor(
    public readonly code: string,
    message: string,
    public readonly why: string,
    public readonly fix: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = 'CliError';
    // Maintains proper stack trace for where error was thrown (V8 engines)
    Error.captureStackTrace?.(this, CliError);
  }

  /**
   * Formats the error for display to the user.
   * Uses the what/why/how pattern for clear communication.
   */
  format(): string {
    return [
      `Error: ${this.message}`,
      ``,
      `Why: ${this.why}`,
      ``,
      `Fix: ${this.fix}`,
    ].join('\n');
  }

  /**
   * Returns a JSON representation of the error.
   */
  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      why: this.why,
      fix: this.fix,
      exitCode: this.exitCode,
    };
  }
}

/**
 * Error codes for common CLI error scenarios.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ErrorCodes = {
  // Authentication errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_FAILED: 'AUTH_FAILED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Configuration errors
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  CONFIG_INVALID: 'CONFIG_INVALID',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  ENDPOINT_NOT_CONFIGURED: 'ENDPOINT_NOT_CONFIGURED',

  // Validation errors
  INVALID_URL: 'INVALID_URL',
  INVALID_FILE_PATH: 'INVALID_FILE_PATH',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',

  // API errors
  API_ERROR: 'API_ERROR',
  API_TIMEOUT: 'API_TIMEOUT',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

  // Analysis errors
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  ANALYZER_NOT_FOUND: 'ANALYZER_NOT_FOUND',

  // Model errors
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  MODEL_DEPLOYMENT_FAILED: 'MODEL_DEPLOYMENT_FAILED',

  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  OPERATION_CANCELLED: 'OPERATION_CANCELLED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Factory functions for common error scenarios.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const Errors = {
  authRequired: (): CliError =>
    new CliError(
      ErrorCodes.AUTH_REQUIRED,
      'Authentication required',
      'No cached credentials found or session expired',
      'Sign in to Azure:\n     $ cu login'
    ),

  configNotFound: (): CliError =>
    new CliError(
      ErrorCodes.CONFIG_NOT_FOUND,
      'Configuration not found',
      'No configuration file exists at ~/.cu/config.json',
      'Set up your configuration:\n     $ cu config set --endpoint <url>'
    ),

  profileNotFound: (profile: string): CliError =>
    new CliError(
      ErrorCodes.PROFILE_NOT_FOUND,
      `Profile "${profile}" not found`,
      'The specified profile does not exist in the configuration',
      `List available profiles:\n     $ cu config list\n   Or create a new profile:\n     $ cu config set --profile ${profile} --endpoint <url>`
    ),

  endpointNotConfigured: (): CliError =>
    new CliError(
      ErrorCodes.ENDPOINT_NOT_CONFIGURED,
      'Endpoint not configured',
      'No Azure CU endpoint is configured for the active profile',
      'Set your endpoint:\n     $ cu config set --endpoint <url>'
    ),

  invalidUrl: (url: string): CliError =>
    new CliError(
      ErrorCodes.INVALID_URL,
      `Invalid URL: ${url}`,
      'The URL must be a valid HTTPS URL',
      'Provide a valid Azure CU endpoint:\n     https://<resource-name>.cognitiveservices.azure.com'
    ),

  invalidFilePath: (path: string): CliError =>
    new CliError(
      ErrorCodes.INVALID_FILE_PATH,
      `Invalid file path: ${path}`,
      'The file path contains invalid characters or format',
      'Provide a valid file path to an existing file'
    ),

  fileNotFound: (path: string): CliError =>
    new CliError(
      ErrorCodes.FILE_NOT_FOUND,
      `File not found: ${path}`,
      'The specified file does not exist',
      'Check the file path and try again'
    ),

  apiError: (message: string, code?: string): CliError =>
    new CliError(
      ErrorCodes.API_ERROR,
      message,
      `Azure CU API returned an error${code !== undefined && code !== '' ? ` (${code})` : ''}`,
      'Check your request and try again. Use --verbose for more details.'
    ),

  analyzerNotFound: (analyzerId: string): CliError =>
    new CliError(
      ErrorCodes.ANALYZER_NOT_FOUND,
      `Analyzer "${analyzerId}" not found`,
      'The specified analyzer does not exist in the configured resource',
      'List available analyzers:\n     $ cu analyzer list'
    ),

  operationCancelled: (): CliError =>
    new CliError(
      ErrorCodes.OPERATION_CANCELLED,
      'Operation cancelled',
      'The operation was cancelled by the user',
      'Run the command again to retry'
    ),
};
