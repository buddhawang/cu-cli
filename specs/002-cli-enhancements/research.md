# Research: CLI Enhancements

**Date**: 2026-01-27  
**Feature**: [spec.md](spec.md)

---

## Research Tasks

| Unknown | Resolution | Confidence |
|---------|------------|------------|
| PDF to image rendering in Node.js | `pdf-to-png-converter` library | High |
| MSAL token refresh optimization | Current implementation is optimal; add cache inspection for status | High |
| API key authentication header | `Ocp-Apim-Subscription-Key` header | High |
| Raw JSON output approach | Store raw response, transform only for table/overlay | High |

---

## 1. PDF to Image Rendering

### Decision: Use `pdf-to-png-converter`

### Rationale
This library wraps `pdfjs-dist` with `@napi-rs/canvas` (a pure Rust canvas implementation), providing:
- Cross-platform support (Windows, macOS Intel/ARM, Linux)
- No system-level dependencies (unlike pdf-poppler or pdf2pic which require Ghostscript)
- Buffer output suitable for sharp compositing
- ESM-compatible for lazy loading

### Alternatives Considered

| Library | Rejected Because |
|---------|------------------|
| `pdfjs-dist` + `node-canvas` | node-canvas requires Cairo build tools on some systems |
| `pdf-poppler` | Requires Poppler binaries installed on system |
| `pdf2pic` | Requires GraphicsMagick/Ghostscript |
| `sharp` | Cannot read PDF files directly |
| `pdf.js` direct | Requires implementing canvas rendering from scratch |

### Implementation Pattern

```typescript
// Lazy-loaded to preserve CLI startup time (<200ms requirement)
async function renderPdfPage(pdfPath: string, pageNumber: number, dpi = 150): Promise<Buffer> {
  // Dynamic import for lazy loading
  const { pdfToPng } = await import('pdf-to-png-converter');
  
  const pages = await pdfToPng(pdfPath, {
    viewportScale: dpi / 72,  // Convert DPI to scale factor
    pagesToProcess: [pageNumber],
    returnPageContent: true,
  });
  
  if (!pages[0]?.content) {
    throw new Error(`Failed to render page ${pageNumber}`);
  }
  
  return pages[0].content;
}
```

