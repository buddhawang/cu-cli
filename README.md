# cu-cli - Azure Content Understanding CLI

A command-line interface for Azure Content Understanding, enabling document analysis, analyzer discovery, and BYOC (Bring Your Own Container) model management.

## Features

- 🔐 **Azure AD Authentication** - Secure sign-in with token caching
- ⚙️ **Multi-profile Configuration** - Manage multiple Azure CU endpoints
- 🔍 **Analyzer Discovery** - List and inspect available analyzers
- 📄 **Document Analysis** - Extract structured data from documents (coming soon)
- 📦 **Model Management** - Deploy and manage custom models (coming soon)

## Prerequisites

- **Node.js 18 LTS** or later
- **npm 9+**
- **Azure subscription** with a Content Understanding resource

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/buddhawang/cu-cli.git
cd cu-cli

# Install dependencies
npm install

# Build the CLI
npm run build

# Link globally for development
npm link
```

## Quick Start

### 1. Sign in to Azure

```bash
cu login
```

This opens a browser for Azure AD authentication. Your credentials are cached securely for subsequent use.

### 2. Configure your Azure CU endpoint

```bash
cu config set --endpoint https://your-resource.cognitiveservices.azure.com
```

### 3. Verify your identity

```bash
cu whoami
```

### 4. List available analyzers

```bash
cu analyzer list
```

### 5. View analyzer details

```bash
cu analyzer show <analyzer-id>
```

## Commands

### Authentication

| Command | Description |
|---------|-------------|
| `cu login` | Sign in to Azure using browser-based authentication |
| `cu logout` | Sign out and clear cached credentials |
| `cu whoami` | Display current authenticated identity |

### Configuration

| Command | Description |
|---------|-------------|
| `cu config set --endpoint <url>` | Set the Azure CU endpoint URL |
| `cu config show` | Display current configuration |
| `cu config list` | List all configuration profiles |
| `cu config use <profile>` | Switch to a different profile |

### Analyzers

| Command | Description |
|---------|-------------|
| `cu analyzer list` | List all available analyzers |
| `cu analyzer show <id>` | Display details of a specific analyzer |

### Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format (for scripting) |
| `--profile <name>` | Use a specific configuration profile |
| `--verbose` | Enable verbose output |
| `-v, --version` | Display CLI version |
| `-h, --help` | Display help information |

## Configuration Profiles

The CLI supports multiple configuration profiles for managing different Azure CU resources:

```bash
# Create a profile for development
cu config set --endpoint https://dev-resource.cognitiveservices.azure.com --profile dev

# Create a profile for production
cu config set --endpoint https://prod-resource.cognitiveservices.azure.com --profile prod

# Switch between profiles
cu config use dev
cu config use prod

# Use a profile for a single command
cu analyzer list --profile prod
```

Configuration is stored in `~/.cu/config.json`.

## JSON Output

All commands support JSON output for scripting and automation:

```bash
# Get analyzers as JSON
cu analyzer list --json

# Parse with jq
cu analyzer list --json | jq '.analyzers[].id'
```

## Development

### Build

```bash
# Development build (with source maps)
npm run build

# Production build (minified)
npm run build:prod
```

### Test

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Lint & Format

```bash
# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run typecheck
```

## Project Structure

```
cu-cli/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/             # Command handlers
│   │   ├── login.ts          # Authentication commands
│   │   ├── config.ts         # Configuration commands
│   │   └── analyzer.ts       # Analyzer commands
│   ├── services/             # Business logic
│   │   ├── auth.ts           # MSAL authentication
│   │   ├── config.ts         # Configuration management
│   │   ├── content-understanding.ts  # Azure CU API client
│   │   └── formatters/       # Output formatters
│   ├── models/               # TypeScript interfaces
│   └── lib/                  # Utilities
├── tests/
│   ├── unit/                 # Unit tests
│   ├── contract/             # Contract tests
│   └── integration/          # Integration tests
├── dist/                     # Build output
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Requirements

- Node.js >= 18.0.0
- Azure Content Understanding resource
- Azure AD application registration (public client)

## License

MIT
