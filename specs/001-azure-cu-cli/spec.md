# Feature Specification: Azure Content Understanding CLI

**Feature Branch**: `001-azure-cu-cli`  
**Created**: 2026-01-22  
**Status**: Draft  
**Input**: User description: "Build a portable Node.js CLI that lets engineers call Azure Content Understanding (CU) from the terminal to discover analyzers, analyze documents, render human-friendly outputs (JSON/Markdown/Image overlay), and manage BYOC model deployments with Azure AD auth flow"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Authenticate with Azure (Priority: P1)

As an engineer, I want to sign in to Azure once and have subsequent CLI commands authenticate silently, so that I can use the CLI without repeatedly entering credentials or managing API keys.

**Why this priority**: Authentication is the foundational capability—no other feature works without it. This must be the first thing implemented and tested.

**Independent Test**: Can be fully tested by running `cu login`, completing browser-based sign-in, then running `cu whoami` to confirm identity. Delivers secure, keyless access to Azure services.

**Acceptance Scenarios**:

1. **Given** the user has never signed in, **When** they run `cu login`, **Then** a browser window opens for Azure AD authentication, and upon success, credentials are cached securely for future use
2. **Given** the user has previously signed in, **When** they run any command requiring authentication, **Then** the CLI obtains a token silently without user interaction
3. **Given** the cached token has expired, **When** the user runs a command, **Then** the CLI refreshes the token silently using the refresh token
4. **Given** the user wants to sign out, **When** they run `cu logout`, **Then** cached credentials are cleared and subsequent commands require re-authentication
5. **Given** the user runs `cu whoami`, **When** they are authenticated, **Then** the CLI displays their Azure identity (email, tenant, subscription)

---

### User Story 2 - Configure Azure Resource Connection (Priority: P1)

As an engineer, I want to configure which Azure Content Understanding resource the CLI connects to, so that I can work with different resources for development, staging, and production.

**Why this priority**: Resource configuration is essential for targeting the correct Azure endpoint—it's foundational alongside authentication.

**Independent Test**: Can be fully tested by running `cu config set` and verifying with `cu config show`. Delivers multi-environment support.

**Acceptance Scenarios**:

1. **Given** the user has an Azure CU resource, **When** they run `cu config set --endpoint <url>`, **Then** the CLI saves the endpoint for use in subsequent commands
2. **Given** multiple configurations are needed, **When** the user runs `cu config set --profile staging --endpoint <url>`, **Then** the CLI saves a named profile that can be activated later
3. **Given** profiles exist, **When** the user runs `cu config list`, **Then** the CLI displays all configured profiles with the active one highlighted
4. **Given** the user wants to switch environments, **When** they run `cu config use <profile-name>`, **Then** subsequent commands use that profile's settings
5. **Given** no configuration exists, **When** the user runs any command requiring an endpoint, **Then** the CLI displays a helpful error with instructions to run `cu config set`

---

### User Story 3 - Discover Available Analyzers (Priority: P2)

As an engineer, I want to list all analyzers available in my Azure Content Understanding resource, so that I can understand what analysis capabilities are available and select the right one for my documents.

**Why this priority**: Before analyzing documents, users need to know what analyzers exist. This is the discovery step that enables all analysis workflows.

**Independent Test**: Can be fully tested by running `cu analyzer list` after authentication. Delivers visibility into available CU capabilities.

**Acceptance Scenarios**:

1. **Given** the user is authenticated, **When** they run `cu analyzer list`, **Then** the CLI displays all available analyzers with their names, descriptions, and supported document types
2. **Given** the user wants machine-readable output, **When** they run `cu analyzer list --json`, **Then** the CLI outputs structured JSON to stdout
3. **Given** the user wants details about a specific analyzer, **When** they run `cu analyzer show <analyzer-name>`, **Then** the CLI displays detailed information including supported fields, document types, and configuration options
4. **Given** no analyzers are configured, **When** the user runs `cu analyzer list`, **Then** the CLI displays a helpful message indicating no analyzers are available and suggests next steps

---

### User Story 4 - Analyze a Document (Priority: P2)

As an engineer, I want to submit a document for analysis and receive structured results, so that I can extract information from documents programmatically.

**Why this priority**: This is the core value proposition of the CLI—actually analyzing documents. It's P2 because authentication must work first.

