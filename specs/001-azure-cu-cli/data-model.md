# Data Model: Azure Content Understanding CLI

**Date**: 2026-01-22  
**Feature**: [spec.md](spec.md) | [plan.md](plan.md)

## Overview

This document defines the TypeScript interfaces and types for the cu-cli. All types are designed for strict type safety with no `any` usage.

---

## 1. Configuration Types

### ConfigProfile

Represents a named configuration for targeting an Azure Content Understanding resource.

```typescript
// src/models/config.ts

/**
 * A named configuration profile for an Azure CU resource.
 * Multiple profiles enable dev/staging/prod switching.
 */
export interface ConfigProfile {
  /** Azure CU resource endpoint (e.g., https://my-resource.cognitiveservices.azure.com) */
  endpoint: string;
  
  /** Azure subscription ID (optional, for resource management) */
  subscriptionId?: string;
  
  /** Resource group name (optional, for BYOC operations) */
  resourceGroup?: string;
  
  /** Resource name (optional, for BYOC operations) */
  resourceName?: string;
}

/**
 * Root configuration stored in ~/.cu/config.json
 */
export interface AppConfig {
  /** Config file schema version */
  version: "1";
  
  /** Name of the currently active profile */
  activeProfile: string;
  
  /** Map of profile name → profile configuration */
  profiles: Record<string, ConfigProfile>;
}

/**
 * Validation rules:
 * - endpoint: MUST be a valid HTTPS URL
 * - activeProfile: MUST exist in profiles map
 * - profiles: MUST have at least one entry when activeProfile is set
 */
```

### Config File Location

| Platform | Path |
|----------|------|
| Windows | `%USERPROFILE%\.cu\config.json` |
| macOS/Linux | `~/.cu/config.json` |

---

## 2. Authentication Types

### AuthState

Represents the current authentication state (derived from MSAL, not persisted separately).

```typescript
// src/models/auth.ts

/**
 * Represents the authenticated user's identity.
 * Populated from MSAL account info after successful login.
 */
export interface UserIdentity {
  /** User's email or UPN */
  email: string;
  
  /** Display name */
  name: string;
  
  /** Azure AD tenant ID */
  tenantId: string;
  
  /** Home account ID (MSAL identifier) */
  homeAccountId: string;
}

/**
 * Authentication state for the current session.
 */
export interface AuthState {
  /** Whether user is currently authenticated */
  isAuthenticated: boolean;
  
  /** User identity (null if not authenticated) */
  user: UserIdentity | null;
  
  /** Token expiration time (null if not authenticated) */
  expiresAt: Date | null;
}
```

**Note**: Access tokens and refresh tokens are managed entirely by MSAL and stored in the OS credential store. The CLI never directly handles raw tokens.

---

## 3. Analyzer Types

### Analyzer

Represents an analyzer available in the Azure CU resource.

```typescript
// src/models/analyzer.ts

/**
 * Supported content types for analysis.
 */
export type ContentKind = "document" | "image" | "audio" | "video";

/**
 * Field extraction method.
 */
export type FieldMethod = "extract" | "classify" | "generate";

/**
 * Field type in analyzer schema.
 */
export type FieldType = 
  | "string" 
  | "number" 
  | "integer" 
  | "boolean" 
  | "date" 
  | "time" 
  | "array" 
  | "object";

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
  
  /** For array/object: nested field definitions */
  items?: AnalyzerField;
  fields?: Record<string, AnalyzerField>;
}

/**
 * Analyzer status in the service.
 */
export type AnalyzerStatus = "creating" | "ready" | "failed" | "deleting";

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
  supportedContentKinds: ContentKind[];
  
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
```

---

## 4. Analysis Result Types

### AnalysisResult

Represents the output from analyzing a document.

```typescript
// src/models/analysis-result.ts

/**
 * Operation status for async analysis.
 */
export type OperationStatus = 
  | "notStarted" 
  | "running" 
  | "succeeded" 
  | "failed" 
  | "canceled";

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
  error?: ApiError;
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
  
  /** Estimated completion (if available) */
  estimatedCompletion?: Date;
}
```

---

## 5. Custom Model Types

### CustomModel

Represents a BYOC (Bring Your Own Capacity) model deployment.

