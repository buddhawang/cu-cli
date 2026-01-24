/**
 * Analyzer types for Azure Content Understanding CLI.
 * Represents analyzers available in the configured Azure CU resource.
 */

/**
 * Supported content types for analysis.
 */
export type ContentKind = 'document' | 'image' | 'audio' | 'video';

/**
 * Field extraction method.
 */
export type FieldMethod = 'extract' | 'classify' | 'generate';

/**
 * Field type in analyzer schema.
 */
export type FieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'time'
  | 'array'
  | 'object';

/**
 * Definition of a field that can be extracted by an analyzer.
 */
export interface AnalyzerField {
  /** Field name (key in the schema) */
  name: string;

  /** Data type of the field */
  type: FieldType;

  /** Extraction method */
  method: FieldMethod;

  /** Human-readable description */
  description?: string;

  /** For classify method: allowed values */
  enum?: string[];

  /** For array type: nested field definition */
  items?: AnalyzerField;

  /** For object type: nested field definitions */
  fields?: Record<string, AnalyzerField>;
}

/**
 * Analyzer status in the service.
 */
export type AnalyzerStatus = 'creating' | 'ready' | 'failed' | 'deleting';

/**
 * An analyzer available in the Azure CU resource.
 */
export interface Analyzer {
  /** Unique analyzer identifier */
  id: string;

  /** Human-readable description */
  description?: string;

  /** Current status */
  status: AnalyzerStatus;

  /** Creation timestamp */
  createdAt: Date;

  /** Last modification timestamp */
  modifiedAt: Date;

  /** Supported content types */
  supportedContentKinds?: ContentKind[];

  /** Field schema (for custom analyzers) */
  fieldSchema?: {
    name: string;
    fields: Record<string, AnalyzerField>;
  };

  /** Base analyzer ID (for custom analyzers built on prebuilt) */
  baseAnalyzerId?: string;
}

/**
 * Paginated list of analyzers from the API.
 */
export interface AnalyzerList {
  /** Analyzers in this page */
  value: Analyzer[];

  /** Continuation token for next page (if any) */
  nextLink?: string;
}

/**
 * Raw API response for analyzer list.
 */
export interface AnalyzerListApiResponse {
  value: AnalyzerApiResponse[];
  nextLink?: string;
}

/**
 * Raw API response for a single analyzer.
 */
export interface AnalyzerApiResponse {
  analyzerId: string;
  description?: string;
  status: string;
  createdAt: string;
  modifiedAt: string;
  supportedContentKinds?: string[];
  baseAnalyzerId?: string;
  fieldSchema?: {
    name: string;
    fields: Record<string, AnalyzerFieldApiResponse>;
  };
}

/**
 * Raw API response for an analyzer field.
 */
export interface AnalyzerFieldApiResponse {
  type: string;
  method: string;
  description?: string;
  enum?: string[];
  items?: AnalyzerFieldApiResponse;
  fields?: Record<string, AnalyzerFieldApiResponse>;
}
