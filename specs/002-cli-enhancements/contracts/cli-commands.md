# CLI Commands Contract: CLI Enhancements

**Date**: 2026-01-27  
**Feature**: [spec.md](../spec.md)

---

## New Commands

### `cu status`

Display current authentication status and configuration.

```
cu status [options]

Options:
  --json         Output as JSON
  -h, --help     Display help

Output (human-readable):
  Authentication: Logged in as user@example.com
  Token expires:  2026-01-27 15:30:00 (in 4 hours)
  Auth method:    Azure AD
  
  Profile:        default
  Endpoint:       https://my-resource.cognitiveservices.azure.com
  API Key:        Configured

Output (JSON):
  {
    "authentication": {
      "isAuthenticated": true,
      "method": "azure-ad",
      "user": {
        "email": "user@example.com",
        "name": "User Name",
        "tenantId": "..."
      },
      "expiresAt": "2026-01-27T15:30:00.000Z",
      "needsRefresh": false
    },
    "profile": {
      "name": "default",
      "endpoint": "https://my-resource.cognitiveservices.azure.com",
      "hasApiKey": true
    }
  }

Exit Codes:
  0 - Success
  2 - No configuration found
```

---

## Modified Commands

### `cu config set` (Extended)

Add API key configuration option.

```
cu config set [options]

Options:
  --endpoint <url>     Azure CU resource endpoint
  --profile <name>     Profile name (default: "default")
  --subscription <id>  Azure subscription ID
  --resource-group <name>  Resource group name
  --resource-name <name>   Resource name
  --api-key <key>      API key for authentication (NEW)
  -h, --help           Display help

Examples:
  # Set API key for current profile
  cu config set --api-key abc123xyz

  # Set endpoint and API key together
  cu config set --endpoint https://my-resource.cognitiveservices.azure.com --api-key abc123xyz

  # Clear API key (empty string)
  cu config set --api-key ""

Exit Codes:
  0 - Success
  3 - Invalid input (bad URL format)
```

---

### `cu config show` (Extended)

Show API key status (masked).

```
cu config show [options]

Options:
  --profile <name>  Show specific profile
  --json            Output as JSON
  -h, --help        Display help

Output (human-readable):
  Profile: default (active)
  ─────────────────────────
  Endpoint:   https://my-resource.cognitiveservices.azure.com
  API Key:    ••••••••xyz (configured)   # NEW: Shows last 3 chars

Output (JSON):
  {
    "name": "default",
    "isActive": true,
    "endpoint": "https://my-resource.cognitiveservices.azure.com",
    "hasApiKey": true,           # NEW
    "apiKeyPreview": "•••xyz"    # NEW: Last 3 chars for verification
  }

Exit Codes:
  0 - Success
  2 - Profile not found
```

---

### `cu analyze` (Extended)

Changes for raw JSON output and PDF overlay support.

```
cu analyze <file-or-url> [options]

Options:
  --analyzer <id>        Analyzer to use (required)
  --format <format>      Output format: json, table, overlay (default: table)
  --output <path>        Output file path (for overlay format)
  --page <number>        Specific page for overlay (default: all pages)
  --dpi <number>         DPI for PDF rendering (default: 150, overlay only)  # NEW
  --json                 Shorthand for --format json
  -h, --help             Display help

JSON Output (--format json):
  Raw API response, unmodified. Example:
  {
    "id": "operation-id",
    "status": "succeeded",
    "result": {
      "analyzerId": "prebuilt-invoice",
      "contents": [...],
      "warnings": []
    }
  }

PDF Overlay (--format overlay with PDF input):
  - Single page PDF: Outputs single PNG
  - Multi-page PDF: Outputs multiple PNGs (output-1.png, output-2.png, ...)
  - Use --page to render specific page only
  - Use --dpi to control output resolution (default: 150)

Exit Codes:
  0 - Success
  1 - Authentication required
  3 - Invalid input (unsupported file type)
  4 - Resource not found (analyzer not found)
  5 - API error
  7 - Unknown error
```

---

## Authentication Priority

When making API requests, authentication is resolved in this order:

1. **API Key** (if configured in active profile)
   - Uses `Ocp-Apim-Subscription-Key` header
   - No Azure AD required

2. **Azure AD Token** (if logged in)
   - Uses `Authorization: Bearer <token>` header
   - Token refreshed automatically if near expiry

3. **Error** (if neither available)
   - Exit code 1: "Authentication required. Run `cu login` or configure API key with `cu config set --api-key`"

---

## Error Messages

### API Key Errors

```
Error: Invalid API key
The API key configured for profile 'default' was rejected by the service.

Suggestion: Verify your API key in the Azure portal and update with:
  cu config set --api-key <new-key>
```

### PDF Rendering Errors

```
Error: Cannot render PDF overlay
The PDF file 'document.pdf' could not be rendered to an image.

Details: The PDF is password-protected
Suggestion: Remove the password protection or use a different output format:
  cu analyze document.pdf --format json
```

```
Error: PDF rendering library not available
The optional 'pdf-to-png-converter' package is required for PDF overlay.

Suggestion: Install the package:
  npm install pdf-to-png-converter
```

---

## Backward Compatibility

| Feature | Breaking Change | Migration |
|---------|----------------|-----------|
| `--api-key` option | No | New optional feature |
| `cu status` command | No | New command |
| JSON raw output | **Yes** | Output structure changes |
| PDF overlay | No | New capability for existing option |

### JSON Output Migration

**Before (v0.1.0)**:
```json
{
  "operationId": "...",
  "status": "succeeded",
  "contents": [...]
}
```

**After (v0.2.0)**:
```json
{
  "id": "...",
  "status": "succeeded",
  "result": {
    "analyzerId": "...",
    "contents": [...]
  }
}
```

This is a **breaking change** for JSON output consumers. The new format matches the raw API response exactly, providing full fidelity with the service.
