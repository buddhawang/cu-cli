# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-01-28

### Added

- **Structured Field Overlay Rendering**
  - Nested object fields render with full dot notation paths (e.g., `recipient.address.city`)
  - Array elements render with bracket notation (e.g., `items[0].amount`, `items[1].quantity`)
  - Multi-content classification results prefixed with content index (e.g., `contents[0].vendorName`)
  - Path pattern filtering with glob-like syntax (`pathFilter` option)
    - Exact matching: `vendorName`
    - Array wildcards: `items[*].amount` matches all array elements
    - Prefix/suffix wildcards: `recipient.*`, `*.amount`
  - `truncateLabel()` for long path display

- **New Functions**
  - `extractFieldsRecursively()` - Generator function for recursive field traversal
  - `matchPathPattern()` - Glob-like pattern matching for path filtering

### Changed

- `extractBoundingBoxes()` now accepts optional `pathFilter` parameter
- Field type colors use leaf field type (not parent container type)
- Single-content results remain backward compatible (no prefix added)

## [0.2.0] - 2026-01-28

### Added

- **API Key Authentication**
  - `cu config set --api-key <key>` - Configure API key for authentication
  - `cu config unset api-key` - Remove API key from profile
  - API key takes priority over Azure AD when both are configured
  - Masked API key display in `cu config show`

- **Status Command**
  - `cu status` - Display authentication and configuration status
  - Shows authentication method (API Key, Azure AD, or none)
  - Shows token expiry and refresh status
  - Supports `--json` for machine-readable output

- **PDF Overlay Rendering**
  - PDF files now supported for `--format overlay` output
  - `--dpi <number>` option for PDF rendering resolution (default: 150)
  - `--page <number>` option to render specific PDF page
  - Multi-page PDFs generate numbered output files (e.g., `result-1.png`, `result-2.png`)
  - Automatic coordinate conversion from inches to pixels

### Changed

- **JSON Output Format** (BREAKING)
  - `cu analyze --format json` now returns raw API response from the service
  - Previously returned a transformed/simplified format
  - This provides access to all API fields including `boundingRegions`

### Fixed

- Error messages for 401 responses now indicate whether API key or Azure AD was used
- Improved error handling for password-protected and corrupted PDFs

### Dependencies

- Added `pdf-to-png-converter` as optional dependency for PDF overlay rendering

## [0.1.0] - 2026-01-27

### Added

- **Authentication Commands**
  - `cu login` - Interactive Azure AD authentication with browser-based sign-in
  - `cu logout` - Sign out and clear cached credentials
  - `cu whoami` - Display current authenticated identity

- **Configuration Commands**
  - `cu config set --endpoint <url>` - Set Azure CU resource endpoint
  - `cu config show` - Display current configuration
  - `cu config list` - List all configuration profiles
  - `cu config use <profile>` - Switch active profile
  - Multi-profile support for managing multiple environments

- **Analyzer Commands**
  - `cu analyzer list` - List available analyzers in the configured resource
  - `cu analyzer show <id>` - Display detailed analyzer information including field schemas

- **Document Analysis Commands**
  - `cu analyze <file>` - Analyze local documents (PDF, images)
  - `cu analyze <url>` - Analyze documents from URLs
  - `--analyzer <id>` option to select specific analyzer
  - `--pages <range>` option for page selection
  - `--format json|table|overlay` output format options
  - `--output <file>` to write results to file
  - `--force` to overwrite existing output files

- **Model Defaults Commands**
  - `cu defaults list` - List model-to-deployment mappings
  - `cu defaults set --model <name> --deployment <name>` - Set a mapping
  - `cu defaults remove <model>` - Remove a mapping

- **Output Formats**
  - JSON output (`--json`) for all commands
  - Table output (default) for human-readable display
  - Overlay format for document analysis with bounding box visualization

- **Global Options**
  - `--json` flag for machine-readable output
  - `--profile <name>` to use specific configuration profile
  - `--verbose` for detailed debug output
  - `-v, --version` to display CLI version
  - `-h, --help` for command help

- **Developer Features**
  - Fast startup time (<200ms target)
  - Lazy loading of heavy dependencies (sharp for image processing)
  - Comprehensive test suite (unit, contract, integration tests)
  - TypeScript with strict mode
  - ESLint and Prettier configuration

### Security

- Secure credential caching using OS keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service)
- Azure AD OAuth 2.0 authentication flow
- Token refresh handled automatically

[Unreleased]: https://github.com/your-org/cu-cli/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/cu-cli/releases/tag/v0.1.0
