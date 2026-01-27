# Implementation Plan: Azure Content Understanding CLI

**Branch**: `001-azure-cu-cli` | **Date**: 2026-01-22 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-azure-cu-cli/spec.md`

## Summary

Build a portable Node.js/TypeScript CLI (`cu`) that enables engineers to interact with Azure Content Understanding services from the terminal. The CLI provides Azure AD authentication (via MSAL), analyzer discovery, document analysis with multiple output formats (JSON/table/image overlay), and BYOC model deployment management. Configuration is stored locally in files with support for multiple named profiles.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18 LTS+  
**Primary Dependencies**: @azure/msal-node (auth), commander (CLI parsing), minimal additional libraries  
**Storage**: Local JSON file for configuration (~/.cu/config.json), OS credential store for tokens  
**Testing**: Vitest (fast, TypeScript-native, ESM support)  
**Target Platform**: Windows, macOS, Linux (cross-platform Node.js)  
**Project Type**: Single project (CLI application)  
**Performance Goals**: <200ms startup for help/version, <3s for analyzer list, progress within 2s for analysis  
**Constraints**: <200ms cold start for basic commands, minimal dependencies for fast install, no API keys stored  
**Scale/Scope**: Individual developer tool, ~15-20 commands across 6 command groups

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality
| Requirement | Status | Notes |
|-------------|--------|-------|
| Readability First | ✅ PASS | TypeScript with strict mode enforces clear types |
| Single Responsibility | ✅ PASS | Modular structure: commands/, services/, models/ |
| Consistent Style | ✅ PASS | ESLint + Prettier configured |
| No Dead Code | ✅ PASS | Enforced via linting |
| Error Handling | ✅ PASS | All CLI errors include context and remediation |
| Type Safety | ✅ PASS | TypeScript strict mode, no `any` without justification |

### II. Testing Standards
| Requirement | Status | Notes |
|-------------|--------|-------|
| Test Coverage Gate | ✅ PASS | Vitest with coverage ≥80% for new code |
| Test Pyramid | ✅ PASS | Unit + contract + integration tests planned |
| Deterministic Tests | ✅ PASS | Mocked external services |
| Test Naming | ✅ PASS | `should_X_when_Y` convention |
| Contract Tests | ✅ PASS | CLI input/output contracts tested |

### III. User Experience Consistency
| Requirement | Status | Notes |
|-------------|--------|-------|
| Command Structure | ✅ PASS | `cu <verb> <noun> [options]` pattern |
| Predictable Output | ✅ PASS | stdout for data, stderr for errors |
| Format Options | ✅ PASS | `--json` on all structured output commands |
| Helpful Errors | ✅ PASS | What/why/how in all error messages |
| Progressive Disclosure | ✅ PASS | Minimal required flags, advanced options available |
| Documentation Parity | ✅ PASS | `--help` generated from same source as docs |

### IV. Performance Requirements
| Requirement | Status | Notes |
|-------------|--------|-------|
| Startup Time | ✅ PASS | <200ms target, lazy loading for heavy deps |
| Memory Efficiency | ✅ PASS | Streaming for large files |
| Responsiveness | ✅ PASS | Progress feedback within 2s |
| No Regressions | ✅ PASS | Benchmark tests in CI |
| Lazy Loading | ✅ PASS | MSAL, image processing loaded on demand |
| Measurable Goals | ✅ PASS | Defined in spec SC-001 through SC-008 |

**Gate Result**: ✅ PASSED - All constitution requirements satisfied

## Project Structure

### Documentation (this feature)

```text
specs/001-azure-cu-cli/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── index.ts             # Entry point, CLI bootstrap
├── commands/            # Command handlers (one file per command group)
│   ├── login.ts         # cu login, cu logout, cu whoami
│   ├── config.ts        # cu config set/list/use/show
│   ├── analyzer.ts      # cu analyzer list/show
│   ├── analyze.ts       # cu analyze <file>
│   └── deployment.ts    # cu deployment list/set/remove
├── services/            # Business logic (auth, API clients, formatters)
│   ├── auth.ts          # MSAL authentication wrapper
│   ├── config.ts        # Configuration file management
│   ├── content-understanding.ts  # Azure CU API client
│   ├── deployment-manager.ts # BYOC deployment operations
│   └── formatters/      # Output formatters
│       ├── json.ts
│       ├── table.ts
│       └── overlay.ts   # Image overlay generation
├── models/              # TypeScript interfaces and types
│   ├── analyzer.ts      # Analyzer, AnalyzerField types
│   ├── analysis-result.ts  # AnalysisResult, BoundingBox types
│   ├── config.ts        # ConfigProfile, AppConfig types
│   └── deployment.ts    # Deployment, DeploymentStatus types
└── lib/                 # Shared utilities
    ├── errors.ts        # Custom error classes with context
    ├── http.ts          # HTTP client wrapper with retry logic
    ├── progress.ts      # Progress indicator utilities
    └── validation.ts    # Input validation helpers

