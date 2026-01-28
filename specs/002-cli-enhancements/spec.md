# Feature Specification: CLI Enhancements

**Feature Branch**: `002-cli-enhancements`  
**Created**: January 27, 2026  
**Status**: Draft  
**Input**: User description: "adding following new features and improvements to the CLI tool - Support PDF -> image output, can use pdf.js to read file and render to canvas - Auth expired soon, cache the login state and only refresh access token - Use the latest schema from service side (we are still using boundingRegions), output the original result from service for JSON output - Add setting API-key in configs, and use API key if it is presented"

---

## Overview

This specification covers four enhancements to the Azure Content Understanding CLI:

1. **PDF to Image Rendering** - Enable overlay output for PDF files by converting pages to images
2. **Authentication Token Optimization** - Cache login state and refresh only the access token when near expiry
3. **Service Schema Alignment** - Update to latest API schema and return raw service responses for JSON output
4. **API Key Authentication** - Support API key configuration as an alternative to Azure AD authentication

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - API Key Authentication (Priority: P1)

As a user who doesn't have Azure AD credentials or prefers simpler authentication, I want to configure an API key in my profile so that I can use the CLI without going through interactive login.

**Why this priority**: API key authentication provides the fastest path to using the CLI and is essential for automation scenarios (CI/CD, scripts, headless environments) where interactive login is not possible.

**Independent Test**: Can be fully tested by configuring an API key via `cu config set` and running `cu analyze` successfully without any prior `cu login`.

**Acceptance Scenarios**:

1. **Given** a user with an API key from Azure portal, **When** they run `cu config set --api-key <key>`, **Then** the API key is securely stored in the profile configuration.
2. **Given** a profile with an API key configured, **When** the user runs any API command (e.g., `cu analyze`), **Then** the CLI uses the API key for authentication instead of Azure AD tokens.
3. **Given** a profile with both API key and Azure AD credentials, **When** the user runs an API command, **Then** the CLI prioritizes the API key over Azure AD authentication.
4. **Given** an invalid or expired API key, **When** the user runs an API command, **Then** the CLI displays a clear error message indicating the API key is invalid.

---

### User Story 2 - Authentication Token Refresh Optimization (Priority: P2)

As a frequent CLI user, I want my authentication to remain valid longer without re-login so that I don't have to repeatedly authenticate during my work session.

**Why this priority**: Reduces friction for daily users and improves the developer experience by minimizing authentication interruptions.

**Independent Test**: Can be fully tested by logging in once, waiting for the token to approach expiry, and verifying the CLI automatically refreshes without requiring interactive login.

**Acceptance Scenarios**:

1. **Given** a user with valid cached credentials and an access token nearing expiry, **When** the CLI needs to make an API call, **Then** it silently refreshes the access token using cached refresh tokens without user interaction.
2. **Given** a user with valid cached credentials, **When** the user runs `cu status`, **Then** they see their authentication status including when their session expires.
3. **Given** cached credentials where the refresh token has expired, **When** the CLI attempts to refresh, **Then** it prompts the user to run `cu login` again with a clear message.
4. **Given** a user who runs `cu logout`, **When** logout completes, **Then** all cached tokens (access and refresh) are cleared.

---

### User Story 3 - Raw JSON Service Response (Priority: P2)

As a developer integrating with the Content Understanding API, I want the JSON output format to return the exact response from the service so that I can work with the latest schema and all available fields.

**Why this priority**: Developers need access to the full API response for debugging, integration, and to leverage new service features as they become available.

**Independent Test**: Can be fully tested by running `cu analyze --format json` and comparing the output structure against the API documentation.

**Acceptance Scenarios**:

1. **Given** a user running analysis with `--format json`, **When** the analysis completes, **Then** the output contains the unmodified response from the Content Understanding API.
2. **Given** the service adds new fields to the response schema, **When** a user runs analysis with `--format json`, **Then** the new fields appear in the output without requiring CLI updates.
3. **Given** an analysis with multiple content types (documents, tables, figures), **When** using `--format json`, **Then** all content types are represented exactly as returned by the service.

---

### User Story 4 - PDF Overlay Rendering (Priority: P3)

As a user analyzing PDF documents, I want to visualize extracted fields overlaid on my PDF pages so that I can verify extraction accuracy and understand where information was found.

**Why this priority**: Extends the popular overlay feature to PDF documents, which are the most common document format for business use cases.

**Independent Test**: Can be fully tested by running `cu analyze invoice.pdf --format overlay --output result.png` and verifying the output shows the PDF page with field annotations.

**Acceptance Scenarios**:

