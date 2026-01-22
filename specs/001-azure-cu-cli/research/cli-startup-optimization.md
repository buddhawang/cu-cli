# Node.js CLI Startup Optimization Research

**Goal:** Achieve sub-200ms cold start time for CLI tool

---

## Executive Summary

### Decision Matrix

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| **Module Format** | **ESM with bundling** | Better tree-shaking, modern standard, but bundle to avoid ESM resolution overhead |
| **Bundling** | **Yes - esbuild** | Critical for startup performance; flattens module graph, eliminates file I/O |
| **Output Format** | **CJS bundle** | Faster require() in Node.js, avoids ESM async loading overhead for CLI |
| **CLI Framework** | **commander.js (lazy)** | Lightweight, but lazy-load for commands not invoked |

---

## 1. ESM vs CommonJS Impact on Startup Time

### CommonJS Advantages for CLI Cold Start
- **Synchronous loading**: `require()` is synchronous, no Promise overhead
- **Faster resolution**: Simpler algorithm, cached `require.cache`
- **Battle-tested**: Optimized over years in Node.js

### ESM Considerations
- **Async by design**: Uses Promises for module loading
- **Stricter resolution**: Requires file extensions, no folder indexes
- **Tree-shaking friendly**: Better static analysis for dead code elimination
- **Named exports detection**: More predictable at build time

### Recommendation
**Write source in ESM, bundle to CJS for distribution:**
```javascript
// esbuild config
{
  format: 'cjs',        // Output CommonJS for fastest Node.js startup
  platform: 'node',
  bundle: true,
  target: 'node18'      // Or your minimum Node version
}
```

---

## 2. Bundling Strategies for CLI Apps

### Why Bundle?
From research on module loading costs:
- **500 modules**: ~0.15s load time
- **1,000 modules**: ~0.31s load time  
- **10,000 modules**: ~3.12s load time

Bundling collapses thousands of files into one, eliminating:
- File system I/O for each module
- Module resolution algorithm execution
- Module graph construction

### esbuild Configuration for CLI
```javascript
// build.js
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/cli.js',
  
  // CLI-specific optimizations
  minify: true,
  minifyIdentifiers: true,
  minifyWhitespace: true,
  minifySyntax: true,
  
  // Tree-shaking
  treeShaking: true,
  
  // Keep native modules external
  external: [
    'fsevents',      // Native module
    // Add any native addons here
  ],
  
  // Mark Node.js builtins as external (they're already available)
  packages: 'external', // Or list specific packages to externalize
  
  // Generate metafile for bundle analysis
  metafile: true,
});
```

### Key esbuild Features for CLI

1. **`--packages=external`**: Keep node_modules external when dependencies have native code
2. **`--bundle`**: Inline all dependencies
3. **`--minify`**: Reduce parse time through smaller code
4. **`--tree-shaking`**: Remove unused exports
5. **`--metafile`**: Generate bundle analysis

---

## 3. Lazy Loading Patterns

### Pattern 1: Dynamic Import for Commands
```javascript
// cli.js - Only load command when invoked
const program = new Command();

program
  .command('deploy')
  .description('Deploy resources')
  .action(async (options) => {
    // Lazy load the heavy deployment module
    const { deploy } = await import('./commands/deploy.js');
    await deploy(options);
  });
```

### Pattern 2: Conditional Require (CJS)
```javascript
// Only load Azure SDK when needed
function getAzureClient() {
  // This module is NOT loaded at startup
  const { DefaultAzureCredential } = require('@azure/identity');
  return new DefaultAzureCredential();
}
```

### Pattern 3: Lazy Property Access
```javascript
// Defer expensive initialization
let _heavyModule = null;

function getHeavyModule() {
  if (!_heavyModule) {
    _heavyModule = require('./heavy-module');
  }
  return _heavyModule;
}

module.exports = {
  get heavyModule() {
    return getHeavyModule();
  }
};
```

### Pattern 4: Command-specific Entry Points (esbuild code splitting)
```javascript
// esbuild with splitting for lazy-loaded commands
await esbuild.build({
  entryPoints: {
    cli: 'src/cli.ts',
    'commands/deploy': 'src/commands/deploy.ts',
    'commands/status': 'src/commands/status.ts',
  },
  bundle: true,
  splitting: true,      // Enable code splitting
  format: 'esm',        // Required for splitting
  outdir: 'dist',
});
```

---

## 4. Avoiding Unused Code Paths

### Anti-Pattern: Barrel Files
**Avoid this:**
```javascript
// index.js (barrel file) - Loads EVERYTHING
export * from './azure-client';
export * from './deployment';
export * from './monitoring';
export * from './heavy-analytics';
```

**Do this instead:**
```javascript
// Direct imports - only loads what's needed
import { createClient } from './azure-client';
// NOT: import { createClient } from './';
```

### Tree-Shaking Requirements
1. **Use ESM syntax**: `import`/`export` (not `require`/`module.exports`)
2. **Avoid side effects**: Mark packages as `"sideEffects": false` in package.json
3. **Pure functions**: Use `/* @__PURE__ */` annotation for safe removal
4. **No dynamic requires**: `require(variable)` cannot be tree-shaken

```json
// package.json
{
  "sideEffects": false,
  // Or specify files with side effects:
  "sideEffects": ["./src/polyfills.js"]
}
```

### esbuild Pure Annotations
```javascript
// Mark function calls as safe to remove if unused
const result = /* @__PURE__ */ expensiveComputation();
```

---

## 5. Commander.js Impact on Startup Time

### Commander.js Characteristics
- **Lightweight core**: ~40KB unpacked
- **No native dependencies**: Pure JavaScript
- **Immediate parsing overhead**: All `.option()` and `.command()` calls execute at startup

### Optimization Strategies

