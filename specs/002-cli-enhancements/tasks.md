# Tasks: CLI Enhancements

**Input**: Design documents from `/specs/002-cli-enhancements/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1-4]**: Which user story this task belongs to
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Add new dependency and prepare project structure

- [x] T001 Add `pdf-to-png-converter` as optional dependency in package.json
- [x] T002 [P] Bump version to 0.2.0 in package.json (breaking JSON output change)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared model and service changes that multiple user stories depend on

**⚠️ CRITICAL**: These must complete before user story implementation

- [x] T003 Extend `ConfigProfile` interface with optional `apiKey` field in src/models/config.ts
- [x] T004 [P] Extend `AuthState` interface with `isApiKey` and `needsRefresh` fields in src/models/auth.ts
- [x] T005 [P] Add `AuthMethod` type (`'azure-ad' | 'api-key' | 'none'`) in src/models/auth.ts

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - API Key Authentication (Priority: P1) 🎯 MVP

**Goal**: Users can configure and use API keys for authentication instead of Azure AD

**Independent Test**: Run `cu config set --api-key <key>` then `cu analyze test.pdf --analyzer prebuilt-invoice` without prior `cu login`

### Implementation for User Story 1

- [ ] T006 [US1] Update `ConfigService.setProfile()` to accept and store `apiKey` in src/services/config.ts
- [ ] T007 [US1] Add `--api-key` option to config set command in src/commands/config.ts
- [ ] T008 [US1] Update `cu config show` to display masked API key status (e.g., `•••xyz`) in src/commands/config.ts
- [ ] T009 [US1] Add `cu config unset api-key` subcommand to remove API key from profile in src/commands/config.ts
- [ ] T010 [US1] Add `getApiKey()` method to `ConfigService` to retrieve API key from active profile in src/services/config.ts
- [ ] T011 [US1] Modify `ContentUnderstandingClient.request()` to use `Ocp-Apim-Subscription-Key` header when API key present in src/services/content-understanding.ts
- [ ] T012 [US1] Add API key priority logic: use API key if present, else fall back to Azure AD token in src/services/content-understanding.ts
- [ ] T013 [US1] Add clear error messages for invalid API key (401 response) in src/services/content-understanding.ts
- [ ] T014 [P] [US1] Add unit tests for API key storage in ConfigService in tests/unit/services/config.test.ts
- [ ] T015 [P] [US1] Add contract tests for `cu config set --api-key` and `cu config unset api-key` in tests/contract/config.test.ts

**Checkpoint**: User Story 1 complete - API key authentication works independently

---

## Phase 4: User Story 2 - Authentication Token Refresh Optimization (Priority: P2)

**Goal**: Users see auth status and experience seamless token refresh

**Independent Test**: Run `cu status` to see authentication status and token expiry time

### Implementation for User Story 2

- [ ] T016 [US2] Add `getQuickAuthStatus()` function for fast cache inspection in src/services/auth.ts
- [ ] T017 [US2] Extend `AuthService.getAuthState()` to include `needsRefresh` calculation (within 5 min of expiry) in src/services/auth.ts
- [ ] T018 [US2] Create new `src/commands/status.ts` file with `cu status` command
- [ ] T019 [US2] Implement human-readable status output (user, expiry, auth method, profile info) in src/commands/status.ts
- [ ] T020 [US2] Implement JSON output for `cu status --json` in src/commands/status.ts
- [ ] T021 [US2] Register status command in CLI entry point in src/index.ts
- [ ] T022 [P] [US2] Add unit tests for `getQuickAuthStatus()` in tests/unit/services/auth.test.ts
- [ ] T023 [P] [US2] Add contract tests for `cu status` command in tests/contract/status.test.ts

**Checkpoint**: User Story 2 complete - `cu status` works independently

---

## Phase 5: User Story 3 - Raw JSON Service Response (Priority: P2)

**Goal**: `--format json` returns unmodified API response

**Independent Test**: Run `cu analyze test.pdf --format json` and verify output matches raw API response structure

### Implementation for User Story 3

- [ ] T024 [US3] Add `rawJson` option to `analyzeContent()` method signature in src/services/content-understanding.ts
- [ ] T025 [US3] Modify `analyzeContent()` to return raw API response when `rawJson: true` in src/services/content-understanding.ts
- [ ] T026 [US3] Update analyze command to pass `rawJson: true` for `--format json` in src/commands/analyze.ts
- [ ] T027 [US3] Ensure raw JSON output goes to stdout without progress indicators in src/commands/analyze.ts
- [ ] T028 [P] [US3] Add contract tests verifying raw JSON structure matches API in tests/contract/analyze.test.ts

**Checkpoint**: User Story 3 complete - JSON output returns raw API response

---

## Phase 6: User Story 4 - PDF Overlay Rendering (Priority: P3)

**Goal**: Users can visualize extraction results overlaid on PDF documents

**Independent Test**: Run `cu analyze invoice.pdf --format overlay --output result.png` and verify PNG shows PDF with bounding boxes

### Implementation for User Story 4

- [ ] T029 [US4] Create `src/lib/pdf-renderer.ts` with `PdfRenderOptions` and `PdfRenderResult` interfaces
- [ ] T030 [US4] Implement `renderPdfPage()` function with lazy-loaded `pdf-to-png-converter` in src/lib/pdf-renderer.ts
- [ ] T031 [US4] Implement `renderAllPdfPages()` function for multi-page PDFs in src/lib/pdf-renderer.ts
- [ ] T032 [US4] Add `convertInchesToPixels()` function for coordinate conversion in src/services/formatters/overlay.ts
- [ ] T033 [US4] Modify `renderOverlay()` to detect PDF input and render to image first in src/services/formatters/overlay.ts
- [ ] T034 [US4] Apply coordinate conversion (inch → pixel) when source is PDF in src/services/formatters/overlay.ts
- [ ] T035 [US4] Add `--dpi` option to analyze command for PDF rendering resolution in src/commands/analyze.ts
- [ ] T036 [US4] Add `--page` option to analyze command for single-page PDF overlay in src/commands/analyze.ts
- [ ] T037 [US4] Implement multi-page output naming (e.g., `result-1.png`, `result-2.png`) in src/commands/analyze.ts
- [ ] T038 [US4] Add error handling for password-protected and corrupted PDFs in src/lib/pdf-renderer.ts
- [ ] T039 [US4] Add helpful error message when `pdf-to-png-converter` is not installed in src/lib/pdf-renderer.ts
- [ ] T040 [P] [US4] Add unit tests for PDF renderer in tests/unit/lib/pdf-renderer.test.ts
- [ ] T041 [P] [US4] Add unit tests for coordinate conversion in tests/unit/services/formatters/overlay.test.ts
- [ ] T042 [P] [US4] Add integration tests for PDF overlay workflow in tests/integration/pdf-overlay.test.ts

**Checkpoint**: User Story 4 complete - PDF overlay rendering works independently

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and validation

- [ ] T043 [P] Update README.md with new features (API key, status command, PDF overlay)
- [ ] T044 [P] Update CHANGELOG.md with 0.2.0 changes
- [ ] T045 [P] Add `--help` examples for new options in all modified commands
- [ ] T046 Run quickstart.md validation steps to verify all features work end-to-end
- [ ] T047 Run full test suite and verify >80% coverage on new code

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ──────────────────────────────────────────────────────┐
                                                                     │
Phase 2: Foundational ───────────────────────────────────────────────┤
                                                                     │
         ┌───────────────────────────────────────────────────────────┘
         │
         ▼
   ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
   │                 │                 │                 │                 │
   ▼                 ▼                 ▼                 ▼                 │
Phase 3:         Phase 4:         Phase 5:         Phase 6:               │
US1 API Key      US2 Auth         US3 Raw JSON     US4 PDF Overlay        │
(P1 MVP)         (P2)             (P2)             (P3)                   │
   │                 │                 │                 │                 │
   └────────────────┴─────────────────┴─────────────────┴─────────────────┘
                                      │
                                      ▼
                              Phase 7: Polish
```

