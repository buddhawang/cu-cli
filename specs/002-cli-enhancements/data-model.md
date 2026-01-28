# Data Model: CLI Enhancements

**Date**: 2026-01-27  
**Feature**: [spec.md](spec.md)

---

## Entity Changes

### ConfigProfile (Extended)

**File**: `src/models/config.ts`

```typescript
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

  /** API key for authentication (optional, takes priority over Azure AD) */
  apiKey?: string;  // NEW
}
```

**Validation Rules**:
- `apiKey`: Optional string, no format validation (Azure validates on use)
- When `apiKey` is present and non-empty, it takes priority over Azure AD authentication

**State Transitions**: N/A (configuration entity)

---

### AuthState (Extended)

**File**: `src/models/auth.ts`

```typescript
/**
 * Authentication state for the current session.
 */
export interface AuthState {
  /** Whether user is currently authenticated */
  isAuthenticated: boolean;

  /** User identity (null if not authenticated) */
  user: UserIdentity | null;

  /** Access token expiration time (null if not authenticated) */
  expiresAt: Date | null;

  /** Whether authentication is via API key (no expiry) */
  isApiKey?: boolean;  // NEW

  /** Whether token needs refresh soon (within 5 minutes) */
  needsRefresh?: boolean;  // NEW
}
```

**Validation Rules**:
- `isApiKey`: True when authentication is via API key (no Azure AD)
- `needsRefresh`: True when `expiresAt` is within 5 minutes of current time

---

### AuthMethod (New Enum)

**File**: `src/models/auth.ts`

```typescript
/**
 * Authentication method in use.
 */
export type AuthMethod = 'azure-ad' | 'api-key' | 'none';
```

---

### PdfRenderOptions (New)

**File**: `src/lib/pdf-renderer.ts`

```typescript
/**
 * Options for PDF page rendering.
 */
export interface PdfRenderOptions {
  /** DPI for rendering (default: 150) */
  dpi?: number;

  /** Specific page to render (1-indexed, undefined = all pages) */
  pageNumber?: number;
}

/**
 * Result of PDF rendering.
 */
export interface PdfRenderResult {
  /** Page number (1-indexed) */
  pageNumber: number;

  /** Rendered image as PNG buffer */
  buffer: Buffer;

  /** Page width in pixels */
  width: number;

  /** Page height in pixels */
  height: number;
}
```

---

## Configuration Schema

### config.json (v1 - Extended)

```json
{
  "version": "1",
  "activeProfile": "string",
  "profiles": {
    "<profile-name>": {
      "endpoint": "https://...",
      "subscriptionId": "optional-string",
      "resourceGroup": "optional-string",
      "resourceName": "optional-string",
      "apiKey": "optional-string"
    }
  }
}
```

**Migration**: No migration needed. Existing config files remain valid. New `apiKey` field is optional.

---

## API Response Handling

### Raw vs Transformed Response

For JSON output, the CLI returns the **raw API response** without transformation:

```typescript
// Internal type for raw API response (not defined, passed through as unknown)
type RawAnalysisResponse = unknown;

// When --format json is used:
// 1. API response is NOT parsed into AnalysisResult
// 2. Response is directly serialized to stdout
// 3. Maintains full fidelity with service schema
```

### Transformed Response (Existing)

For table and overlay formats, the existing `AnalysisResult` type is used:

```typescript
// Existing type - no changes needed
interface AnalysisResult {
  id: string;
  status: OperationStatus;
  analyzerId: string;
  createdAt: Date;
  contents?: AnalyzedContent[];
  usage?: AnalysisUsage;
  warnings: Array<{ code: string; message: string }>;
  errors: AnalysisError[];
}
```

---

## Relationships

```
┌─────────────────┐
│   AppConfig     │
├─────────────────┤
│ version: "1"    │
│ activeProfile   │
│ profiles {}     │──┐
└─────────────────┘  │
                     │ 1:N
                     ▼
┌─────────────────────────┐
│     ConfigProfile       │
├─────────────────────────┤
│ endpoint: string        │
│ subscriptionId?: string │
│ resourceGroup?: string  │
│ resourceName?: string   │
│ apiKey?: string   NEW   │
└─────────────────────────┘
          │
          │ determines
          ▼
┌─────────────────────────┐
│       AuthMethod        │
├─────────────────────────┤
│ 'api-key' if apiKey set │
│ 'azure-ad' if logged in │
│ 'none' otherwise        │
└─────────────────────────┘
```

---

## Validation Summary

| Entity | Field | Validation |
|--------|-------|------------|
| ConfigProfile | endpoint | HTTPS URL, required |
| ConfigProfile | apiKey | Optional string, no format check |
| PdfRenderOptions | dpi | Positive integer, default 150 |
| PdfRenderOptions | pageNumber | Positive integer, 1-indexed |
