/**
 * Content Understanding API client.
 * Provides methods to interact with the Azure Content Understanding REST API.
 */

import {
  type Analyzer,
  type AnalyzerList,
  type AnalyzerField,
  type AnalyzerApiResponse,
  type AnalyzerListApiResponse,
  type AnalyzerFieldApiResponse,
  type FieldType,
  type FieldMethod,
  type ContentKind,
  type AnalyzerStatus,
} from '../models/analyzer.js';
import { getAuthService } from './auth.js';
import { getConfigService } from './config.js';
import { CliError, ErrorCodes } from '../lib/errors.js';

/**
 * API version for Azure Content Understanding.
 */
const API_VERSION = '2025-11-01';

/**
 * Error response from the API.
 */
interface ApiError {
  error: {
    code: string;
    message: string;
    target?: string;
    details?: Array<{ code: string; message: string }>;
  };
}

/**
 * Content Understanding API client for Azure CU resources.
 */
export class ContentUnderstandingClient {
  private endpoint: string;

  /**
   * Creates a ContentUnderstandingClient instance.
   * @param endpoint - The Azure CU resource endpoint
   */
  constructor(endpoint: string) {
    // Remove trailing slash if present
    this.endpoint = endpoint.replace(/\/$/, '');
  }

  /**
   * Acquires an access token for API calls.
   * @returns Access token string
   */
  private async getAccessToken(): Promise<string> {
    const authService = getAuthService();
    return authService.acquireTokenSilent();
  }

  /**
   * Makes an authenticated API request.
   * @param method - HTTP method
   * @param path - API path (without base URL)
   * @param body - Optional request body
   * @returns Parsed JSON response
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.endpoint}/contentunderstanding${path}${path.includes('?') ? '&' : '?'}api-version=${API_VERSION}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    // For 204 No Content responses
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Handles error responses from the API.
   * @param response - Fetch response object
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: ApiError | undefined;
    
    try {
      errorData = await response.json() as ApiError;
    } catch {
      // Response body is not JSON
    }

    const errorCode = errorData?.error?.code ?? 'UnknownError';
    const errorMessage = errorData?.error?.message ?? `HTTP ${response.status}: ${response.statusText}`;

    switch (response.status) {
      case 401:
        throw new CliError(
          ErrorCodes.AUTH_REQUIRED,
          'Authentication required',
          errorMessage,
          'Run `cu login` to authenticate',
          1
        );
      case 403:
        throw new CliError(
          ErrorCodes.AUTH_FAILED,
          'Access denied',
          errorMessage,
          'Check that you have permission to access this resource',
          1
        );
      case 404:
        throw new CliError(
          ErrorCodes.RESOURCE_NOT_FOUND,
          'Resource not found',
          errorMessage,
          'Verify the resource exists and check the ID',
          4
        );
      case 429:
        throw new CliError(
          ErrorCodes.API_RATE_LIMITED,
          'Rate limited',
          errorMessage,
          'Wait a moment and try again',
          5
        );
      case 500:
      case 502:
      case 503:
        throw new CliError(
          ErrorCodes.API_ERROR,
          'Service error',
          errorMessage,
          'The Azure service is experiencing issues. Try again later.',
          5
        );
      default:
        throw new CliError(
          ErrorCodes.API_ERROR,
          `API error: ${errorCode}`,
          errorMessage,
          'Check the error message and try again',
          7
        );
    }
  }

  /**
   * Converts an API response to an Analyzer object.
   * @param apiResponse - Raw API response
   * @returns Parsed Analyzer object
   */
  private parseAnalyzer(apiResponse: AnalyzerApiResponse): Analyzer {
    const analyzer: Analyzer = {
      id: apiResponse.analyzerId,
      description: apiResponse.description,
      status: this.parseAnalyzerStatus(apiResponse.status),
      createdAt: new Date(apiResponse.createdAt),
      modifiedAt: new Date(apiResponse.modifiedAt),
    };

    if (apiResponse.supportedContentKinds !== undefined) {
      analyzer.supportedContentKinds = apiResponse.supportedContentKinds
        .map(k => this.parseContentKind(k))
        .filter((k): k is ContentKind => k !== undefined);
    }

    if (apiResponse.baseAnalyzerId !== undefined) {
      analyzer.baseAnalyzerId = apiResponse.baseAnalyzerId;
    }

    if (apiResponse.fieldSchema !== undefined) {
      analyzer.fieldSchema = {
        name: apiResponse.fieldSchema.name,
        fields: this.parseFieldSchema(apiResponse.fieldSchema.fields),
      };
    }

    return analyzer;
  }

