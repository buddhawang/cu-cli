# Research: Azure Content Understanding CLI

**Date**: 2026-01-22  
**Feature**: [spec.md](spec.md) | [plan.md](plan.md)

## Overview

This document consolidates research findings to resolve technical decisions for the cu-cli implementation. All NEEDS CLARIFICATION items from planning have been resolved.

---

## 1. Authentication Flow

### Decision: Authorization Code Flow with PKCE

**Rationale**: 
- Opens browser automatically for seamless SSO experience
- PKCE prevents authorization code interception attacks
- Microsoft's primary recommendation for public client applications
- Device Code Flow reserved as fallback for headless/SSH environments

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Device Code Flow | Requires manual code entry, worse UX for desktop users |
| API Keys | Spec explicitly prohibits stored keys; less secure |
| Managed Identity | Only works in Azure-hosted environments |

### Implementation Pattern

```typescript
import { PublicClientApplication } from "@azure/msal-node";
import open from "open";

// Primary: Interactive browser login
async function loginInteractive(pca: PublicClientApplication): Promise<AuthenticationResult> {
  return pca.acquireTokenInteractive({
    scopes: ["https://cognitiveservices.azure.com/.default"],
    openBrowser: async (url) => { await open(url); },
    successTemplate: "✅ Authenticated! You can close this window.",
    errorTemplate: "❌ Authentication failed. Please try again.",
  });
}

// Secondary: Silent token acquisition
async function getTokenSilently(pca: PublicClientApplication): Promise<AuthenticationResult | null> {
  const accounts = await pca.getTokenCache().getAllAccounts();
  if (accounts.length === 0) return null;
  
  try {
    return await pca.acquireTokenSilent({ account: accounts[0], scopes });
  } catch {
    return null; // Fall back to interactive
  }
}
```

### Token Scope
- **Scope**: `https://cognitiveservices.azure.com/.default`
- Provides access to all Azure Cognitive Services including Content Understanding

---

## 2. Token Caching & Credential Storage

### Decision: @azure/msal-node-extensions

**Rationale**:
- Official Microsoft library with direct MSAL integration
- Pre-compiled binaries for all platforms
- Handles encryption automatically per-platform
- Active maintenance (unlike archived `keytar`)

**Platform Behavior**:
| Platform | Encryption Method | Notes |
|----------|-------------------|-------|
| Windows | DPAPI | Automatic, no setup required |
| macOS | Keychain | Automatic, no setup required |
| Linux | libsecret | Requires `libsecret-1-dev` package |

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| `keytar` | Archived/unmaintained for 4+ years |
| Plain JSON file | Insecure; tokens stored in plaintext |
| Environment variables | UX burden; doesn't persist across sessions |

### Fallback Strategy

```typescript
async function createPersistence(): Promise<IPersistence> {
  try {
    // Attempt OS credential store
    return await PersistenceCreator.createPersistence({
      cachePath: path.join(os.homedir(), ".cu", "cache.json"),
      dataProtectionScope: DataProtectionScope.CurrentUser,
      serviceName: "cu-cli",
      accountName: "azure-tokens",
    });
  } catch {
    // Fallback: encrypted file with user-provided key
    console.warn("⚠️ OS credential store unavailable. Using encrypted file storage.");
    return new EncryptedFilePersistence(cachePath);
  }
}
```

### Linux Dependency Note

Document in README:
```bash
# Debian/Ubuntu
sudo apt-get install libsecret-1-dev

# RHEL/CentOS/Fedora
sudo dnf install libsecret-devel
```

---

## 3. Azure Content Understanding API

### API Base Pattern

```
{endpoint}/contentunderstanding/...?api-version=2025-11-01
```

Where `{endpoint}` is the Cognitive Services resource URL:
```
https://{resource-name}.cognitiveservices.azure.com
```

### Authentication Header

```http
Authorization: Bearer {access-token}
```

### Key Endpoints

| Operation | Method | Endpoint |
|-----------|--------|----------|
| List Analyzers | `GET` | `/contentunderstanding/analyzers` |
| Get Analyzer | `GET` | `/contentunderstanding/analyzers/{id}` |
| Analyze Document | `POST` | `/contentunderstanding/analyzers/{id}:analyze` |
| Get Analysis Result | `GET` | `/contentunderstanding/analyzerResults/{operationId}` |
| Get Result File | `GET` | `/contentunderstanding/analyzerResults/{operationId}/files/{fileId}` |

### Async Operation Pattern (LRO)

1. **Submit**: `POST .../analyzers/{id}:analyze` → Returns `202 Accepted` with `Operation-Location` header
2. **Poll**: `GET {Operation-Location}` until status is `Succeeded` or `Failed`
3. **Status Values**: `NotStarted` → `Running` → `Succeeded`/`Failed`/`Canceled`

**Polling Best Practice**: Minimum 1 second between requests

### Analyze Request Format

```json
{
  "inputs": [
    {
      "url": "https://example.com/doc.pdf",
      "mimeType": "application/pdf",
      "range": "1-3"
    }
  ]
}
```

For binary uploads:
```json
{
  "inputs": [
    {
      "data": "<base64-encoded-content>",
      "mimeType": "application/pdf"
    }
  ]
}
```

### Error Response Format

```json
{
  "error": {
    "code": "InvalidRequest",
    "message": "Human-readable description",
    "details": [...]
  }
}
```

### Rate Limits

| Resource | Limit |
|----------|-------|
| Operations/minute | 3,000 |
| Pages/minute | 1,000 |
| Max file size | 200 MB |
| Max pages/document | 300 |

