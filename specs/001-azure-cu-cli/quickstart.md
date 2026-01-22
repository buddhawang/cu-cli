# Quickstart: cu-cli Development

**Date**: 2026-01-22  
**Feature**: [spec.md](spec.md) | [plan.md](plan.md)

This guide helps developers get started with cu-cli development.

---

## Prerequisites

- **Node.js 18 LTS** or later
- **npm 9+** or **pnpm 8+**
- **Azure subscription** with a Content Understanding resource
- **Git** for version control

### Azure Setup

1. Create an Azure Content Understanding resource in the Azure Portal
2. Note the **Endpoint URL** (e.g., `https://my-resource.cognitiveservices.azure.com`)
3. Register an Azure AD application for the CLI (Public client/Native)
4. Configure redirect URI: `http://localhost`

---

## Project Setup

### 1. Clone and Install

```bash
git clone https://github.com/your-org/cu-cli.git
cd cu-cli
npm install
```

### 2. Build

```bash
# Development build (with source maps)
npm run build

# Production build (minified, bundled)
npm run build:prod
```

### 3. Run Locally

```bash
# Run from source
npx ts-node src/index.ts --help

# Run built version
node dist/cu.cjs --help

# Link globally for testing
npm link
cu --help
```

---

## Project Structure

```
cu-cli/
├── src/
│   ├── index.ts             # CLI entry point
│   ├── commands/            # Command handlers
│   │   ├── login.ts         # cu login/logout/whoami
│   │   ├── config.ts        # cu config set/list/use/show
│   │   ├── analyzer.ts      # cu analyzer list/show
│   │   ├── analyze.ts       # cu analyze <file>
│   │   └── model.ts         # cu model list/show/deploy/delete
│   ├── services/            # Business logic
│   │   ├── auth.ts          # MSAL authentication
│   │   ├── config.ts        # Configuration management
│   │   ├── content-understanding.ts  # Azure CU API client
│   │   └── formatters/      # Output formatters
│   ├── models/              # TypeScript types
│   └── lib/                 # Utilities
├── tests/
│   ├── unit/
│   ├── contract/
│   └── integration/
├── specs/                   # Feature specifications
├── dist/                    # Build output
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Development Workflow

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Contract tests only
npm run test:contract

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Linting & Formatting

```bash
# Lint
npm run lint

# Fix lint issues
npm run lint:fix

# Format
npm run format

# Type check
npm run typecheck
```

### Building

```bash
# Development build
npm run build

# Production build (bundled + minified)
npm run build:prod

# Watch mode
npm run build:watch
```

---

## Environment Configuration

### Development Environment

Create a `.env.local` file (git-ignored):

```env
# Azure AD App Registration
CU_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CU_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional: Default endpoint for testing
CU_DEFAULT_ENDPOINT=https://my-dev-resource.cognitiveservices.azure.com
```

### Test Configuration

For running integration tests, set:

```env
# Test resource (isolated from production)
CU_TEST_ENDPOINT=https://test-resource.cognitiveservices.azure.com
```

---

## Key Development Patterns

### Adding a New Command

1. **Create command file** in `src/commands/`:

```typescript
// src/commands/mycommand.ts
import { Command } from "commander";
import { GlobalOptions } from "../models/cli.js";

export function registerMyCommand(program: Command): void {
  program
    .command("mycommand <arg>")
    .description("Description of my command")
    .option("--some-option <value>", "Option description")
    .action(async (arg: string, options: GlobalOptions) => {
      // Lazy load heavy dependencies
      const { MyService } = await import("../services/my-service.js");
      
      // Execute command logic
      const service = new MyService();
      const result = await service.doSomething(arg, options);
      
      // Output result
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatTable(result));
      }
    });
}
```

2. **Register in index.ts**:

```typescript
import { registerMyCommand } from "./commands/mycommand.js";
registerMyCommand(program);
```

3. **Add contract test** in `tests/contract/`:

```typescript
// tests/contract/mycommand.test.ts
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("cu mycommand", () => {
  it("should_output_valid_json_when_json_flag_provided", () => {
    const output = execSync("node dist/cu.cjs mycommand test --json").toString();
    const result = JSON.parse(output);
    expect(result).toHaveProperty("expectedField");
  });
});
```

### Error Handling Pattern

```typescript
// src/lib/errors.ts
export class CliError extends Error {
  constructor(
    public code: string,
    message: string,
    public why: string,
    public fix: string,
    public exitCode: number = 1
  ) {
    super(message);
    this.name = "CliError";
  }
}

