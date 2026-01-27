# Azure Content Understanding API Contract

**Date**: 2026-01-22  
**Feature**: [spec.md](../spec.md)

This document defines the interface between the cu-cli and Azure Content Understanding REST API.

---

## Base Configuration

```
Base URL: {endpoint}/contentunderstanding
API Version: 2025-11-01
Authentication: Bearer token (Azure AD)
```

---

## Authentication

All requests include:

```http
Authorization: Bearer {access-token}
Content-Type: application/json
```

Token scope: `https://cognitiveservices.azure.com/user_impersonation`

---

## Endpoints Used by CLI

### Analyzer Operations

#### List Analyzers

```http
GET {endpoint}/contentunderstanding/analyzers?api-version=2025-11-01
```

**Response 200:**
```json
{
  "value": [
    {
      "analyzerId": "prebuilt-document",
      "description": "General document processing",
      "status": "ready",
      "createdAt": "2025-01-01T00:00:00Z",
      "modifiedAt": "2025-01-01T00:00:00Z"
    }
  ],
  "nextLink": "https://...?skipToken=..."
}
```

#### Get Analyzer

```http
GET {endpoint}/contentunderstanding/analyzers/{analyzerId}?api-version=2025-11-01
```

**Response 200:**
```json
{
  "analyzerId": "my-custom-analyzer",
  "description": "Custom analyzer",
  "status": "ready",
  "baseAnalyzerId": "prebuilt-document",
  "createdAt": "2026-01-20T10:00:00Z",
  "modifiedAt": "2026-01-21T14:30:00Z",
  "fieldSchema": {
    "name": "Fields",
    "fields": {
      "FieldName": {
        "type": "string",
        "method": "extract",
        "description": "Field description"
      }
    }
  }
}
```

**Response 404:**
```json
{
  "error": {
    "code": "NotFound",
    "message": "Analyzer 'xyz' not found"
  }
}
```

---

### Defaults (Model Deployment Mappings)

Configuration for default model-to-deployment mappings. Maps model names (like `gpt-4.1`) to deployment names in your Azure OpenAI resource.

#### Get Defaults

```http
GET {endpoint}/contentunderstanding/defaults?api-version=2025-11-01
```

**Response 200:**
```json
{
  "modelDeployments": {
    "gpt-4.1": "myGpt41Deployment",
    "text-embedding-3-large": "myTextEmbedding3LargeDeployment"
  }
}
```

#### Update Defaults (Merge-Patch)

Updates model deployment mappings using JSON merge-patch semantics. Only specified mappings are updated; others are preserved. Set a value to `null` to remove a mapping.

```http
PATCH {endpoint}/contentunderstanding/defaults?api-version=2025-11-01
Content-Type: application/merge-patch+json

{
  "modelDeployments": {
    "gpt-4.1": "newGpt41Deployment"
  }
}
```

**Response 200:**
```json
{
  "modelDeployments": {
    "gpt-4.1": "newGpt41Deployment",
    "text-embedding-3-large": "myTextEmbedding3LargeDeployment"
  }
}
```

---

### Document Analysis

#### Submit Analysis (URL source)

```http
POST {endpoint}/contentunderstanding/analyzers/{analyzerId}:analyze?api-version=2025-11-01

{
  "inputs": [
    {
      "url": "https://example.com/document.pdf",
      "mimeType": "application/pdf",
      "range": "1-3"
    }
  ]
}
```

**Response 202 Accepted:**
```http
Operation-Location: {endpoint}/contentunderstanding/analyzerResults/{operationId}?api-version=2025-11-01
```

#### Submit Analysis (Binary upload)

```http
POST {endpoint}/contentunderstanding/analyzers/{analyzerId}:analyzeBinary?api-version=2025-11-01
Content-Type: application/pdf

<binary-content>
```

**Response 202 Accepted:**
```http
Operation-Location: {endpoint}/contentunderstanding/analyzerResults/{operationId}?api-version=2025-11-01
```

#### Get Analysis Result

```http
GET {endpoint}/contentunderstanding/analyzerResults/{operationId}?api-version=2025-11-01
```

**Response 200 (Running):**
```json
{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "running"
}
```