**Independent Test**: Can be fully tested by running `cu analyze <file> --analyzer <name>` with a sample document. Delivers extracted document data.

**Acceptance Scenarios**:

1. **Given** the user has a local document file, **When** they run `cu analyze ./invoice.pdf --analyzer prebuilt-invoice`, **Then** the CLI uploads the document, waits for analysis, and outputs the extracted fields
2. **Given** the user wants JSON output, **When** they run `cu analyze ./doc.pdf --analyzer <name> --json`, **Then** the CLI outputs the complete analysis result as structured JSON
3. **Given** the user provides a URL, **When** they run `cu analyze https://example.com/doc.pdf --analyzer <name>`, **Then** the CLI analyzes the document from the URL without downloading locally
4. **Given** the analysis takes time, **When** the user submits a document, **Then** the CLI shows progress feedback within 2 seconds and updates until completion
5. **Given** the document type is unsupported, **When** the user runs analyze, **Then** the CLI displays a clear error message explaining which formats are supported

---

### User Story 5 - Render Human-Friendly Output (Priority: P3)

As an engineer, I want to view analysis results in multiple formats (Markdown, image overlay), so that I can quickly understand results visually or share them with stakeholders.

**Why this priority**: Rendering is an enhancement over raw JSON output—it improves usability but isn't required for core functionality.

**Independent Test**: Can be fully tested by running `cu analyze <file> --format markdown` or `--format overlay`. Delivers human-readable results.

**Acceptance Scenarios**:

1. **Given** analysis results exist, **When** the user runs `cu analyze <file> --format markdown`, **Then** the CLI outputs a well-formatted Markdown document with extracted fields, tables, and key-value pairs
2. **Given** the document is an image or PDF, **When** the user runs `cu analyze <file> --format overlay --output result.png`, **Then** the CLI generates an image with bounding boxes overlaid on detected fields
3. **Given** the user wants to save results, **When** they run `cu analyze <file> --output results.md`, **Then** the CLI writes the formatted output to the specified file
4. **Given** the user doesn't specify a format, **When** they run `cu analyze <file>`, **Then** the CLI defaults to a concise human-readable table format on stdout

---

### User Story 6 - Manage BYOC Model Deployments (Priority: P3)

As an engineer, I want to deploy, list, and manage my own custom models on an Azure AI resource, so that I can use specialized analyzers tailored to my organization's documents.

**Why this priority**: BYOC is an advanced feature for users with custom models—it extends the CLI's capabilities but isn't needed for basic usage.

**Independent Test**: Can be fully tested by running `cu model list`, `cu model deploy`, and `cu model delete`. Delivers custom model lifecycle management.

**Acceptance Scenarios**:

1. **Given** the user has a trained model, **When** they run `cu model deploy --name my-model --source <model-location>`, **Then** the CLI initiates deployment and shows progress until the model is ready
2. **Given** models are deployed, **When** the user runs `cu model list`, **Then** the CLI displays all deployed models with their status, creation date, and endpoint information
3. **Given** a model exists, **When** the user runs `cu model show <model-name>`, **Then** the CLI displays detailed model information including health status and usage statistics
4. **Given** a model is no longer needed, **When** the user runs `cu model delete <model-name>`, **Then** the CLI prompts for confirmation and removes the deployment
5. **Given** a model deployment fails, **When** the user checks status, **Then** the CLI displays actionable error information explaining the failure reason

---

### Edge Cases

- What happens when the user's network connection is interrupted during document upload?
  - CLI MUST detect the failure, provide a clear error message, and suggest retrying
- What happens when the Azure CU service returns rate-limiting errors (429)?
  - CLI MUST implement exponential backoff and inform the user of retry attempts
- What happens when the user provides an invalid file path?
  - CLI MUST validate file existence before upload and display the resolved path in the error
- What happens when Azure AD token refresh fails (e.g., refresh token expired)?
  - CLI MUST prompt the user to re-authenticate with `cu login`
- What happens when the user cancels a long-running operation (Ctrl+C)?
  - CLI MUST handle SIGINT gracefully, clean up any pending requests, and exit with non-zero status