// Usage
throw new CliError(
  "AUTH_REQUIRED",
  "Authentication required",
  "No cached credentials found or session expired",
  "Sign in to Azure\n     $ cu login",
  1
);
```

### Lazy Loading Pattern

```typescript
// Only load MSAL when auth is needed
async function getAuthService(): Promise<AuthService> {
  const { AuthService } = await import("./services/auth.js");
  return AuthService.getInstance();
}
```

---

## Testing Strategy

### Unit Tests

Test isolated functions with mocked dependencies:

```typescript
// tests/unit/services/config.test.ts
import { describe, it, expect, vi } from "vitest";
import { ConfigService } from "../../../src/services/config.js";

describe("ConfigService", () => {
  it("should_validate_endpoint_url_when_setting_config", () => {
    const service = new ConfigService();
    expect(() => service.validateEndpoint("not-a-url")).toThrow();
    expect(() => service.validateEndpoint("https://valid.url")).not.toThrow();
  });
});
```

### Contract Tests

Test CLI input/output contracts:

```typescript
// tests/contract/config.test.ts
describe("cu config set", () => {
  it("should_return_exit_code_0_when_valid_endpoint", () => {
    const result = spawnSync("node", [
      "dist/cu.cjs", "config", "set",
      "--endpoint", "https://test.cognitiveservices.azure.com"
    ]);
    expect(result.status).toBe(0);
  });
  
  it("should_return_exit_code_7_when_invalid_endpoint", () => {
    const result = spawnSync("node", [
      "dist/cu.cjs", "config", "set",
      "--endpoint", "not-a-url"
    ]);
    expect(result.status).toBe(7);
  });
});
```

### Integration Tests

Test with mocked Azure API:

```typescript
// tests/integration/analyze.test.ts
import { setupServer } from "msw/node";
import { rest } from "msw";

const server = setupServer(
  rest.post("*/analyzers/:id\\:analyze", (req, res, ctx) => {
    return res(
      ctx.status(202),
      ctx.set("Operation-Location", "https://test/results/123")
    );
  }),
  rest.get("*/analyzerResults/123", (req, res, ctx) => {
    return res(ctx.json({ id: "123", status: "succeeded", result: {...} }));
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());
```

---

## Performance Benchmarking

```bash
# Benchmark startup time
npm run benchmark

# Manual check
powershell -Command "1..10 | ForEach-Object { (Measure-Command { node dist/cu.cjs --help }).TotalMilliseconds } | Measure-Object -Average"
```

**Targets:**
| Command | Target | Acceptable |
|---------|--------|------------|
| `--version` | <50ms | <100ms |
| `--help` | <100ms | <150ms |
| Simple command | <200ms | <300ms |

---

## Common Tasks

### Update Dependencies

```bash
npm update
npm audit fix
```

### Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Push: `git push && git push --tags`
5. CI/CD publishes to npm

---

## Troubleshooting

### "Module not found" errors

```bash
npm run build
# Ensure dist/ is populated
```

### Authentication issues

```bash
# Clear cached tokens
cu logout

# Check identity
cu whoami
```

### Slow startup

```bash
# Check for barrel file imports
# Verify lazy loading is implemented
npm run build:prod
# Test bundled version
```

---

## Resources

- [Azure Content Understanding Docs](https://learn.microsoft.com/azure/ai-services/content-understanding/)
- [MSAL Node Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node)
- [Commander.js Documentation](https://github.com/tj/commander.js)
- [Vitest Documentation](https://vitest.dev/)
