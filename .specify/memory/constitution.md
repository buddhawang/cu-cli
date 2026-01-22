<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version change: N/A → 1.0.0 (Initial ratification)

Added principles:
  - I. Code Quality
  - II. Testing Standards
  - III. User Experience Consistency
  - IV. Performance Requirements

Added sections:
  - Quality Gates
  - Development Workflow
  - Governance

Templates status:
  - .specify/templates/plan-template.md: ✅ Compatible (Constitution Check section exists)
  - .specify/templates/spec-template.md: ✅ Compatible (Success Criteria aligns with performance principle)
  - .specify/templates/tasks-template.md: ✅ Compatible (Test phases support testing standards)

Follow-up TODOs: None
================================================================================
-->

# cu-cli Constitution

## Core Principles

### I. Code Quality

All code contributions MUST adhere to the following non-negotiable standards:

- **Readability First**: Code MUST be self-documenting with clear naming conventions; comments explain "why," not "what"
- **Single Responsibility**: Each module, function, and class MUST have one clear purpose; if you cannot describe it in one sentence, split it
- **Consistent Style**: All code MUST pass linting and formatting checks before merge; no exceptions for "quick fixes"
- **No Dead Code**: Unused imports, commented-out code blocks, and unreachable paths MUST be removed; version control preserves history
- **Error Handling**: All error paths MUST be explicitly handled; no silent failures; errors MUST propagate with actionable context
- **Type Safety**: Static typing MUST be used where the language supports it; `any` or equivalent escape hatches require justification

**Rationale**: Consistent, high-quality code reduces cognitive load, accelerates onboarding, and prevents technical debt accumulation.

### II. Testing Standards

Testing is mandatory and follows a structured approach:

- **Test Coverage Gate**: New code MUST include tests; PRs without tests for new functionality will be rejected
- **Test Pyramid**: Unit tests form the base (fast, isolated); integration tests validate component interactions; end-to-end tests cover critical user paths
- **Red-Green-Refactor**: When TDD is applied, tests MUST fail before implementation, pass after, then code is refactored
- **Deterministic Tests**: All tests MUST be deterministic; flaky tests MUST be fixed or quarantined within 48 hours
- **Test Naming**: Test names MUST describe the scenario: `should_[expected_behavior]_when_[condition]`
- **Contract Tests**: API boundaries (CLI commands, library interfaces) MUST have contract tests that verify input/output schemas

**Rationale**: Comprehensive testing enables confident refactoring, catches regressions early, and serves as living documentation.

### III. User Experience Consistency

The CLI user experience MUST be predictable and intuitive:

- **Consistent Command Structure**: All commands MUST follow the pattern `cu <verb> <noun> [options]`; deviations require constitutional amendment
- **Predictable Output**: stdout is for program output; stderr is for errors and diagnostics; exit code 0 for success, non-zero for failure
- **Format Options**: All commands producing structured output MUST support `--json` flag for machine-readable output and human-readable default
- **Helpful Errors**: Error messages MUST include: what went wrong, why it went wrong, and how to fix it
- **Progressive Disclosure**: Simple use cases MUST work with minimal flags; advanced options available but not required
- **Documentation Parity**: Every command MUST have `--help` output that matches external documentation; discrepancies are bugs

**Rationale**: Users build mental models of tools; consistency reduces friction and errors, increasing adoption and satisfaction.

### IV. Performance Requirements

Performance is a feature, not an afterthought:

- **Startup Time**: CLI commands MUST initialize in <200ms for interactive use; cold start optimization is mandatory
- **Memory Efficiency**: Operations on large inputs MUST use streaming where possible; memory usage MUST scale sub-linearly with input size
- **Responsiveness**: Long-running operations MUST provide progress feedback within 2 seconds of starting
- **No Regressions**: Performance benchmarks MUST be maintained; regressions >10% require justification and approval
- **Lazy Loading**: Optional features and dependencies MUST be lazily loaded to minimize baseline resource consumption
- **Measurable Goals**: Each feature spec MUST define performance targets; "fast enough" is not a valid criterion

**Rationale**: CLI tools are used in automation pipelines and interactive sessions; poor performance compounds across usage contexts.

## Quality Gates

All code changes MUST pass through these gates before merge:

| Gate | Requirement | Enforcement |
|------|-------------|-------------|
| Lint | Zero warnings or errors | CI/CD blocking |
| Type Check | Full type coverage, no errors | CI/CD blocking |
| Unit Tests | 100% pass rate, coverage ≥80% for new code | CI/CD blocking |
| Integration Tests | All contract tests pass | CI/CD blocking |
| Performance | No regressions >10% | CI/CD blocking |
| Documentation | Help text and README updated | Code review |

## Development Workflow

Standard workflow for all feature development:

1. **Specification**: Create feature spec using `/speckit.spec` before implementation
2. **Planning**: Generate implementation plan using `/speckit.plan` with Constitution Check verification
3. **Task Breakdown**: Generate tasks using `/speckit.tasks` organized by user story
4. **Implementation**: Follow task phases; mark progress; commit atomic changes
5. **Review**: All changes require PR review; reviewer verifies Constitution compliance
6. **Merge**: Squash merge with conventional commit message; delete feature branch

**Branch Naming**: `<issue-number>-<brief-description>` (e.g., `042-add-export-command`)

**Commit Messages**: Follow Conventional Commits: `type(scope): description` (e.g., `feat(export): add JSON output format`)

## Governance

This Constitution is the supreme governing document for cu-cli development:

- **Precedence**: Constitution supersedes all other practices, patterns, or preferences; conflicts are resolved in favor of the Constitution
- **Compliance Verification**: All PRs MUST include a Constitution compliance check in the review checklist
- **Amendment Process**: Changes require: (1) written proposal, (2) impact analysis on existing code, (3) migration plan if breaking, (4) approval from maintainers
- **Versioning**: Constitution follows semantic versioning—MAJOR for principle changes, MINOR for new sections, PATCH for clarifications
- **Complexity Justification**: Any deviation from simplicity (additional dependencies, architectural patterns, abstractions) MUST be justified in writing

**Version**: 1.0.0 | **Ratified**: 2026-01-22 | **Last Amended**: 2026-01-22