### User Story Independence

| Story | Can Start After | Dependencies on Other Stories |
|-------|-----------------|------------------------------|
| US1 (API Key) | Phase 2 | None |
| US2 (Auth Status) | Phase 2 | None |
| US3 (Raw JSON) | Phase 2 | None |
| US4 (PDF Overlay) | Phase 2 | None |

**All user stories are independent and can be worked on in parallel after Phase 2 completes.**

### Parallel Opportunities Per Phase

**Phase 2**:
```bash
# Run in parallel:
T004 "Extend AuthState interface..."
T005 "Add AuthMethod type..."
```

**Phase 3 (US1)**:
```bash
# Run in parallel at end:
T013 "Unit tests for API key storage..."
T014 "Contract tests for cu config set --api-key..."
```

**Phase 4 (US2)**:
```bash
# Run in parallel at end:
T021 "Unit tests for getQuickAuthStatus..."
T022 "Contract tests for cu status..."
```

**Phase 6 (US4)**:
```bash
# Run in parallel at end:
T039 "Unit tests for PDF renderer..."
T040 "Unit tests for coordinate conversion..."
T041 "Integration tests for PDF overlay..."
```

**Phase 7**:
```bash
# All can run in parallel:
T042 "Update README.md..."
T043 "Update CHANGELOG.md..."
T044 "Add --help examples..."
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T005)
3. Complete Phase 3: User Story 1 - API Key (T006-T015)
4. **STOP and VALIDATE**: Test API key auth independently
5. Deploy/demo if ready - MVP complete!

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (API Key) → Test → Deploy (MVP!)
3. Add US2 (Auth Status) → Test → Deploy
4. Add US3 (Raw JSON) → Test → Deploy
5. Add US4 (PDF Overlay) → Test → Deploy
6. Polish → Final release

### Task Count Summary

| Phase | Tasks | Parallelizable |
|-------|-------|---------------|
| Phase 1: Setup | 2 | 1 |
| Phase 2: Foundational | 3 | 2 |
| Phase 3: US1 API Key | 10 | 2 |
| Phase 4: US2 Auth Status | 8 | 2 |
| Phase 5: US3 Raw JSON | 5 | 1 |
| Phase 6: US4 PDF Overlay | 14 | 3 |
| Phase 7: Polish | 5 | 3 |
| **Total** | **47** | **14** |

---

## Notes

- All optional dependencies (`sharp`, `pdf-to-png-converter`) must be lazy-loaded per Constitution IV
- JSON output format change is breaking → version bump to 0.2.0
- Coordinate conversion (inch → pixel) is critical for PDF overlay accuracy
- Each user story checkpoint validates independent functionality
- Commit after each task or logical group