```typescript
// src/models/model.ts

/**
 * Deployment status for a custom model.
 */
export type DeploymentStatus = 
  | "notStarted" 
  | "running" 
  | "succeeded" 
  | "failed" 
  | "deleting";

/**
 * A deployed custom model.
 */
export interface CustomModel {
  /** Model deployment name */
  name: string;
  
  /** Model source (Azure ML model ID, etc.) */
  source: string;
  
  /** Current deployment status */
  status: DeploymentStatus;
  
  /** Deployment start time */
  createdAt: Date;
  
  /** Last status update */
  updatedAt: Date;
  
  /** Endpoint URL (when deployed) */
  endpoint?: string;
  
  /** Error message (when failed) */
  error?: string;
  
  /** Model version */
  version?: string;
  
  /** Model description */
  description?: string;
}

/**
 * Model deployment request.
 */
export interface DeployModelRequest {
  /** Deployment name */
  name: string;
  
  /** Model source location */
  source: string;
  
  /** Optional description */
  description?: string;
}

/**
 * Paginated list of models.
 */
export interface ModelList {
  /** Models in this page */
  value: CustomModel[];
  
  /** Continuation token */
  nextLink?: string;
}
```

---

## 6. API Error Types

### ApiError

Standardized error representation from Azure CU API.

```typescript
// src/models/error.ts

/**
 * Error detail from API response.
 */
export interface ApiErrorDetail {
  /** Error code */
  code: string;
  
  /** Error message */
  message: string;
  
  /** Target of the error */
  target?: string;
}

/**
 * Inner error for additional context.
 */
export interface InnerError {
  /** Inner error code */
  code: string;
  
  /** Nested inner error */
  innererror?: InnerError;
}

/**
 * API error response structure.
 */
export interface ApiError {
  /** Primary error code */
  code: string;
  
  /** Human-readable message */
  message: string;
  
  /** Error target */
  target?: string;
  
  /** Additional error details */
  details?: ApiErrorDetail[];
  
  /** Inner error chain */
  innererror?: InnerError;
}
```

---

## 7. CLI-Specific Types

### Command Options

```typescript
// src/models/cli.ts

/**
 * Global CLI options available on all commands.
 */
export interface GlobalOptions {
  /** Output format */
  json?: boolean;
  
  /** Configuration profile to use */
  profile?: string;
  
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Output format for structured data.
 */
export type OutputFormat = "json" | "table" | "markdown" | "overlay";

/**
 * Analyze command options.
 */
export interface AnalyzeOptions extends GlobalOptions {
  /** Analyzer ID to use */
  analyzer: string;
  
  /** Output format */
  format?: OutputFormat;
  
  /** Output file path */
  output?: string;
  
  /** Force overwrite existing output */
  force?: boolean;
  
  /** Page range (e.g., "1-3,5") */
  pages?: string;
}

/**
 * Model deploy command options.
 */
export interface ModelDeployOptions extends GlobalOptions {
  /** Model name */
  name: string;
  
  /** Model source */
  source: string;
  
  /** Model description */
  description?: string;
}
```

---

## 8. State Transitions

### Analysis Operation States

```
notStarted → running → succeeded
                    ↘ failed
                    ↘ canceled
```

### Analyzer States

```
creating → ready
        ↘ failed

ready → deleting → (deleted)
```

### Model Deployment States

```
notStarted → running → succeeded
                    ↘ failed

succeeded → deleting → (deleted)
```

---

## 9. Validation Rules

| Entity | Field | Rule |
|--------|-------|------|
| ConfigProfile | endpoint | MUST be valid HTTPS URL |
| ConfigProfile | subscriptionId | MUST be valid UUID format |
| Analyzer | id | 1-64 chars, alphanumeric + `.` `_` `-` |
| AnalysisResult | confidence | MUST be 0.0 ≤ value ≤ 1.0 |
| CustomModel | name | 1-64 chars, alphanumeric + `-` |

---

## 10. File Structure

```
src/models/
├── index.ts            # Re-exports all models
├── config.ts           # ConfigProfile, AppConfig
├── auth.ts             # UserIdentity, AuthState
├── analyzer.ts         # Analyzer, AnalyzerField, etc.
├── analysis-result.ts  # AnalysisResult, ExtractedField, etc.
├── model.ts            # CustomModel, DeploymentStatus
├── error.ts            # ApiError, ApiErrorDetail
└── cli.ts              # GlobalOptions, OutputFormat, etc.
```
