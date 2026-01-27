/**
 * Analysis result types for Azure Content Understanding CLI.
 * Represents the output from document analysis operations.
 */

import type { ContentKind, FieldType } from './analyzer.js';

/**
 * Operation status for async analysis.
 */
export type OperationStatus =
  | 'notStarted'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled';

/**
 * Bounding box coordinates for a detected region.
 * Format: polygon points as [x1,y1, x2,y2, x3,y3, x4,y4]
 */
export interface BoundingBox {
  /** Page number (1-indexed) */
  pageNumber: number;

  /** Polygon coordinates */
  polygon: number[];
}

/**
 * Text span indicating position in source document.
 */
export interface TextSpan {
  /** Character offset from document start */
  offset: number;

  /** Length in characters */
  length: number;
}

/**
 * An extracted field value from analysis.
 */
export interface ExtractedField {
  /** Field type */
  type: FieldType;

  /** String value (for string, date, time types) */
  valueString?: string;

  /** Numeric value (for number, integer types) */
  valueNumber?: number;

  /** Boolean value */
  valueBoolean?: boolean;

  /** Array value (for array types) */
  valueArray?: ExtractedField[];

  /** Object value (for object types) */
  valueObject?: Record<string, ExtractedField>;

  /** Extraction confidence (0.0 - 1.0) */
  confidence?: number;

  /** Source location in document */
  source?: string;

  /** Text spans in markdown content */
  spans?: TextSpan[];

  /** Bounding regions (for document/image) */
  boundingRegions?: BoundingBox[];
}

/**
 * A cell in a detected table.
 */
export interface TableCell {
  /** Row index (0-based) */
  rowIndex: number;

  /** Column index (0-based) */
  columnIndex: number;

  /** Row span (default 1) */
  rowSpan?: number;

  /** Column span (default 1) */
  columnSpan?: number;

  /** Cell content */
  content: string;

  /** Whether this is a header cell */
  isHeader?: boolean;
}

/**
 * A table detected in the document.
 */
export interface DetectedTable {
  /** Number of rows */
  rowCount: number;

  /** Number of columns */
  columnCount: number;

  /** Table cells */
  cells: TableCell[];

  /** Bounding regions */
  boundingRegions?: BoundingBox[];
}

/**
 * A figure/image detected in the document.
 */
export interface DetectedFigure {
  /** Figure ID */
  id: string;

  /** Caption text */
  caption?: string;

  /** Bounding regions */
  boundingRegions?: BoundingBox[];
}

/**
 * Content extracted from a single input.
 */
export interface AnalyzedContent {
  /** Content type */
  kind: ContentKind;

  /** MIME type of source */
  mimeType: string;

  /** Markdown representation of content */
  markdown?: string;

  /** Start page (for multi-page documents) */
  startPageNumber?: number;

  /** End page */
  endPageNumber?: number;

  /** Extracted fields */
  fields: Record<string, ExtractedField>;

  /** Detected tables */
  tables?: DetectedTable[];

  /** Detected figures */
  figures?: DetectedFigure[];
}

/**
 * API usage statistics for the analysis.
 */
export interface AnalysisUsage {
  /** Standard document pages processed */
  documentPagesStandard?: number;

  /** Token usage by model */
  tokens?: Record<string, number>;
}

/**
 * Warning from the analysis process.
 */
export interface AnalysisWarning {
  /** Warning code */
  code: string;

  /** Warning message */
  message: string;

  /** Target of the warning */
  target?: string;
}

/**
 * Error details from failed analysis.
 */
export interface AnalysisError {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** Error target */
  target?: string;

  /** Additional error details */
  details?: Array<{ code: string; message: string }>;
}

/**
 * Complete analysis result from the API.
 */
export interface AnalysisResult {
  /** Operation ID */
  id: string;

  /** Operation status */
  status: OperationStatus;

  /** Analyzer ID used */
  analyzerId: string;

  /** API version */
  apiVersion: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Warnings (if any) */
  warnings: AnalysisWarning[];

  /** Analyzed content (populated when succeeded) */
  contents?: AnalyzedContent[];

  /** Usage statistics */
  usage?: AnalysisUsage;

  /** Error details (populated when failed) */
  error?: AnalysisError;
}

/**
 * Pending analysis operation (before result is ready).
 */
export interface AnalysisOperation {
  /** Operation ID */
  operationId: string;

  /** Status polling URL */
  operationLocation: string;

  /** Current status */
  status: OperationStatus;
}

/**
 * Input for URL-based analysis.
 */
export interface AnalysisInput {
  /** URL to the document */
  url: string;

  /** MIME type of the document */
  mimeType?: string;

  /** Page range (e.g., "1-3") */
  range?: string;
}

/**
 * Request body for URL-based analysis.
 */
export interface AnalyzeRequest {
  /** Document inputs */
  inputs: AnalysisInput[];
}

// ============================================
// API Response Types (raw from Azure API)
// ============================================

/**
 * Raw API response for analysis operation status.
 */
export interface AnalysisOperationApiResponse {
  id: string;
  status: string;
  result?: AnalysisResultApiResponse;
  error?: {
    code: string;
    message: string;
    target?: string;
    details?: Array<{ code: string; message: string }>;
  };
}

/**
 * Raw API response for analysis result.
 */
export interface AnalysisResultApiResponse {
  analyzerId: string;
  apiVersion: string;
  createdAt: string;
  warnings?: Array<{
    code: string;
    message: string;
    target?: string;
  }>;
  contents?: AnalyzedContentApiResponse[];
  usage?: {
    documentPagesStandard?: number;
    tokens?: Record<string, number>;
  };
}

/**
 * Raw API response for analyzed content.
 */
export interface AnalyzedContentApiResponse {
  kind: string;
  mimeType: string;
  markdown?: string;
  startPageNumber?: number;
  endPageNumber?: number;
  fields?: Record<string, ExtractedFieldApiResponse>;
  tables?: DetectedTableApiResponse[];
  figures?: DetectedFigureApiResponse[];
}

/**
 * Raw API response for an extracted field.
 */
export interface ExtractedFieldApiResponse {
  type: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueArray?: ExtractedFieldApiResponse[];
  valueObject?: Record<string, ExtractedFieldApiResponse>;
  confidence?: number;
  source?: string;
  spans?: Array<{ offset: number; length: number }>;
  boundingRegions?: Array<{ pageNumber: number; polygon: number[] }>;
}

/**
 * Raw API response for a detected table.
 */
export interface DetectedTableApiResponse {
  rowCount: number;
  columnCount: number;
  cells: Array<{
    rowIndex: number;
    columnIndex: number;
    rowSpan?: number;
    columnSpan?: number;
    content: string;
    isHeader?: boolean;
  }>;
  boundingRegions?: Array<{ pageNumber: number; polygon: number[] }>;
}

/**
 * Raw API response for a detected figure.
 */
export interface DetectedFigureApiResponse {
  id: string;
  caption?: string;
  boundingRegions?: Array<{ pageNumber: number; polygon: number[] }>;
}
