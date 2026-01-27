# Implementation Plan: CLI Enhancements

**Branch**: `002-cli-enhancements` | **Date**: 2026-01-27 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/002-cli-enhancements/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Four CLI enhancements to improve authentication flexibility, service compatibility, and document visualization:

1. **API Key Authentication** (P1) - Add `--api-key` option to `cu config set`, use `Ocp-Apim-Subscription-Key` header when present
2. **Token Refresh Optimization** (P2) - Leverage MSAL's silent token refresh, add `cu status` command
3. **Raw JSON Output** (P2) - Pass through unmodified API response for `--format json`
4. **PDF Overlay Rendering** (P3) - Use pdf-to-png-converter to render PDF pages to images for overlay visualization

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 18+  
**Primary Dependencies**: commander@12, @azure/msal-node@2, sharp@0.34 (optional), pdf-to-png-converter (new)  
**Storage**: JSON files in `~/.cu/` (config.json, msal-cache.json)  
**Testing**: vitest (unit, contract, integration test structure exists)  
**Target Platform**: Windows, macOS, Linux (Node.js CLI)  
**Project Type**: Single (bundled CLI application via esbuild)  
**Performance Goals**: CLI startup <200ms, PDF overlay <10s for 5 pages  
**Constraints**: <200ms startup (Constitution IV), lazy-load optional deps  
**Scale/Scope**: Single-user CLI tool, ~3K LOC current

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | This Feature | Status |
|-----------|-------------|--------------|--------|
| **I. Code Quality** | Self-documenting code, single responsibility | Each feature isolated in dedicated files/services | ✅ PASS |
| **I. Code Quality** | No dead code, proper error handling | Extending existing patterns with clear error paths | ✅ PASS |
| **I. Code Quality** | Type Safety - no `any` | All new code fully typed | ✅ PASS |
| **II. Testing** | New code MUST include tests | Contract + unit tests for each feature | ✅ PASS |
| **II. Testing** | Contract tests for API boundaries | CLI commands, config options, JSON output | ✅ PASS |
| **III. UX Consistency** | `cu <verb> <noun> [options]` pattern | `cu status`, `cu config set --api-key` follows pattern | ✅ PASS |
| **III. UX Consistency** | stdout for output, stderr for errors | JSON output to stdout, errors to stderr | ✅ PASS |
| **III. UX Consistency** | `--json` flag for machine-readable | Already exists; raw JSON enhances this | ✅ PASS |
| **III. UX Consistency** | Helpful error messages | API key errors include "what, why, how to fix" | ✅ PASS |
| **IV. Performance** | CLI startup <200ms | pdfjs-dist must be lazy-loaded | ⚠️ REQUIRES LAZY LOAD |
| **IV. Performance** | Lazy loading for optional features | PDF rendering, sharp already lazy-loaded | ✅ PASS |
| **Quality Gates** | 80% coverage for new code | Test plan includes all features | ✅ PASS |

**Gate Result**: ✅ PASS with condition - pdfjs-dist MUST be lazy-loaded to maintain startup performance

### Post-Design Re-Check (Phase 1 Complete)

| Design Decision | Constitution Compliance | Status |
|-----------------|------------------------|--------|
| `pdf-to-png-converter` as optional dep | IV. Lazy loading for optional features | ✅ PASS |
| Raw JSON passthrough | III. `--json` for machine-readable | ✅ PASS |
| `cu status` command | III. `cu <verb>` pattern | ✅ PASS |
| API key in config.json | I. Single responsibility (config service) | ✅ PASS |
| Breaking change in JSON output | Documented in contract | ⚠️ SEMVER BUMP |

**Post-Design Gate Result**: ✅ PASS - Version should bump to 0.2.0 due to breaking JSON output change

## Project Structure

### Documentation (this feature)

```text
specs/002-cli-enhancements/
├── plan.md              # This file
├── research.md          # Phase 0 output - PDF libraries, MSAL patterns
├── data-model.md        # Phase 1 output - ConfigProfile extension, AuthState
├── quickstart.md        # Phase 1 output - Developer onboarding
├── contracts/           # Phase 1 output - CLI command contracts, API changes
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── commands/
│   ├── analyze.ts       # MODIFY: raw JSON output, PDF overlay support
│   ├── config.ts        # MODIFY: --api-key option
│   └── status.ts        # NEW: cu status command
├── models/
│   ├── auth.ts          # MODIFY: extend AuthState with token expiry details
│   └── config.ts        # MODIFY: add apiKey to ConfigProfile
├── services/
│   ├── auth.ts          # MODIFY: expose token expiry, improve refresh logic
│   ├── config.ts        # MODIFY: handle apiKey storage
│   ├── content-understanding.ts  # MODIFY: support API key auth, raw response
│   └── formatters/
│       └── overlay.ts   # MODIFY: PDF-to-image conversion
└── lib/
    └── pdf-renderer.ts  # NEW: pdfjs-dist wrapper (lazy-loaded)

tests/
├── contract/
│   ├── config.test.ts   # ADD: --api-key tests
│   ├── status.test.ts   # NEW: cu status tests
│   └── analyze.test.ts  # ADD: raw JSON, PDF overlay tests
├── integration/
│   └── pdf-overlay.test.ts  # NEW: PDF rendering integration
└── unit/
    ├── services/
    │   ├── auth.test.ts     # ADD: token refresh tests
    │   └── config.test.ts   # ADD: apiKey handling
    └── lib/
        └── pdf-renderer.test.ts  # NEW: PDF rendering unit tests
```

**Structure Decision**: Extends existing single-project structure. New files only for genuinely new functionality (`status.ts`, `pdf-renderer.ts`). All other changes extend existing modules.

## Complexity Tracking

> No Constitution violations requiring justification. pdfjs-dist dependency is justified by PDF overlay requirement (FR-015) and will be lazy-loaded per Constitution IV.