  /**
   * Parses analyzer status from API response.
   */
  private parseAnalyzerStatus(status: string): AnalyzerStatus {
    const validStatuses: AnalyzerStatus[] = ['creating', 'ready', 'failed', 'deleting'];
    if (validStatuses.includes(status as AnalyzerStatus)) {
      return status as AnalyzerStatus;
    }
    return 'ready'; // Default to ready for unknown statuses
  }

  /**
   * Parses content kind from API response.
   */
  private parseContentKind(kind: string): ContentKind | undefined {
    const validKinds: ContentKind[] = ['document', 'image', 'audio', 'video'];
    if (validKinds.includes(kind as ContentKind)) {
      return kind as ContentKind;
    }
    return undefined;
  }

  /**
   * Parses field schema from API response.
   */
  private parseFieldSchema(
    fields: Record<string, AnalyzerFieldApiResponse>
  ): Record<string, AnalyzerField> {
    const result: Record<string, AnalyzerField> = {};

    for (const [name, fieldApi] of Object.entries(fields)) {
      result[name] = this.parseField(name, fieldApi);
    }

    return result;
  }

  /**
   * Parses a single field from API response.
   */
  private parseField(name: string, fieldApi: AnalyzerFieldApiResponse): AnalyzerField {
    const field: AnalyzerField = {
      name,
      type: this.parseFieldType(fieldApi.type),
      method: this.parseFieldMethod(fieldApi.method),
    };

    if (fieldApi.description !== undefined) {
      field.description = fieldApi.description;
    }

    if (fieldApi.enum !== undefined) {
      field.enum = fieldApi.enum;
    }

    if (fieldApi.items !== undefined) {
      field.items = this.parseField('items', fieldApi.items);
    }

    if (fieldApi.fields !== undefined) {
      field.fields = this.parseFieldSchema(fieldApi.fields);
    }

    return field;
  }

  /**
   * Parses field type from API response.
   */
  private parseFieldType(type: string): FieldType {
    const validTypes: FieldType[] = ['string', 'number', 'integer', 'boolean', 'date', 'time', 'array', 'object'];
    if (validTypes.includes(type as FieldType)) {
      return type as FieldType;
    }
    return 'string'; // Default to string for unknown types
  }

  /**
   * Parses field method from API response.
   */
  private parseFieldMethod(method: string): FieldMethod {
    const validMethods: FieldMethod[] = ['extract', 'classify', 'generate'];
    if (validMethods.includes(method as FieldMethod)) {
      return method as FieldMethod;
    }
    return 'extract'; // Default to extract for unknown methods
  }

  /**
   * Lists all analyzers in the configured resource.
   * @returns Paginated list of analyzers
   */
  async listAnalyzers(): Promise<AnalyzerList> {
    const response = await this.request<AnalyzerListApiResponse>('GET', '/analyzers');

    return {
      value: response.value.map(a => this.parseAnalyzer(a)),
      nextLink: response.nextLink,
    };
  }

  /**
   * Gets details of a specific analyzer.
   * @param analyzerId - The analyzer identifier
   * @returns Analyzer details
   */
  async getAnalyzer(analyzerId: string): Promise<Analyzer> {
    const response = await this.request<AnalyzerApiResponse>(
      'GET',
      `/analyzers/${encodeURIComponent(analyzerId)}`
    );

    return this.parseAnalyzer(response);
  }
}

// Singleton instance
let clientInstance: ContentUnderstandingClient | null = null;

/**
 * Gets the ContentUnderstandingClient instance.
 * Uses the active profile's endpoint from configuration.
 * @returns ContentUnderstandingClient instance
 */
export function getContentUnderstandingClient(): ContentUnderstandingClient {
  const configService = getConfigService();
  const { profile } = configService.getActiveProfile();

  if (clientInstance === null || !isSameEndpoint(clientInstance, profile.endpoint)) {
    clientInstance = new ContentUnderstandingClient(profile.endpoint);
  }

  return clientInstance;
}

/**
 * Checks if the client is using the same endpoint.
 */
function isSameEndpoint(client: ContentUnderstandingClient, endpoint: string): boolean {
  // Access the private endpoint field using a workaround
  const clientEndpoint = (client as unknown as { endpoint: string }).endpoint;
  return clientEndpoint === endpoint.replace(/\/$/, '');
}

/**
 * Resets the singleton instance (for testing).
 */
export function resetContentUnderstandingClient(): void {
  clientInstance = null;
}