#### Strategy 1: Lazy Command Loading
```javascript
import { Command } from 'commander';
const program = new Command();

// Define command metadata only (lightweight)
program
  .command('deploy')
  .description('Deploy Azure resources')
  .option('-e, --environment <env>', 'Target environment')
  .action(async (options) => {
    // Heavy imports happen only when command runs
    const { runDeploy } = await import('./commands/deploy.js');
    await runDeploy(options);
  });

// This is fast - just parses args
program.parse();
```

#### Strategy 2: Subcommand Executables
```javascript
// For very heavy commands, use separate executables
program
  .command('analyze', 'Run analysis', { executableFile: 'cu-analyze' });
// Commander spawns 'cu-analyze' as separate process
```

#### Strategy 3: Minimal Top-Level Imports
```javascript
// cli.ts - Keep imports minimal
import { Command } from 'commander';  // Only essential import

const program = new Command();
program.name('cu').version('1.0.0');

// Everything else lazy-loaded in action handlers
```

### Alternative: Consider Lighter Frameworks
| Framework | Size | Features |
|-----------|------|----------|
| commander | ~40KB | Full-featured |
| yargs | ~200KB | Very full-featured |
| cac | ~8KB | Lightweight |
| citty | ~5KB | Minimal |
| arg | ~3KB | Argument parsing only |

---

## 6. Tree-Shaking Considerations

### What Enables Tree-Shaking
1. **ESM exports**: Static analysis possible
2. **No side effects**: Module execution doesn't change global state
3. **Unused export detection**: Bundler can prove code is unreachable

### What Breaks Tree-Shaking
```javascript
// ❌ Cannot tree-shake - dynamic access
const method = 'foo';
obj[method]();

// ❌ Cannot tree-shake - eval
eval('someCode');

// ❌ Cannot tree-shake - CommonJS
module.exports = { foo, bar };

// ❌ Cannot tree-shake - import all
import * as utils from './utils';
```

### esbuild Tree-Shaking Config
```javascript
{
  treeShaking: true,
  
  // Helps tree-shaking by knowing what's safe to remove
  pure: ['console.log', 'console.debug'],
  
  // Drop console statements entirely
  drop: ['console', 'debugger'],
  
  // Ignore sideEffects: false when it's wrong
  ignoreAnnotations: false,
}
```

---

## 7. Benchmarking Approach

### Measurement Script
```javascript
// benchmark-startup.js
const { execSync } = require('child_process');

function measureStartup(command, iterations = 10) {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    execSync(command, { stdio: 'pipe' });
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1_000_000); // Convert to ms
  }
  
  // Remove outliers (first run may include JIT warmup)
  times.shift();
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  return { avg, min, max, times };
}

// Measure --help (minimal code path)
console.log('--help timing:', measureStartup('node dist/cli.js --help'));

// Measure --version (even more minimal)
console.log('--version timing:', measureStartup('node dist/cli.js --version'));
```

### PowerShell Measurement
```powershell
# Quick measurement
Measure-Command { node dist/cli.js --help } | Select-Object TotalMilliseconds

# Multiple runs
1..10 | ForEach-Object { 
    (Measure-Command { node dist/cli.js --help }).TotalMilliseconds 
} | Measure-Object -Average -Minimum -Maximum
```

### Node.js Built-in Timing
```bash
# Using --perf-basic-prof for detailed timing
node --cpu-prof dist/cli.js --help

# Time to first byte of output
time node dist/cli.js --version
```

### Target Metrics
| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| `--version` | <50ms | <100ms | >200ms |
| `--help` | <100ms | <150ms | >250ms |
| Simple command | <200ms | <300ms | >500ms |

---

## 8. Implementation Checklist

### Pre-Build Optimizations
- [ ] Use ESM source code (`import`/`export`)
- [ ] Avoid barrel files (re-export files)
- [ ] Mark package.json with `"sideEffects": false`
- [ ] Use direct imports, not namespace imports

### Build Configuration
- [ ] Bundle with esbuild
- [ ] Output CJS format for Node.js CLI
- [ ] Enable tree-shaking
- [ ] Enable minification
- [ ] Externalize native modules
- [ ] Generate metafile for analysis

### Runtime Optimizations
- [ ] Lazy-load commands with `await import()`
- [ ] Defer heavy SDK initialization
- [ ] Minimal top-level imports in entry point
- [ ] Use `/* @__PURE__ */` annotations

### Validation
- [ ] Benchmark `--version` < 50ms
- [ ] Benchmark `--help` < 100ms
- [ ] Benchmark simple command < 200ms
- [ ] Profile with `--cpu-prof` if needed

---

## 9. Example Build Script

```javascript
// scripts/build.mjs
import * as esbuild from 'esbuild';
import { execSync } from 'child_process';

const result = await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/cli.js',
  minify: true,
  treeShaking: true,
  metafile: true,
  external: [
    // Native modules that can't be bundled
    'fsevents',
  ],
  banner: {
    js: '#!/usr/bin/env node',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

// Analyze bundle
const text = await esbuild.analyzeMetafile(result.metafile);
console.log(text);

// Benchmark
console.log('\nStartup benchmark:');
const times = [];
for (let i = 0; i < 5; i++) {
  const start = performance.now();
  execSync('node dist/cli.js --version', { stdio: 'pipe' });
  times.push(performance.now() - start);
}
console.log(`Average: ${(times.reduce((a,b) => a+b) / times.length).toFixed(1)}ms`);
```

---

## 10. References

- [esbuild API Documentation](https://esbuild.github.io/api/)
- [Node.js ESM Documentation](https://nodejs.org/api/esm.html)
- [Commander.js](https://github.com/tj/commander.js)
- [Speeding up JavaScript ecosystem - Barrel files](https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/)
