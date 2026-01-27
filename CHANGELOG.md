# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
