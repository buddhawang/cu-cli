# Quickstart: CLI Enhancements Development

**Date**: 2026-01-27  
**Feature**: [spec.md](spec.md)

---

## Prerequisites

- Node.js 20+ (required for pdf-to-png-converter)
- npm 9+
- Git
- Azure subscription with Content Understanding resource (for testing)

---

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd cu-cli
git checkout 002-cli-enhancements

npm install

# Install optional dependencies for full functionality
npm install sharp pdf-to-png-converter
```

### 2. Build

```bash
npm run build
```

### 3. Configure Test Environment

```bash
# Set up a test profile
node dist/cu.cjs config set \
  --endpoint https://your-resource.cognitiveservices.azure.com \
  --api-key your-api-key-here
```

---

## Feature Implementation Guide

### Feature 1: API Key Authentication (P1)

**Files to modify**:
- `src/models/config.ts` - Add `apiKey` to `ConfigProfile`
- `src/services/config.ts` - Handle `--api-key` option storage
- `src/commands/config.ts` - Add `--api-key` CLI option
- `src/services/content-understanding.ts` - Use API key header when present

**Test command**:
```bash
# Set API key
node dist/cu.cjs config set --api-key test123

# Verify it's stored
node dist/cu.cjs config show --json

# Test API call uses API key
node dist/cu.cjs analyze test.pdf --analyzer prebuilt-invoice --json
```

**Contract test**:
```bash
npm test -- tests/contract/config.test.ts
```

---

### Feature 2: Token Refresh Optimization (P2)

**Files to modify**:
- `src/models/auth.ts` - Extend `AuthState` with `needsRefresh`
- `src/services/auth.ts` - Add cache inspection methods
- `src/commands/status.ts` - New command file

**Test command**:
```bash
# Check auth status
node dist/cu.cjs status

# JSON output
node dist/cu.cjs status --json
```

**Key implementation notes**:
- MSAL already handles token refresh automatically
- `cu status` should read cache directly for fast response (no network call)
- Show token expiry time and whether refresh is needed

---

### Feature 3: Raw JSON Output (P2)

**Files to modify**:
- `src/services/content-understanding.ts` - Add `rawJson` option to `analyzeContent()`
- `src/commands/analyze.ts` - Pass through raw response for `--format json`

**Test command**:
```bash
# Compare raw vs transformed output
node dist/cu.cjs analyze test.pdf --analyzer prebuilt-invoice --format json > raw.json
node dist/cu.cjs analyze test.pdf --analyzer prebuilt-invoice --format table
```

**Key implementation notes**:
- Do NOT parse API response into `AnalysisResult` for JSON output
- Return the raw response object directly
- Table and overlay formats continue to use transformed data

---

### Feature 4: PDF Overlay Rendering (P3)

**Files to create**:
- `src/lib/pdf-renderer.ts` - Wrapper for pdf-to-png-converter

**Files to modify**:
- `src/services/formatters/overlay.ts` - Call PDF renderer for PDF files
- `src/commands/analyze.ts` - Add `--dpi` option, handle multi-page output

**Test command**:
```bash
# Single page PDF overlay
node dist/cu.cjs analyze invoice.pdf --analyzer prebuilt-invoice --format overlay --output result.png

# Multi-page PDF
node dist/cu.cjs analyze multi-page.pdf --analyzer prebuilt-document --format overlay --output result.png
# Creates: result-1.png, result-2.png, ...

# Specific page
node dist/cu.cjs analyze multi-page.pdf --analyzer prebuilt-document --format overlay --page 2 --output result.png

# Custom DPI
node dist/cu.cjs analyze invoice.pdf --analyzer prebuilt-invoice --format overlay --dpi 300 --output result.png
```

**Key implementation notes**:
- Lazy-load `pdf-to-png-converter` to maintain startup time
- Convert DPI to scale factor: `scale = dpi / 72`
- Use sharp for overlay compositing (already lazy-loaded)

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Files

```bash
# Unit tests
npm test -- tests/unit/services/auth.test.ts
npm test -- tests/unit/services/config.test.ts

# Contract tests  
npm test -- tests/contract/config.test.ts
npm test -- tests/contract/analyze.test.ts

# Integration tests
npm test -- tests/integration/pdf-overlay.test.ts
```

### Test Coverage

```bash
npm run test:coverage
```

---

## Common Issues

### "pdf-to-png-converter not found"

```bash
npm install pdf-to-png-converter
```

This is an optional dependency. The CLI works without it but PDF overlay will fail.

### "sharp not found"

```bash
npm install sharp
```

Required for all overlay operations (both image and PDF).

### "Node.js version too old"

pdf-to-png-converter requires Node.js 20+. Update your Node.js installation.

### API Key not working

1. Check the key is configured: `node dist/cu.cjs config show --json`
2. Verify the endpoint matches the key's resource
3. Check Azure portal for key validity

---

## Architecture Notes

### Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│                    API Request                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Check for API Key    │
              │  in active profile    │
              └───────────────────────┘
                    │           │
            has key │           │ no key
                    ▼           ▼
       ┌────────────────┐  ┌─────────────────────┐
       │ Use API Key    │  │ Use Azure AD Token  │
       │ Header         │  │ (auto-refresh)      │
       └────────────────┘  └─────────────────────┘
                    │           │
                    ▼           ▼
              ┌───────────────────────┐
              │   Make API Request    │
              └───────────────────────┘
```

### PDF Overlay Flow

```
┌─────────────────────────────────────────────────────────┐
│          cu analyze doc.pdf --format overlay            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Detect PDF input     │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Lazy-load            │
              │  pdf-to-png-converter │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Render pages to PNG  │
              │  at specified DPI     │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  For each page:       │
              │  - Call analyze API   │
              │  - Extract boxes      │
              │  - Convert coords     │◄── IMPORTANT: inch → pixel
              │  - Composite overlay  │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Save output files    │
              │  (result-1.png, ...)  │
              └───────────────────────┘
```

**Coordinate Conversion Note**: The API returns bounding box coordinates in inches (PDF units). When rendering overlays on PDF-derived images, you MUST convert coordinates to pixels:

```typescript
// pixel = inch × DPI
const pixelCoord = inchCoord * dpi;  // e.g., 2.5" × 150 DPI = 375px
```

---

## Code Style

Follow existing patterns in the codebase:

- TSDoc comments on all public functions
- Error handling with `CliError` class
- Lazy loading for optional dependencies
- Constitution compliance (see `.specify/memory/constitution.md`)