### Prebuilt Analyzers

| Analyzer ID | Purpose |
|-------------|---------|
| `prebuilt-document` | General document processing |
| `prebuilt-invoice` | Invoice extraction |
| `prebuilt-receipt` | Receipt extraction |
| `prebuilt-imageAnalyzer` | Image analysis |
| `prebuilt-audioAnalyzer` | Audio transcription |
| `prebuilt-videoAnalyzer` | Video analysis |

---

## 4. CLI Startup Optimization

### Decision: Bundle with esbuild, ESM source → CJS output

**Rationale**:
- **Bundling is critical**: Loading 1000+ modules = ~310ms; 1 bundled file < 50ms
- **ESM source**: Better tree-shaking, modern standard
- **CJS output**: Faster synchronous require() in Node.js

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| No bundling | Too slow; module resolution overhead kills startup |
| ESM output | Dynamic import() adds latency vs synchronous require() |
| Rollup | Slower than esbuild; more complex config |

### Optimization Techniques

1. **Lazy load commands**:
   ```typescript
   program.command("analyze")
     .action(async (opts) => {
       const { analyze } = await import("./commands/analyze.js");
       await analyze(opts);
     });
   ```

2. **Avoid barrel files**: Don't use `export * from` patterns

3. **Minimal top-level imports**: Only `commander` at startup

4. **Tree-shaking config**:
   ```json
   { "sideEffects": false }
   ```

### Build Configuration

```typescript
// build.mjs
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: "dist/cu.cjs",
  minify: true,
  treeShaking: true,
  external: [
    "@azure/msal-node-extensions", // Native bindings
  ],
});
```

### Benchmarking

```powershell
# Target: <200ms for --help
1..10 | ForEach-Object { 
  (Measure-Command { node dist/cu.cjs --help }).TotalMilliseconds 
} | Measure-Object -Average
```

| Command | Target | Acceptable |
|---------|--------|------------|
| `--version` | <50ms | <100ms |
| `--help` | <100ms | <150ms |
| Simple commands | <200ms | <300ms |

---

## 5. Configuration Storage

### Decision: Local JSON file at `~/.cu/config.json`

**Rationale**:
- Simple, portable, human-readable
- Easy to backup/share configurations
- Supports multiple profiles natively
- No external dependencies

### Configuration Schema

```json
{
  "version": "1",
  "activeProfile": "default",
  "profiles": {
    "default": {
      "endpoint": "https://my-resource.cognitiveservices.azure.com",
      "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "resourceGroup": "my-rg",
      "resourceName": "my-resource"
    },
    "staging": {
      "endpoint": "https://staging-resource.cognitiveservices.azure.com",
      "subscriptionId": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
    }
  }
}
```

### Storage Location

| Platform | Path |
|----------|------|
| Windows | `%USERPROFILE%\.cu\config.json` |
| macOS | `~/.cu/config.json` |
| Linux | `~/.cu/config.json` |

**Note**: Tokens are NOT stored in this file; they're in the OS credential store via msal-node-extensions.

---

## 6. Output Formatting

### Decision: Custom formatters with minimal dependencies

**Rationale**:
- Avoid heavy table/markdown libraries for startup performance
- JSON output is trivial (`JSON.stringify`)
- Table output can use simple string formatting
- Markdown is text manipulation, no library needed

### Implementation

```typescript
// src/services/formatters/index.ts
export interface Formatter {
  format(data: unknown): string;
}

// Lazy-loaded formatters
export async function getFormatter(format: "json" | "table" | "markdown"): Promise<Formatter> {
  switch (format) {
    case "json": return { format: (d) => JSON.stringify(d, null, 2) };
    case "table": return (await import("./table.js")).TableFormatter;
    case "markdown": return (await import("./markdown.js")).MarkdownFormatter;
  }
}
```

### Image Overlay (P3 Feature)

For overlay generation, lazy-load `sharp` or `canvas`:
- **sharp**: Fast, native, good for simple overlays
- Only loaded when `--format overlay` is used

---

## 7. Dependencies Summary

### Core Dependencies (always loaded)

```json
{
  "commander": "^12.x",
  "@azure/msal-node": "^2.x"
}
```

### Lazy-Loaded Dependencies

```json
{
  "@azure/msal-node-extensions": "^1.x",  // Token persistence
  "open": "^10.x",                         // Browser launch
  "sharp": "^0.33.x"                       // Image overlay (P3)
}
```

### Dev Dependencies

```json
{
  "typescript": "^5.x",
  "esbuild": "^0.20.x",
  "vitest": "^1.x",
  "@types/node": "^20.x",
  "eslint": "^8.x",
  "prettier": "^3.x"
}
```

---

## 8. Error Handling Strategy

### Error Classification

| Category | Exit Code | User Action |
|----------|-----------|-------------|
| Auth required | 1 | Run `cu login` |
| Config missing | 2 | Run `cu config set --endpoint <url>` |
| Network error | 3 | Check connection, retry |
| API error (4xx) | 4 | Fix request based on message |
| API error (5xx) | 5 | Retry later |
| File not found | 6 | Check file path |

### Error Message Format

```
Error: [CODE] What went wrong

Why: Brief explanation of the cause

Fix: Specific action to resolve
     $ cu <suggested-command>
```

### Retry Policy

- **Transient errors**: 429, 500, 502, 503, 504
- **Backoff**: Exponential with jitter (1s, 2s, 4s)
- **Max retries**: 3
- **Respect Retry-After header** when present

---

## Research Complete

All technical decisions have been made. Proceed to Phase 1: Design & Contracts.
