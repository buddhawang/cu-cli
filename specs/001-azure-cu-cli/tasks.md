# Tasks: Azure Content Understanding CLI

**Input**: Design documents from `/specs/001-azure-cu-cli/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests are included as part of implementation quality gates per Constitution II.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize Node.js project with package.json at repository root
- [x] T002 Configure TypeScript with tsconfig.json (strict mode, ESM)
- [x] T003 [P] Configure ESLint with .eslintrc.cjs (TypeScript rules)
- [x] T004 [P] Configure Prettier with .prettierrc
- [x] T005 [P] Configure Vitest with vitest.config.ts
- [x] T006 [P] Configure esbuild with build.mjs (bundle to dist/cu.cjs)
- [x] T007 Create directory structure: src/commands/, src/services/, src/models/, src/lib/, tests/unit/, tests/contract/, tests/integration/
- [x] T008 [P] Create .gitignore with node_modules, dist, coverage patterns
- [x] T009 Add npm scripts: build, build:prod, test, lint, format, typecheck

**Checkpoint**: ✅ `npm install && npm run build && npm test` succeeds (verified 2026-01-22)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T010 Create error types with CliError class in src/lib/errors.ts
- [x] T011 [P] Create validation utilities in src/lib/validation.ts (URL validation, file path validation)
- [x] T012 [P] Create HTTP client wrapper with retry logic in src/lib/http.ts
- [x] T013 [P] Create progress indicator utilities in src/lib/progress.ts
- [x] T014 Create CLI entry point with commander in src/index.ts (version, help only)
- [x] T015 Create base output formatter interface in src/services/formatters/index.ts
- [x] T016 [P] Create JSON formatter in src/services/formatters/json.ts
- [x] T017 [P] Create table formatter in src/services/formatters/table.ts
- [x] T018 Unit test for CliError in tests/unit/lib/errors.test.ts
- [x] T019 [P] Unit test for validation utilities in tests/unit/lib/validation.test.ts
- [x] T020 Contract test for CLI version/help in tests/contract/cli-base.test.ts

**Checkpoint**: ✅ Foundation ready - `cu --version` and `cu --help` work in <200ms. User story implementation can now begin.

---

## Phase 3: User Story 1 - Authenticate with Azure (Priority: P1) 🎯 MVP

**Goal**: Enable Azure AD login with silent token refresh and secure credential caching

**Independent Test**: Run `cu login`, complete browser sign-in, then `cu whoami` displays identity

### Implementation for User Story 1

- [x] T021 [P] [US1] Create UserIdentity interface in src/models/auth.ts
- [x] T022 [P] [US1] Create AuthState interface in src/models/auth.ts
- [x] T023 [US1] Create AuthService with MSAL integration in src/services/auth.ts
- [x] T024 [US1] Implement interactive login flow in src/services/auth.ts (acquireTokenInteractive)
- [x] T025 [US1] Implement silent token acquisition in src/services/auth.ts (acquireTokenSilent)
- [x] T026 [US1] Implement token persistence with msal-node-extensions in src/services/auth.ts
- [x] T027 [US1] Implement logout (clear token cache) in src/services/auth.ts
- [x] T028 [US1] Implement getIdentity for whoami in src/services/auth.ts
- [x] T029 [US1] Create login command handler in src/commands/login.ts (cu login)
- [x] T030 [US1] Create logout command handler in src/commands/login.ts (cu logout)
- [x] T031 [US1] Create whoami command handler in src/commands/login.ts (cu whoami)
- [x] T032 [US1] Register login/logout/whoami commands in src/index.ts
- [x] T033 [US1] Unit test for AuthService in tests/unit/services/auth.test.ts
- [x] T034 [US1] Contract test for cu login/logout/whoami in tests/contract/login.test.ts

**Checkpoint**: ✅ User Story 1 complete - `cu login`, `cu logout`, `cu whoami` all work. Authentication flows tested. (verified 2026-01-22)

---

## Phase 4: User Story 2 - Configure Azure Resource Connection (Priority: P1)

**Goal**: Enable multi-profile configuration for targeting different Azure CU resources

**Independent Test**: Run `cu config set --endpoint <url>`, then `cu config show` displays saved endpoint

### Implementation for User Story 2

- [x] T035 [P] [US2] Create ConfigProfile interface in src/models/config.ts
- [x] T036 [P] [US2] Create AppConfig interface in src/models/config.ts
- [x] T037 [US2] Create ConfigService in src/services/config.ts
- [x] T038 [US2] Implement loadConfig (read ~/.cu/config.json) in src/services/config.ts
- [x] T039 [US2] Implement saveConfig (write ~/.cu/config.json) in src/services/config.ts
- [x] T040 [US2] Implement setProfile (create/update profile) in src/services/config.ts
- [x] T041 [US2] Implement useProfile (switch active profile) in src/services/config.ts
- [x] T042 [US2] Implement getActiveProfile in src/services/config.ts
- [x] T043 [US2] Create config set command handler in src/commands/config.ts
- [x] T044 [US2] Create config show command handler in src/commands/config.ts
- [x] T045 [US2] Create config list command handler in src/commands/config.ts
- [x] T046 [US2] Create config use command handler in src/commands/config.ts
- [x] T047 [US2] Register config commands in src/index.ts
- [x] T048 [US2] Unit test for ConfigService in tests/unit/services/config.test.ts
- [x] T049 [US2] Contract test for cu config set/show/list/use in tests/contract/config.test.ts

**Checkpoint**: ✅ User Stories 1 AND 2 complete - Users can authenticate AND configure endpoints. Ready for API calls. (verified 2026-01-23)

---

## Phase 5: User Story 3 - Discover Available Analyzers (Priority: P2)

**Goal**: List and inspect analyzers available in the configured Azure CU resource

**Independent Test**: Run `cu analyzer list` (authenticated + configured) to see available analyzers

### Implementation for User Story 3

- [x] T050 [P] [US3] Create Analyzer interface in src/models/analyzer.ts
- [x] T051 [P] [US3] Create AnalyzerField interface in src/models/analyzer.ts
- [x] T052 [P] [US3] Create AnalyzerList interface in src/models/analyzer.ts
- [x] T053 [US3] Create ContentUnderstandingClient in src/services/content-understanding.ts
- [x] T054 [US3] Implement listAnalyzers API call in src/services/content-understanding.ts
- [x] T055 [US3] Implement getAnalyzer API call in src/services/content-understanding.ts
- [x] T056 [US3] Integrate auth token acquisition in ContentUnderstandingClient
- [x] T057 [US3] Create analyzer list command handler in src/commands/analyzer.ts
- [x] T058 [US3] Create analyzer show command handler in src/commands/analyzer.ts
- [x] T059 [US3] Register analyzer commands in src/index.ts
- [x] T060 [US3] Unit test for ContentUnderstandingClient (analyzers) in tests/unit/services/content-understanding.test.ts
- [x] T061 [US3] Contract test for cu analyzer list/show in tests/contract/analyzer.test.ts

**Checkpoint**: ✅ User Story 3 complete - Users can discover what analyzers are available. Ready for document analysis. (verified 2026-01-23)

---

## Phase 6: User Story 4 - Analyze a Document (Priority: P2)

**Goal**: Submit documents for analysis and receive structured extraction results

**Independent Test**: Run `cu analyze ./sample.pdf --analyzer prebuilt-document` to extract fields

### Implementation for User Story 4

- [X] T062 [P] [US4] Create AnalysisResult interface in src/models/analysis-result.ts
- [X] T063 [P] [US4] Create ExtractedField interface in src/models/analysis-result.ts
- [X] T064 [P] [US4] Create AnalysisOperation interface in src/models/analysis-result.ts
- [X] T065 [P] [US4] Create BoundingBox interface in src/models/analysis-result.ts
- [X] T066 [US4] Implement submitAnalysis (POST :analyze) in src/services/content-understanding.ts
- [X] T067 [US4] Implement submitBinaryAnalysis (POST :analyzeBinary) in src/services/content-understanding.ts
- [X] T068 [US4] Implement pollForResult (GET analyzerResults) in src/services/content-understanding.ts
- [X] T069 [US4] Implement file upload with MIME type detection in src/services/content-understanding.ts
- [X] T070 [US4] Create analyze command handler in src/commands/analyze.ts
- [X] T071 [US4] Implement local file path handling in src/commands/analyze.ts
- [X] T072 [US4] Implement URL source handling in src/commands/analyze.ts
- [X] T073 [US4] Integrate progress feedback during polling in src/commands/analyze.ts
- [X] T074 [US4] Register analyze command in src/index.ts
- [X] T075 [US4] Unit test for submitAnalysis/pollForResult in tests/unit/services/content-understanding.test.ts
- [X] T076 [US4] Contract test for cu analyze in tests/contract/analyze.test.ts
- [X] T077 [US4] Integration test for analyze workflow in tests/integration/analyze-workflow.test.ts

**Checkpoint**: User Story 4 complete - Core analysis workflow works. Users can extract data from documents.

---

## Phase 7: User Story 5 - Render Human-Friendly Output (Priority: P3)

**Goal**: Provide image overlay output format for analysis results with bounding box visualization

**Independent Test**: Run `cu analyze ./sample.pdf --format overlay --output result.png` to see visualization

### Implementation for User Story 5

- [X] T078 [P] [US5] Create overlay formatter in src/services/formatters/overlay.ts (lazy load sharp)
- [X] T079 [US5] Implement bounding box drawing in src/services/formatters/overlay.ts
- [X] T080 [US5] Implement output file writing with --output flag in src/commands/analyze.ts
- [X] T081 [US5] Implement file overwrite confirmation (--force) in src/commands/analyze.ts
- [X] T082 [US5] Add --format option (json/table/overlay) to analyze command
- [X] T083 [US5] Unit test for overlay formatter in tests/unit/services/formatters/overlay.test.ts
- [X] T084 [US5] Contract test for cu analyze --format options in tests/contract/analyze-formats.test.ts

**Checkpoint**: User Story 5 complete - Overlay output format works. Users can generate visualizations.

---

## Phase 8: User Story 6 - Manage BYOC Model Deployments (Priority: P3)

**Goal**: Deploy, list, and manage custom models on Azure AI resources

**Independent Test**: Run `cu deployment list` to see deployed models, `cu deployment set` to add a new model

### Implementation for User Story 6

- [ ] T085 [P] [US6] Create Deployment interface in src/models/deployment.ts
- [ ] T086 [P] [US6] Create DeploymentStatus type in src/models/deployment.ts
- [ ] T087 [P] [US6] Create DeploymentList interface in src/models/deployment.ts
- [ ] T088 [US6] Create DeploymentManager service in src/services/deployment-manager.ts
- [ ] T089 [US6] Implement listDeployments in src/services/deployment-manager.ts
- [ ] T090 [US6] Implement getDeployment in src/services/deployment-manager.ts
- [ ] T091 [US6] Implement setDeployment (create/update) in src/services/deployment-manager.ts
- [ ] T092 [US6] Implement removeDeployment in src/services/deployment-manager.ts
- [ ] T093 [US6] Implement deployment polling with progress in src/services/deployment-manager.ts
- [ ] T094 [US6] Create deployment list command handler in src/commands/deployment.ts
- [ ] T095 [US6] Create deployment set command handler in src/commands/deployment.ts
- [ ] T096 [US6] Create deployment remove command handler in src/commands/deployment.ts
- [ ] T097 [US6] Implement remove confirmation prompt in src/commands/deployment.ts
- [ ] T098 [US6] Register deployment commands in src/index.ts
- [ ] T099 [US6] Unit test for DeploymentManager in tests/unit/services/deployment-manager.test.ts
- [ ] T100 [US6] Contract test for cu deployment list/set/remove in tests/contract/deployment.test.ts

**Checkpoint**: User Story 6 complete - Full BYOC model lifecycle management available.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T101 [P] Create README.md with installation and usage instructions
- [ ] T102 [P] Create CHANGELOG.md following Keep a Changelog format
- [ ] T103 Add global --profile option to all commands in src/index.ts
- [ ] T104 Add global --verbose option for debug output in src/index.ts
- [ ] T105 Implement SIGINT (Ctrl+C) graceful shutdown in src/index.ts
- [ ] T106 Add startup time benchmark test in tests/integration/performance.test.ts
- [ ] T107 Verify all commands work with --json flag in tests/contract/json-output.test.ts
- [ ] T108 [P] Add npm prepublishOnly script for production build
- [ ] T109 Run quickstart.md validation (build, lint, test, benchmark)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ─────────────────────────────────────────────┐
                                                              ▼
Phase 2 (Foundational) ──────────────────────────────────────┤
                                                              │
                    ┌─────────────────────────────────────────┤
                    ▼                                         │
Phase 3 (US1: Auth) ─────────┬────────────────────────────────┤
                             │                                │
Phase 4 (US2: Config) ───────┤ ◄── Both P1, can run parallel │
                             │                                │
                    ┌────────┴────────┐                       │
                    ▼                 ▼                       │
Phase 5 (US3: Analyzers)  Phase 6 (US4: Analyze) ◄── P2 parallel
                    │                 │                       │
                    └────────┬────────┘                       │
                             ▼                                │
Phase 7 (US5: Formats) ──────┤ ◄── Depends on US4            │
                             │                                │
Phase 8 (US6: Models) ───────┤ ◄── P3, can start after US1+US2
                             │                                │
Phase 9 (Polish) ────────────┴────────────────────────────────┘
```

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1 (Auth) | Phase 2 | Foundational complete |
| US2 (Config) | Phase 2 | Foundational complete |
| US3 (Analyzers) | US1 + US2 | Auth and Config working |
| US4 (Analyze) | US3 | Analyzer discovery working |
| US5 (Formats) | US4 | Basic analysis working |
| US6 (Models) | US1 + US2 | Auth and Config working |