1. **Given** a single-page PDF file, **When** the user runs `cu analyze <file.pdf> --format overlay`, **Then** the CLI renders the PDF page as an image with extraction results overlaid.
2. **Given** a multi-page PDF file, **When** the user runs `cu analyze <file.pdf> --format overlay`, **Then** the CLI renders each page as a separate image with overlays, or combines them based on user preference.
3. **Given** a PDF file and the overlay format, **When** the user specifies an output path, **Then** the rendered image(s) are saved to the specified location.
4. **Given** a corrupted or password-protected PDF, **When** the user attempts overlay rendering, **Then** the CLI displays a helpful error message explaining the issue.

---

### Edge Cases

- What happens when API key is configured but endpoint requires Azure AD? → Display clear error with guidance to use `cu login` or check endpoint configuration
- What happens when PDF has unusual dimensions or DPI? → Use reasonable defaults (150 DPI) and scale output appropriately
- What happens when JSON output is piped to another command? → Ensure valid JSON is written to stdout without additional formatting or progress indicators
- What happens when token refresh fails due to network issues? → Retry with exponential backoff, then prompt for re-login with helpful error message
- What happens when PDF has no extractable content (scanned without OCR)? → Display overlay with empty field annotations, same behavior as image files
- What happens when multi-page PDF is analyzed but only some pages have content? → Render all pages, with empty overlays on pages without extracted fields

---

## Requirements *(mandatory)*

### Functional Requirements

#### API Key Authentication

- **FR-001**: CLI MUST allow users to set an API key via `cu config set --api-key <key>` for the current profile
- **FR-002**: CLI MUST store API keys in the configuration file alongside other profile settings
- **FR-003**: CLI MUST use API key authentication when an API key is present in the active profile
- **FR-004**: CLI MUST send the API key in the `Ocp-Apim-Subscription-Key` header for API requests when using API key auth
- **FR-005**: CLI MUST allow users to remove an API key via `cu config set --api-key ""` or `cu config unset api-key`
- **FR-006**: CLI MUST display whether API key is configured (without revealing the value) when running `cu config show`

#### Authentication Token Optimization

- **FR-007**: CLI MUST cache refresh tokens alongside access tokens in the credential store
- **FR-008**: CLI MUST automatically refresh access tokens when they are within 5 minutes of expiry
- **FR-009**: CLI MUST use silent token acquisition from cache when valid tokens exist
- **FR-010**: CLI MUST prompt for interactive login only when refresh tokens are expired or invalid
- **FR-011**: CLI MUST provide a `cu status` command showing authentication state and token expiry time

#### Raw JSON Service Response

- **FR-012**: CLI MUST return the unmodified API response when using `--format json`
- **FR-013**: CLI MUST NOT transform, filter, or restructure the JSON response from the service
- **FR-014**: CLI MUST maintain backward compatibility for other output formats (table, overlay) which may continue to use processed data

#### PDF Overlay Rendering

- **FR-015**: CLI MUST support `--format overlay` for PDF files in addition to image files
- **FR-016**: CLI MUST convert PDF pages to images at sufficient resolution for overlay rendering (default 150 DPI)
- **FR-017**: CLI MUST render extraction results on PDF-derived images using the same overlay logic as image files
- **FR-018**: CLI MUST support multi-page PDFs and output separate images per page (e.g., `output-1.png`, `output-2.png`)
- **FR-019**: CLI MUST provide clear error messages for unsupported or corrupted PDFs

---

### Key Entities

- **ConfigProfile** (extended): Profile configuration now includes optional `apiKey` field alongside `endpoint`
- **AuthState** (extended): Authentication state includes token expiry information and refresh token presence indicator
- **AnalysisResult**: Raw API response structure that may evolve with service updates; CLI passes through without transformation for JSON output

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete API key setup and first successful API call in under 2 minutes
- **SC-002**: Users experience zero authentication interruptions during a typical 8-hour work session after initial login
- **SC-003**: JSON output matches the Content Understanding API response schema 100% (no field additions, removals, or transformations)
- **SC-004**: PDF overlay rendering completes within 10 seconds for a typical 5-page document
- **SC-005**: All four features work correctly across Windows, macOS, and Linux environments
- **SC-006**: Users can successfully analyze PDF files with overlay output on first attempt without consulting documentation

---

## Assumptions

- The Azure Content Understanding API supports both Azure AD bearer token and API key (`Ocp-Apim-Subscription-Key`) authentication methods
- MSAL's token cache already handles refresh token persistence; optimization focuses on leveraging existing MSAL capabilities more effectively
- PDF rendering will use a JavaScript-based PDF library compatible with Node.js runtime
- The standard output resolution for PDF-to-image conversion (150 DPI) provides sufficient quality for overlay visualization
- Multi-page PDF output defaults to separate images per page (e.g., `output-1.png`, `output-2.png`) unless otherwise specified

---

## Out of Scope

- PDF form field recognition or editing
- PDF password removal or decryption
- Custom overlay styling or theming beyond existing capabilities
- API key rotation or expiry management
- Multi-factor authentication handling
- Offline mode or local caching of analysis results
