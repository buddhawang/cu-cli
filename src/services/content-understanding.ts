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
import {
  type AnalysisResult,
  type AnalysisOperation,
  type AnalyzeRequest,
  type AnalyzedContent,
  type ExtractedField,
  type DetectedTable,
  type DetectedFigure,
  type TableCell,
  type AnalysisUsage,
  type AnalysisError,
  type OperationStatus,
  type AnalysisOperationApiResponse,
  type AnalyzedContentApiResponse,
  type ExtractedFieldApiResponse,
  type DetectedTableApiResponse,
  type DetectedFigureApiResponse,
} from '../models/analysis-result.js';
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
      description: apiResponse.description ?? "",
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

    if (apiResponse.fieldSchema !== undefined && apiResponse.fieldSchema !== null) {
      analyzer.fieldSchema = {
        name: apiResponse.fieldSchema.name,
        fields: apiResponse.fieldSchema.fields !== undefined && apiResponse.fieldSchema.fields !== null
          ? this.parseFieldSchema(apiResponse.fieldSchema.fields)
          : {},
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
    fields: Record<string, AnalyzerFieldApiResponse> | undefined | null
  ): Record<string, AnalyzerField> {
    if (fields === undefined || fields === null) {
      return {};
    }

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
      nextLink: response.nextLink ?? "",
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

  // ============================================
  // Document Analysis Methods
  // ============================================

  /**
   * Submits a document for analysis using a URL source.
   * @param analyzerId - The analyzer to use
   * @param request - Analysis request with URL inputs
   * @returns Analysis operation for polling
   */
  async submitAnalysis(
    analyzerId: string,
    request: AnalyzeRequest
  ): Promise<AnalysisOperation> {
    const token = await this.getAccessToken();
    const url = `${this.endpoint}/contentunderstanding/analyzers/${encodeURIComponent(analyzerId)}:analyze?api-version=${API_VERSION}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const operationLocation = response.headers.get('Operation-Location');
    if (operationLocation === null || operationLocation === '') {
      throw new CliError(
        ErrorCodes.API_ERROR,
        'Missing operation location',
        'The API did not return an operation location header',
        'Try the request again or contact support'
      );
    }

    // Extract operation ID from the URL
    const operationId = this.extractOperationId(operationLocation);

    return {
      operationId,
      operationLocation,
      status: 'notStarted',
    };
  }

  /**
   * Submits a document for analysis using binary upload.
   * @param analyzerId - The analyzer to use
   * @param content - Binary content of the document
   * @param mimeType - MIME type of the document
   * @returns Analysis operation for polling
   */
  async submitBinaryAnalysis(
    analyzerId: string,
    content: Buffer | Uint8Array,
    mimeType: string
  ): Promise<AnalysisOperation> {
    const token = await this.getAccessToken();
    const url = `${this.endpoint}/contentunderstanding/analyzers/${encodeURIComponent(analyzerId)}:analyzeBinary?api-version=${API_VERSION}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': mimeType,
      },
      body: content,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const operationLocation = response.headers.get('Operation-Location');
    if (operationLocation === null || operationLocation === '') {
      throw new CliError(
        ErrorCodes.API_ERROR,
        'Missing operation location',
        'The API did not return an operation location header',
        'Try the request again or contact support'
      );
    }

    const operationId = this.extractOperationId(operationLocation);

    return {
      operationId,
      operationLocation,
      status: 'notStarted',
    };
  }

  /**
   * Gets the status and result of an analysis operation.
   * @param operationId - The operation ID to check
   * @returns Analysis result with current status
   */
  async getAnalysisResult(operationId: string): Promise<AnalysisResult> {
    const response = await this.request<AnalysisOperationApiResponse>(
      'GET',
      `/analyzerResults/${encodeURIComponent(operationId)}`
    );

    return this.parseAnalysisResult(response);
  }

  /**
   * Polls for analysis completion with exponential backoff.
   * @param operation - The operation to poll
   * @param options - Polling options
   * @returns Final analysis result
   */
  async pollForResult(
    operation: AnalysisOperation,
    options: {
      maxWaitMs?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
      onProgress?: (status: OperationStatus) => void;
    } = {}
  ): Promise<AnalysisResult> {
    const {
      maxWaitMs = 5 * 60 * 1000, // 5 minutes
      initialDelayMs = 1000,
      maxDelayMs = 10000,
      onProgress,
    } = options;

    const startTime = Date.now();
    let delay = initialDelayMs;

    while (Date.now() - startTime < maxWaitMs) {
      const result = await this.getAnalysisResult(operation.operationId);
      onProgress?.(result.status);

      if (result.status === 'succeeded') {
        return result;
      }

      if (result.status === 'failed') {
        throw new CliError(
          ErrorCodes.ANALYSIS_FAILED,
          'Analysis failed',
          result.error?.message ?? 'The document analysis failed',
          'Check the document format and try again'
        );
      }

      if (result.status === 'canceled') {
        throw new CliError(
          ErrorCodes.OPERATION_CANCELLED,
          'Analysis canceled',
          'The analysis operation was canceled',
          'Submit the analysis again'
        );
      }

      // Wait before next poll
      await this.delay(delay);
      delay = Math.min(delay * 1.5, maxDelayMs);
    }

    throw new CliError(
      ErrorCodes.API_TIMEOUT,
      'Analysis timed out',
      `Analysis did not complete within ${maxWaitMs / 1000} seconds`,
      'Try again or use a smaller document'
    );
  }

  /**
   * Extracts operation ID from the operation location URL.
   */
  private extractOperationId(operationLocation: string): string {
    const match = /analyzerResults\/([^?/]+)/.exec(operationLocation);
    if (match === null || match[1] === undefined) {
      throw new CliError(
        ErrorCodes.API_ERROR,
        'Invalid operation location',
        `Could not extract operation ID from: ${operationLocation}`,
        'This is an API response error - contact support'
      );
    }
    return match[1];
  }

  /**
   * Delays execution for the specified duration.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parses an analysis operation API response.
   */
  private parseAnalysisResult(response: AnalysisOperationApiResponse): AnalysisResult {
    const status = this.parseOperationStatus(response.status);

    const result: AnalysisResult = {
      id: response.id,
      status,
      analyzerId: response.result?.analyzerId ?? '',
      apiVersion: response.result?.apiVersion ?? API_VERSION,
      createdAt: response.result?.createdAt !== undefined
        ? new Date(response.result.createdAt)
        : new Date(),
      warnings: response.result?.warnings ?? [],
    };

    if (response.result?.contents !== undefined) {
      result.contents = response.result.contents.map(c => this.parseAnalyzedContent(c));
    }

    if (response.result?.usage !== undefined) {
      const usage: AnalysisUsage = {};
      if (response.result.usage.documentPagesStandard !== undefined) {
        usage.documentPagesStandard = response.result.usage.documentPagesStandard;
      }
      if (response.result.usage.tokens !== undefined) {
        usage.tokens = response.result.usage.tokens;
      }
      result.usage = usage;
    }

    if (response.error !== undefined) {
      const error: AnalysisError = {
        code: response.error.code,
        message: response.error.message,
      };
      if (response.error.target !== undefined) {
        error.target = response.error.target;
      }
      if (response.error.details !== undefined) {
        error.details = response.error.details;
      }
      result.error = error;
    }

    return result;
  }

  /**
   * Parses operation status from API response.
   * Note: Azure API returns PascalCase (e.g., "Succeeded", "Running")
   * but we normalize to camelCase for consistency.
   */
  private parseOperationStatus(status: string): OperationStatus {
    const normalized = status.toLowerCase();
    const statusMap: Record<string, OperationStatus> = {
      'notstarted': 'notStarted',
      'running': 'running',
      'succeeded': 'succeeded',
      'failed': 'failed',
      'canceled': 'canceled',
      'cancelled': 'canceled', // Handle British spelling
    };
    return statusMap[normalized] ?? 'running';
  }

  /**
   * Parses analyzed content from API response.
   */
  private parseAnalyzedContent(content: AnalyzedContentApiResponse): AnalyzedContent {
    const result: AnalyzedContent = {
      kind: this.parseContentKind(content.kind) ?? 'document',
      mimeType: content.mimeType,
      fields: {},
    };

    if (content.markdown !== undefined) {
      result.markdown = content.markdown;
    }
    if (content.startPageNumber !== undefined) {
      result.startPageNumber = content.startPageNumber;
    }
    if (content.endPageNumber !== undefined) {
      result.endPageNumber = content.endPageNumber;
    }

    if (content.fields !== undefined && content.fields !== null) {
      for (const [name, field] of Object.entries(content.fields)) {
        result.fields[name] = this.parseExtractedField(field);
      }
    }

    if (content.tables !== undefined) {
      result.tables = content.tables.map(t => this.parseDetectedTable(t));
    }

    if (content.figures !== undefined) {
      result.figures = content.figures.map(f => this.parseDetectedFigure(f));
    }

    return result;
  }

  /**
   * Parses an extracted field from API response.
   */
  private parseExtractedField(field: ExtractedFieldApiResponse): ExtractedField {
    const result: ExtractedField = {
      type: this.parseFieldType(field.type),
    };

    if (field.valueString !== undefined) {
      result.valueString = field.valueString;
    }
    if (field.valueNumber !== undefined) {
      result.valueNumber = field.valueNumber;
    }
    if (field.valueBoolean !== undefined) {
      result.valueBoolean = field.valueBoolean;
    }
    if (field.confidence !== undefined) {
      result.confidence = field.confidence;
    }
    if (field.source !== undefined) {
      result.source = field.source;
    }

    if (field.valueArray !== undefined) {
      result.valueArray = field.valueArray.map(f => this.parseExtractedField(f));
    }

    if (field.valueObject !== undefined) {
      result.valueObject = {};
      for (const [name, subField] of Object.entries(field.valueObject)) {
        result.valueObject[name] = this.parseExtractedField(subField);
      }
    }

    if (field.spans !== undefined) {
      result.spans = field.spans.map(s => ({
        offset: s.offset,
        length: s.length,
      }));
    }

    if (field.boundingRegions !== undefined) {
      result.boundingRegions = field.boundingRegions.map(r => ({
        pageNumber: r.pageNumber,
        polygon: r.polygon,
      }));
    }

    return result;
  }

  /**
   * Parses a detected table from API response.
   */
  private parseDetectedTable(table: DetectedTableApiResponse): DetectedTable {
    const result: DetectedTable = {
      rowCount: table.rowCount,
      columnCount: table.columnCount,
      cells: table.cells.map(c => {
        const cell: TableCell = {
          rowIndex: c.rowIndex,
          columnIndex: c.columnIndex,
          content: c.content,
        };
        if (c.rowSpan !== undefined) {
          cell.rowSpan = c.rowSpan;
        }
        if (c.columnSpan !== undefined) {
          cell.columnSpan = c.columnSpan;
        }
        if (c.isHeader !== undefined) {
          cell.isHeader = c.isHeader;
        }
        return cell;
      }),
    };

    if (table.boundingRegions !== undefined) {
      result.boundingRegions = table.boundingRegions.map(r => ({
        pageNumber: r.pageNumber,
        polygon: r.polygon,
      }));
    }

    return result;
  }

  /**
   * Parses a detected figure from API response.
   */
  private parseDetectedFigure(figure: DetectedFigureApiResponse): DetectedFigure {
    const result: DetectedFigure = {
      id: figure.id,
    };

    if (figure.caption !== undefined) {
      result.caption = figure.caption;
    }

    if (figure.boundingRegions !== undefined) {
      result.boundingRegions = figure.boundingRegions.map(r => ({
        pageNumber: r.pageNumber,
        polygon: r.polygon,
      }));
    }

    return result;
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