### Requirements
- Node.js 20+ (current LTS - compatible with project's Node 18+ target)
- Add as optional dependency (like sharp)
- Lazy load on first use

### Coordinate Conversion: PDF Inches to Image Pixels

**Critical Implementation Detail**: The Azure Content Understanding API returns bounding box coordinates in the `source` property using **inches** (PDF coordinate system). When rendering overlays on PDF-derived images, coordinates must be converted to pixels based on the rendering DPI.

**Conversion Formula**:
```
pixel_coordinate = inch_coordinate × DPI
```

**Example** (at 150 DPI):
```
Source: "D(1, 0.5, 1.0, 2.5, 1.0, 2.5, 1.5, 0.5, 1.5)"
        Page 1, polygon at (0.5", 1.0") to (2.5", 1.5")

Converted to pixels:
        (75, 150) to (375, 225)
```

**Implementation in overlay.ts**:
```typescript
/**
 * Converts bounding box coordinates from inches to pixels.
 * Required when rendering overlays on PDF-derived images.
 * 
 * @param box - Bounding box with coordinates in inches
 * @param dpi - Rendering DPI (default: 150)
 * @returns Bounding box with coordinates in pixels
 */
function convertInchesToPixels(box: BoundingBox, dpi: number): BoundingBox {
  return {
    pageNumber: box.pageNumber,
    polygon: box.polygon.map(coord => coord * dpi),
  };
}
```

**When to Apply Conversion**:
- **PDF files**: Always convert (source coordinates are in inches)
- **Image files**: No conversion needed (coordinates already in pixels, or normalized 0-1)

**Detection Logic**:
```typescript
const isPdf = filePath.toLowerCase().endsWith('.pdf');
const boxes = extractBoundingBoxes(result, pageNumber);

if (isPdf) {
  // Convert inch coordinates to pixels based on render DPI
  boxes.forEach(item => {
    item.box = convertInchesToPixels(item.box, dpi);
  });
}
```

### Error Handling
- Password-protected PDFs: Library throws with error message containing "password"
- Corrupted PDFs: Throws with parse error
- Page out of range: Returns empty array for that page

---

## 2. MSAL Token Refresh Optimization

### Decision: Current Implementation is Already Optimal

### Rationale
The existing `AuthService.acquireTokenSilent()` implementation correctly:
1. Uses MSAL's `acquireTokenSilent()` which automatically refreshes tokens using the cached refresh token
2. Handles `InteractionRequiredAuthError` to detect when re-login is needed
3. Uses `FileCachePlugin` for persistent credential storage

### What MSAL Already Does
- `acquireTokenSilent()` with `forceRefresh: false` (default) returns cached token if valid
- If access token expired but refresh token valid, it automatically refreshes
- If refresh token expired (90-day sliding window), throws `InteractionRequiredAuthError`

### Network Retry Handling

**Note**: Network retry with exponential backoff is handled internally by MSAL. No explicit implementation is required in this feature. MSAL automatically retries failed network requests with appropriate backoff strategies. If all retries fail, MSAL throws an error that we propagate to the user with a helpful message suggesting to check network connectivity and try again.

### Enhancements for This Feature

1. **Add `cu status` command**: Read token expiry directly from cache file for zero-network-call status check
2. **Improve status visibility**: Expose token expiration in `AuthState` model

### Cache File Structure (for direct inspection)

```json
// ~/.cu/msal-cache.json
{
  "AccessToken": {
    "<key>": {
      "secret": "...",
      "expires_on": "1738000000",  // Unix timestamp
      "cached_at": "1737900000"
    }
  },
  "RefreshToken": {
    "<key>": {
      "secret": "..."
      // No explicit expiry - MSAL handles 90-day sliding window
    }
  }
}
```

### Implementation for `cu status`

```typescript
// Fast path: read cache directly without MSAL initialization
function getQuickAuthStatus(): { isLoggedIn: boolean; expiresAt: Date | null } {
  const cacheFile = path.join(os.homedir(), '.cu', 'msal-cache.json');
  if (!fs.existsSync(cacheFile)) {
    return { isLoggedIn: false, expiresAt: null };
  }
  
  const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const tokens = Object.values(cache.AccessToken ?? {});
  if (tokens.length === 0) {
    return { isLoggedIn: false, expiresAt: null };
  }
  
  const latestToken = tokens[0] as { expires_on: string };
  const expiresAt = new Date(parseInt(latestToken.expires_on) * 1000);
  
  return {
    isLoggedIn: expiresAt > new Date(),
    expiresAt,
  };
}
```

---

## 3. API Key Authentication

### Decision: Use `Ocp-Apim-Subscription-Key` Header

### Rationale
This is the standard Azure Cognitive Services API key header, confirmed to work with Content Understanding API (2025-11-01).

### Implementation Pattern

```typescript
// In ContentUnderstandingClient.request()
private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const config = getConfigService().getActiveProfile();
  const apiKey = config.profile.apiKey;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (apiKey) {
    // API key takes priority over Azure AD
    headers['Ocp-Apim-Subscription-Key'] = apiKey;
  } else {
    // Fall back to Azure AD bearer token
    const token = await this.getAccessToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // ... rest of request
}
```

### Error Responses
| Code | Meaning | CLI Action |
|------|---------|------------|
| 401 | Invalid or missing API key | "API key invalid. Check your API key with `cu config show`" |
| 403 | Key valid but no permission | "Access denied. Check resource permissions" |
| 429 | Rate limited | "Rate limited. Wait and retry" |

### Storage Considerations

Current approach: Store in `config.json` alongside endpoint. This is consistent with how other CLI tools (az, aws) handle credentials.

```json
// ~/.cu/config.json
{
  "version": "1",
  "activeProfile": "default",
  "profiles": {
    "default": {
      "endpoint": "https://my-resource.cognitiveservices.azure.com",
      "apiKey": "abc123..."  // NEW: Optional API key
    }
  }
}
```

### Security Note
API keys in config files have the same security model as Azure CLI's credential storage. For enhanced security, users can:
- Use environment variables (`CU_API_KEY`)
- Use Azure AD authentication (existing flow)

---

## 4. Raw JSON Output

### Decision: Store Raw API Response, Transform Only for Table/Overlay

### Rationale
Currently, `ContentUnderstandingClient.analyzeContent()` transforms the API response into internal `AnalysisResult` type. For raw JSON output, we need the untransformed response.

### Current Flow
```
API Response → parseAnalysisResult() → AnalysisResult → toJsonOutput() → stdout
```

### New Flow for `--format json`
```
API Response → stdout (no transformation)
```

### Implementation Pattern

```typescript
interface AnalyzeOptions {
  rawJson?: boolean;  // When true, return raw API response
}

async analyzeContent(
  analyzerId: string,
  content: ContentSource,
  options?: AnalyzeOptions
): Promise<AnalysisResult | unknown> {
  // ... submit and poll for result
  
  const response = await this.getOperationResult(operationId);
  
  if (options?.rawJson) {
    return response;  // Return raw API response
  }
  
  return this.parseAnalysisResult(response);  // Existing transformation
}
```

### Benefits
- Future-proof: New API fields automatically appear in JSON output
- Debugging: Users see exactly what the API returns
- Integration: Downstream tools get full fidelity

### Impact on Other Formats
- **Table format**: Continue using transformed `AnalysisResult` for consistent display
- **Overlay format**: Continue using transformed data for bounding box extraction

---

## Dependencies Summary

### New Dependencies

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `pdf-to-png-converter` | ^3.x | optional | PDF page rendering |

### Updated package.json

```json
{
  "optionalDependencies": {
    "sharp": "^0.34.5",
    "pdf-to-png-converter": "^3.0.0"
  }
}
```

Both libraries are optional and lazy-loaded to maintain <200ms startup time.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| pdf-to-png-converter requires Node 20+ | Project already targets Node 18+; may need to bump |
| Large package size (~40MB) | Optional dependency, not included in base install |
| Breaking changes in API response | JSON output is raw passthrough; table/overlay use defined fields |
