# Implementation Plan: Structured Field Overlay Rendering

**Branch**: `003-structured-field-overlay` | **Date**: 2026-01-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-structured-field-overlay/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enhance the overlay renderer to support structured fields (objects and arrays) with full field path visualization. The overlay will recursively traverse nested fields, generate dot/bracket notation paths (e.g., `items[0].amount`, `recipient.address.postalCode`), and render bounding boxes with type-specific colors. Additionally, support multi-content classification results by treating each content segment as a distinct document with indexed prefixes.

## Technical Context

**Language/Version**: TypeScript 5.5, Node.js 18+  
**Primary Dependencies**: sharp (lazy-loaded), pdf-to-png-converter (lazy-loaded), commander 12.x  
**Storage**: N/A (stateless rendering)  
**Testing**: vitest 2.x (unit, contract, integration)  
**Target Platform**: CLI (cross-platform: Windows, macOS, Linux)  
**Project Type**: Single project CLI  
**Performance Goals**: <2 seconds for overlay rendering with 100 extracted fields (per SC-004)  
**Constraints**: <200ms startup time (Constitution IV), lazy load optional dependencies  
**Scale/Scope**: Documents with up to 100+ fields, unlimited nesting depth, multi-page PDFs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| I. Code Quality | Single Responsibility | ✅ PASS | New `extractFieldsRecursively()` function isolates traversal logic |
| I. Code Quality | No Dead Code | ✅ PASS | Enhancement extends existing functions, no dead code |
| I. Code Quality | Error Handling | ✅ PASS | Graceful skip for fields without bounding regions |
| I. Code Quality | Type Safety | ✅ PASS | Full TypeScript with strict mode, no `any` |
| II. Testing Standards | Test Coverage Gate | ✅ PASS | Unit tests for path generation, contract tests for overlay output |
| II. Testing Standards | Contract Tests | ✅ PASS | Overlay formatter interface contract maintained |
| III. UX Consistency | Predictable Output | ✅ PASS | Backward compatible; single-content results unchanged |
| III. UX Consistency | Progressive Disclosure | ✅ PASS | Path filter is optional (P3), default shows all fields |
| IV. Performance | Startup Time <200ms | ✅ PASS | No new startup dependencies; sharp remains lazy-loaded |
| IV. Performance | No Regressions >10% | ✅ PASS | Recursive traversal adds minimal overhead |
| IV. Performance | Lazy Loading | ✅ PASS | No new dependencies to lazy-load |

**Gate Status**: ✅ PASSED - No violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/003-structured-field-overlay/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── models/
│   └── analysis-result.ts    # Existing: ExtractedField, BoundingBox types
├── services/
│   └── formatters/
│       └── overlay.ts        # Modified: Add recursive field extraction
├── commands/
│   └── analyze.ts            # Existing: Invokes overlay formatter
└── lib/
    └── errors.ts             # Existing: CliError for error handling

tests/
├── contract/
│   └── analyze-formats.test.ts  # Add tests for structured field overlay
├── integration/
│   └── analyze-workflow.test.ts # Add E2E tests for nested field rendering
└── unit/
    └── services/
        └── formatters/
            └── overlay.test.ts  # New: Unit tests for path generation, traversal
```

**Structure Decision**: Single project structure. All changes are isolated to `src/services/formatters/overlay.ts` with supporting unit tests. No new files required except test files.

## Complexity Tracking

> No Constitution violations detected. No complexity justifications required.
