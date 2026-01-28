# Tasks: Structured Field Overlay Rendering

**Input**: Design documents from `/specs/003-structured-field-overlay/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Unit tests included for core functions per Constitution II (Testing Standards).

**Organization**: Tasks grouped by user story. User Stories 1 & 2 are both P1 and can be developed together since they affect the same function.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Exact file paths included

## Path Conventions

- **Source**: `src/` at repository root
- **Tests**: `tests/` at repository root
- Primary file: `src/services/formatters/overlay.ts`

---

## Phase 1: Setup

**Purpose**: Prepare for feature implementation (minimal setup since extending existing code)

- [X] T001 Update version to 0.3.0 in package.json

---

## Phase 2: Foundational (Core Recursive Traversal)

**Purpose**: Implement the core generator function that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until `extractFieldsRecursively` is complete

- [X] T002 Implement `extractFieldsRecursively()` generator function in src/services/formatters/overlay.ts
- [X] T003 Implement `truncateLabel()` helper function in src/services/formatters/overlay.ts
- [X] T004 [P] Add unit tests for `extractFieldsRecursively()` in tests/unit/services/formatters/overlay.test.ts
- [X] T005 [P] Add unit tests for `truncateLabel()` in tests/unit/services/formatters/overlay.test.ts

**Checkpoint**: Foundation ready - core traversal and path generation working

---

## Phase 3: User Story 1 & 2 - Nested Objects & Arrays (Priority: P1) 🎯 MVP

**Goal**: Render bounding boxes for nested object fields (US1) and array element fields (US2) with full path labels

**Independent Test**: Analyze a document with nested objects and arrays, verify each field shows with its full path

### Implementation for User Stories 1 & 2

- [X] T006 [US1] [US2] Modify `extractBoundingBoxes()` to use `extractFieldsRecursively()` for field traversal in src/services/formatters/overlay.ts
- [X] T007 [US1] Add object nesting support with dot notation (e.g., `recipient.address.city`) in src/services/formatters/overlay.ts
- [X] T008 [US2] Add array indexing support with bracket notation (e.g., `items[0].amount`) in src/services/formatters/overlay.ts
- [X] T009 [US1] [US2] Handle fields without bounding regions (skip gracefully) in src/services/formatters/overlay.ts
- [X] T010 [P] [US1] Add contract test for nested object field overlay in tests/contract/analyze-formats.test.ts
- [X] T011 [P] [US2] Add contract test for array element field overlay in tests/contract/analyze-formats.test.ts

**Checkpoint**: User Stories 1 & 2 complete - nested objects and arrays render with full paths

---

## Phase 4: User Story 3 - Field Type Colors (Priority: P2)

**Goal**: Ensure each field's bounding box uses its type-specific color from the existing palette

**Independent Test**: Analyze a document with mixed field types, verify each type uses its designated color

### Implementation for User Story 3

- [X] T012 [US3] Verify type propagation through recursive traversal in src/services/formatters/overlay.ts
- [X] T013 [US3] Ensure leaf field type (not parent type) is used for color in src/services/formatters/overlay.ts
- [X] T014 [P] [US3] Add unit test for field type color mapping with nested fields in tests/unit/services/formatters/overlay.test.ts

**Checkpoint**: User Story 3 complete - colors reflect leaf field types

---

## Phase 5: User Story 5 - Multi-Content Classification (Priority: P2)

**Goal**: Support multiple content segments with indexed prefixes and page range filtering

**Independent Test**: Analyze a multi-document PDF with classifier, verify each content segment has indexed prefix

### Implementation for User Story 5

- [X] T015 [US5] Add multi-content detection and content index prefix logic in src/services/formatters/overlay.ts
- [X] T016 [US5] Implement page range filtering per content segment in src/services/formatters/overlay.ts
- [X] T017 [US5] Add backward compatibility (no prefix for single-content results) in src/services/formatters/overlay.ts
- [X] T018 [P] [US5] Add contract test for multi-content overlay in tests/contract/analyze-formats.test.ts
- [X] T019 [P] [US5] Add unit test for content index prefix logic in tests/unit/services/formatters/overlay.test.ts

**Checkpoint**: User Story 5 complete - multi-content classification renders with indexed prefixes

---

## Phase 6: User Story 4 - Path Filtering (Priority: P3) ⚡ Optional

**Goal**: Filter overlay to show only fields matching a path pattern

**Independent Test**: Provide path filter pattern, verify only matching fields are rendered

### Implementation for User Story 4

- [X] T020 [US4] Add `pathFilter` option to `OverlayOptions` interface in src/services/formatters/overlay.ts
- [X] T021 [US4] Implement glob-like path pattern matching in src/services/formatters/overlay.ts
- [X] T022 [US4] Apply filter in `extractBoundingBoxes()` before returning results in src/services/formatters/overlay.ts
- [X] T023 [P] [US4] Add unit tests for path pattern matching in tests/unit/services/formatters/overlay.test.ts

**Checkpoint**: User Story 4 complete - path filtering works with glob patterns

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and cleanup

- [X] T024 [P] Update CHANGELOG.md with v0.3.0 changes
- [X] T025 [P] Update README.md with structured field overlay documentation
- [X] T026 Run quickstart.md validation scenarios manually
- [X] T027 Run full test suite and verify all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **US1 & US2 (Phase 3)**: Depends on Foundational
- **US3 (Phase 4)**: Can start after Phase 2, no dependency on Phase 3
- **US5 (Phase 5)**: Can start after Phase 2, no dependency on Phases 3-4
- **US4 (Phase 6)**: Optional, can start after Phase 2, no dependency on Phases 3-5
- **Polish (Phase 7)**: Depends on all desired phases being complete

### User Story Dependencies

| User Story | Phase | Dependencies | Can Parallelize With |
|-----------|-------|--------------|---------------------|
| US1 + US2 (P1) | 3 | Foundational | US3, US5, US4 |
| US3 (P2) | 4 | Foundational | US1/US2, US5, US4 |
| US5 (P2) | 5 | Foundational | US1/US2, US3, US4 |
| US4 (P3) | 6 | Foundational | US1/US2, US3, US5 |

### Within Each Phase

1. Implementation tasks before test tasks (when tests verify implementation)
2. Core functions before dependent functions
3. Unit tests can run in parallel with contract tests

---

## Parallel Opportunities

### Phase 2 (Foundational)
```
# Can run in parallel:
T004: Unit tests for extractFieldsRecursively
T005: Unit tests for truncateLabel
```

### Phase 3 (US1 & US2)
```
# Can run in parallel after T006-T009:
T010: Contract test for nested objects
T011: Contract test for arrays
```

### Cross-Phase Parallelism
```
# After Phase 2 completes, all user stories can start in parallel:
Phase 3 (US1+US2) | Phase 4 (US3) | Phase 5 (US5) | Phase 6 (US4)
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T005)
3. Complete Phase 3: User Stories 1 & 2 (T006-T011)
4. **STOP and VALIDATE**: Test with nested objects and arrays
5. Deploy if ready - core feature is usable

### Full Implementation

1. Complete Phases 1-3 → MVP with nested objects and arrays
2. Add Phase 4: US3 → Field type colors verified
3. Add Phase 5: US5 → Multi-content classification support
4. Add Phase 6: US4 (optional) → Path filtering for power users
5. Complete Phase 7: Polish → Documentation and validation

---

## Notes

- Primary file modified: `src/services/formatters/overlay.ts`
- No new files created except test file: `tests/unit/services/formatters/overlay.test.ts`
- Backward compatible: single-content results unchanged
- User Story 4 (Path Filtering) is P3 and can be deferred
- Total tasks: 27
- Parallelizable tasks: 11 (marked with [P])