tests/
├── unit/                # Fast, isolated unit tests
│   ├── services/
│   └── lib/
├── contract/            # CLI input/output contract tests
│   ├── login.test.ts
│   ├── config.test.ts
│   ├── analyzer.test.ts
│   ├── analyze.test.ts
│   └── model.test.ts
└── integration/         # End-to-end with mocked Azure services
    └── workflows/
```

**Structure Decision**: Single project structure selected. CLI is a standalone tool with no backend/frontend separation. All code lives under `src/` with clear separation: `commands/` for CLI handling, `services/` for business logic, `models/` for types, `lib/` for utilities.

## Complexity Tracking

> No violations identified. All design decisions align with Constitution principles.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | — | — |

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion (2026-01-22)*

### Design Decisions Validated

| Decision | Constitution Alignment |
|----------|------------------------|
| **@azure/msal-node** for auth |  Type Safety: Full TypeScript support |
| **@azure/msal-node-extensions** for token storage |  Security: Uses OS credential store, no plaintext tokens |
| **commander** for CLI parsing |  UX Consistency: Enables `cu <verb> <noun>` pattern |
| **esbuild bundling** |  Performance: Achieves <200ms startup target |
| **Vitest** for testing |  Testing Standards: Fast, TypeScript-native |
| **Local JSON config** |  Simplicity: No database, portable across systems |
| **Lazy loading pattern** |  Performance: Heavy deps loaded on-demand |

### Dependency Count Check

| Category | Count | Justification |
|----------|-------|---------------|
| Core runtime | 3 | commander, @azure/msal-node, open (browser launch) |
| Token persistence | 1 | @azure/msal-node-extensions |
| Image overlay (P3) | 1 | sharp (lazy loaded) |
| Dev dependencies | ~8 | TypeScript, esbuild, vitest, eslint, prettier, types |

**Total runtime deps**: 4-5 (minimal as required)

### Final Gate Result

 **PASSED** - All design decisions comply with Constitution v1.0.0

---

## Phase 1 Artifacts Generated

| Artifact | Path | Status |
|----------|------|--------|
| Research | [research.md](research.md) |  Complete |
| Data Model | [data-model.md](data-model.md) |  Complete |
| CLI Commands Contract | [contracts/cli-commands.md](contracts/cli-commands.md) |  Complete |
| Azure API Contract | [contracts/azure-cu-api.md](contracts/azure-cu-api.md) |  Complete |
| Developer Quickstart | [quickstart.md](quickstart.md) |  Complete |

---

## Next Steps

Run `/speckit.tasks` to generate the implementation task list organized by user story priority.

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design completion (2026-01-22)*

### Design Decisions Validated

| Decision | Constitution Alignment |
|----------|------------------------|
| **@azure/msal-node** for auth |  Type Safety: Full TypeScript support |
| **@azure/msal-node-extensions** for token storage |  Security: Uses OS credential store, no plaintext tokens |
| **commander** for CLI parsing |  UX Consistency: Enables `cu <verb> <noun>` pattern |
| **esbuild bundling** |  Performance: Achieves <200ms startup target |
| **Vitest** for testing |  Testing Standards: Fast, TypeScript-native |
| **Local JSON config** |  Simplicity: No database, portable across systems |
| **Lazy loading pattern** |  Performance: Heavy deps loaded on-demand |

### Dependency Count Check

| Category | Count | Justification |
|----------|-------|---------------|
| Core runtime | 3 | commander, @azure/msal-node, open (browser launch) |
| Token persistence | 1 | @azure/msal-node-extensions |
| Image overlay (P3) | 1 | sharp (lazy loaded) |
| Dev dependencies | ~8 | TypeScript, esbuild, vitest, eslint, prettier, types |

**Total runtime deps**: 4-5 (minimal as required)

### Final Gate Result

 **PASSED** - All design decisions comply with Constitution v1.0.0

---

## Phase 1 Artifacts Generated

| Artifact | Path | Status |
|----------|------|--------|
| Research | [research.md](research.md) |  Complete |
| Data Model | [data-model.md](data-model.md) |  Complete |
| CLI Commands Contract | [contracts/cli-commands.md](contracts/cli-commands.md) |  Complete |
| Azure API Contract | [contracts/azure-cu-api.md](contracts/azure-cu-api.md) |  Complete |
| Developer Quickstart | [quickstart.md](quickstart.md) |  Complete |

---

## Next Steps

Run `/speckit.tasks` to generate the implementation task list organized by user story priority.