### Parallel Opportunities Per Phase

**Phase 1 (Setup)**: T003, T004, T005, T006, T008 can run in parallel  
**Phase 2 (Foundational)**: T011, T012, T013, T016, T017, T019 can run in parallel  
**Phase 3 (US1)**: T021, T022 can run in parallel (models)  
**Phase 4 (US2)**: T035, T036 can run in parallel (models)  
**Phase 5 (US3)**: T050, T051, T052 can run in parallel (models)  
**Phase 6 (US4)**: T062, T063, T064, T065 can run in parallel (models)  
**Phase 7 (US5)**: T078 can run in parallel with other US5 models  
**Phase 8 (US6)**: T089, T090, T091 can run in parallel (models)  
**Phase 9 (Polish)**: T106, T107, T113 can run in parallel  

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Auth)
4. Complete Phase 4: User Story 2 (Config)
5. **STOP and VALIDATE**: Test authentication and configuration independently
6. Deploy MVP - users can now sign in and configure endpoints

### Core Functionality (Add User Stories 3 + 4)

7. Complete Phase 5: User Story 3 (Analyzers)
8. Complete Phase 6: User Story 4 (Analyze)
9. **VALIDATE**: Full analysis workflow works
10. Deploy - users can now analyze documents

### Enhanced Output (Add User Story 5)

11. Complete Phase 7: User Story 5 (Formats)
12. **VALIDATE**: All output formats work
13. Deploy - users can generate reports

### Advanced Features (Add User Story 6)

14. Complete Phase 8: User Story 6 (Deployments)
15. Complete Phase 9: Polish
16. **VALIDATE**: Full feature set working
17. Final release

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 109 |
| Setup Phase | 9 tasks |
| Foundational Phase | 11 tasks |
| User Story 1 (Auth) | 14 tasks |
| User Story 2 (Config) | 15 tasks |
| User Story 3 (Analyzers) | 12 tasks |
| User Story 4 (Analyze) | 16 tasks |
| User Story 5 (Formats) | 7 tasks |
| User Story 6 (Deployments) | 16 tasks |
| Polish Phase | 9 tasks |
| Parallel Opportunities | 34 tasks marked [P] |

---

## Notes

- All tasks include exact file paths for implementation
- Tests are integrated into each user story phase (Constitution compliance)
- Each checkpoint is a deployable increment
- MVP achievable with Phases 1-4 only (34 tasks)
- Full feature set requires all phases (109 tasks)