- What happens when the output file already exists?
  - CLI MUST prompt for confirmation before overwriting, unless `--force` flag is provided

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Configuration**
- **FR-001**: CLI MUST authenticate using Azure AD OAuth2 authorization code flow with PKCE for secure browser-based sign-in
- **FR-002**: CLI MUST cache authentication tokens securely using the operating system's credential store (Keychain on macOS, Credential Manager on Windows, libsecret on Linux)
- **FR-003**: CLI MUST refresh tokens silently when they expire, without user intervention
- **FR-004**: CLI MUST support multiple named configuration profiles for different Azure resources
- **FR-005**: CLI MUST validate endpoint URLs before saving to configuration

**Analyzer Discovery**
- **FR-006**: CLI MUST retrieve and display all analyzers available in the configured Content Understanding resource
- **FR-007**: CLI MUST display analyzer metadata including name, description, and supported document types
- **FR-008**: CLI MUST support both human-readable table format and JSON output for analyzer listings

**Document Analysis**
- **FR-009**: CLI MUST accept documents from local file paths or HTTP/HTTPS URLs
- **FR-010**: CLI MUST support common document formats (PDF, JPEG, PNG, TIFF, BMP, HEIF)
- **FR-011**: CLI MUST display progress feedback for operations taking longer than 2 seconds
- **FR-012**: CLI MUST output analysis results in JSON, Markdown, or human-readable table format
- **FR-013**: CLI MUST support generating image overlays showing detected field bounding boxes

**BYOC Model Management**
- **FR-014**: CLI MUST support deploying custom models to the Azure AI resource
- **FR-015**: CLI MUST support listing all deployed models with their status
- **FR-016**: CLI MUST support deleting deployed models with confirmation prompt
- **FR-017**: CLI MUST display deployment progress and estimated time remaining when available

**CLI Standards (per Constitution)**
- **FR-018**: CLI MUST follow the command pattern `cu <verb> <noun> [options]`
- **FR-019**: CLI MUST output program data to stdout and errors/diagnostics to stderr
- **FR-020**: CLI MUST return exit code 0 for success and non-zero for failures
- **FR-021**: CLI MUST provide `--help` for every command with accurate, up-to-date documentation
- **FR-022**: CLI MUST support `--json` flag on all commands that produce structured output
- **FR-023**: CLI MUST start and respond to basic commands (help, version) in under 200ms

### Key Entities

- **Analyzer**: Represents an analysis capability in Azure CU; has a name, description, supported document types, and extractable fields
- **Analysis Result**: The output from analyzing a document; contains extracted fields, confidence scores, and bounding box coordinates
- **Configuration Profile**: A named set of settings including endpoint URL and optional defaults; one profile is active at a time
- **Credential Cache**: Securely stored OAuth tokens (access token, refresh token, expiry); managed by the OS credential store
- **Custom Model**: A user-deployed model for specialized document analysis; has a name, status, deployment date, and endpoint
- **Document**: The input to analysis; can be a local file or remote URL; has a format (PDF, image, etc.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete first-time authentication in under 60 seconds (from running `cu login` to seeing `cu whoami` output)
- **SC-002**: Analyzer listing returns results within 3 seconds for resources with up to 50 analyzers
- **SC-003**: Document analysis provides progress feedback within 2 seconds of submission
- **SC-004**: CLI commands initialize in under 200ms (measured from invocation to first output for `--help` and `--version`)
- **SC-005**: 95% of users can successfully analyze their first document without consulting external documentation (using only `--help` output)
- **SC-006**: Configuration switching between profiles completes in under 1 second
- **SC-007**: Error messages enable users to self-resolve issues 80% of the time without support escalation
- **SC-008**: CLI operates consistently across Windows, macOS, and Linux without platform-specific workarounds

## Assumptions

The following reasonable defaults have been assumed based on standard practices:

1. **Target Node.js version**: Node.js 18 LTS or later (current LTS at time of development)
2. **Package distribution**: Published to npm for easy installation via `npm install -g @azure/cu-cli`
3. **Credential storage**: Using platform-native secure storage (no plaintext files)
4. **Default output format**: Human-readable tables for terminal, with `--json` for scripting
5. **Retry policy**: Exponential backoff with jitter, max 3 retries for transient failures
6. **Timeout defaults**: 30 seconds for API calls, 5 minutes for document analysis operations