**Response 200 (Succeeded):**
```json
{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "succeeded",
  "result": {
    "analyzerId": "prebuilt-invoice",
    "apiVersion": "2025-11-01",
    "createdAt": "2026-01-22T10:00:00Z",
    "warnings": [],
    "contents": [
      {
        "kind": "document",
        "mimeType": "application/pdf",
        "markdown": "# Document content...",
        "startPageNumber": 1,
        "endPageNumber": 2,
        "fields": {
          "VendorName": {
            "type": "string",
            "valueString": "Contoso Ltd",
            "confidence": 0.95,
            "source": "D(1,1,1,2,2,2,2,1)",
            "spans": [{"offset": 0, "length": 11}]
          }
        },
        "tables": [],
        "figures": []
      }
    ]
  },
  "usage": {
    "documentPagesStandard": 2,
    "tokens": {
      "gpt-4.1-mini-input": 1234,
      "gpt-4.1-mini-output": 567
    }
  }
}
```

**Response 200 (Failed):**
```json
{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "failed",
  "error": {
    "code": "InvalidDocument",
    "message": "Document format not supported"
  }
}
```

---

## Error Responses

All error responses follow this structure:

```json
{
  "error": {
    "code": "ErrorCode",
    "message": "Human-readable message",
    "target": "optional target",
    "details": [
      {
        "code": "DetailCode",
        "message": "Detail message"
      }
    ],
    "innererror": {
      "code": "InnerCode"
    }
  }
}
```

### Common Error Codes

| HTTP Status | Code | CLI Exit | Description |
|-------------|------|----------|-------------|
| 400 | InvalidRequest | 7 | Malformed request |
| 401 | Unauthorized | 1 | Auth token missing/invalid |
| 403 | Forbidden | 1 | Access denied |
| 404 | NotFound | 4 | Resource not found |
| 429 | TooManyRequests | 5 | Rate limited (retry) |
| 500 | InternalServerError | 5 | Server error (retry) |
| 503 | ServiceUnavailable | 5 | Service down (retry) |

---

## Rate Limiting

When rate limited, the API returns:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30

{
  "error": {
    "code": "TooManyRequests",
    "message": "Rate limit exceeded. Retry after 30 seconds."
  }
}
```

**CLI Behavior:**
1. Parse `Retry-After` header
2. Display message: "Rate limited. Retrying in 30s..."
3. Wait specified duration
4. Retry request (up to 3 times)

---

## Polling Strategy

For async operations (analyze):

```typescript
const INITIAL_DELAY = 1000;  // 1 second
const MAX_DELAY = 30000;     // 30 seconds
const TIMEOUT = 300000;      // 5 minutes

async function pollForResult(operationUrl: string): Promise<AnalysisResult> {
  const startTime = Date.now();
  let delay = INITIAL_DELAY;
  
  while (Date.now() - startTime < TIMEOUT) {
    const result = await fetch(operationUrl);
    const data = await result.json();
    
    if (data.status === "succeeded" || data.status === "failed") {
      return data;
    }
    
    await sleep(delay);
    delay = Math.min(delay * 1.5, MAX_DELAY);  // Exponential backoff
  }
  
  throw new TimeoutError("Analysis timed out");
}
```

---

## Content Types

### Supported Input Formats

| MIME Type | Extension | Max Size |
|-----------|-----------|----------|
| application/pdf | .pdf | 200 MB |
| image/jpeg | .jpg, .jpeg | 200 MB |
| image/png | .png | 200 MB |
| image/tiff | .tif, .tiff | 200 MB |
| image/bmp | .bmp | 200 MB |
| image/heif | .heif, .heic | 200 MB |

### Content Type Detection

CLI determines MIME type by:
1. File extension mapping
2. Magic bytes (first few bytes of file)
3. User override via `--mime-type` option

---

## Request/Response Mapping

### CLI Command → API Call

| CLI Command | API Endpoint |
|-------------|--------------|
| `cu analyzer list` | `GET /analyzers` |
| `cu analyzer show <id>` | `GET /analyzers/{id}` |
| `cu analyze <file>` | `POST /analyzers/{id}:analyze` or `:analyzeBinary` |
| - | `GET /analyzerResults/{opId}` (polling) |
| `cu defaults list` | `GET /defaults` |
| `cu defaults set` | `PATCH /defaults` (merge-patch) |
| `cu defaults remove` | `PATCH /defaults` (set mapping to null) |

### API Response → CLI Output

```typescript
interface ApiToCliMapping {
  // Analyzer list
  "GET /analyzers": {
    transform: (response) => ({
      analyzers: response.value.map(a => ({
        id: a.analyzerId,
        status: a.status,
        description: a.description,
        createdAt: new Date(a.createdAt)
      }))
    })
  };
  
  // Analysis result
  "GET /analyzerResults/{id}": {
    transform: (response) => ({
      id: response.id,
      status: response.status,
      contents: response.result?.contents,
      error: response.error
    })
  };
}
```
