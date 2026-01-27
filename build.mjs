#!/usr/bin/env node

import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

const isProduction = process.argv.includes('--production');
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

/** @type {esbuild.BuildOptions} */
const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/cu.cjs',
  
  // External dependencies that should not be bundled
  external: [
    // Native modules that can't be bundled
    'sharp',
    // PDF rendering has native canvas dependency
    'pdf-to-png-converter',
    '@napi-rs/canvas',
    // Keep MSAL external to avoid bundling issues with native extensions
    '@azure/msal-node-extensions',
  ],
  
  // Banner with shebang for CLI execution
  banner: {
    js: '#!/usr/bin/env node',
  },
  
  // Production optimizations
  minify: isProduction,
  sourcemap: !isProduction,
  
  // Tree shaking for smaller bundle
  treeShaking: true,
  
  // Define compile-time constants
  define: {
    'process.env.NODE_ENV': isProduction ? '"production"' : '"development"',
    '__VERSION__': `"${pkg.version}"`,
  },
  
  // Log level
  logLevel: 'info',
};

async function build() {
  const startTime = Date.now();
  
  try {
    const result = await esbuild.build(buildOptions);
    const elapsed = Date.now() - startTime;
    
    console.log(`✔ Build completed in ${elapsed}ms`);
    
    if (result.warnings.length > 0) {
      console.warn('Warnings:', result.warnings);
    }
    
    // Report bundle size
    const { statSync } = await import('fs');
    const stats = statSync('dist/cu.cjs');
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`  Bundle size: ${sizeKB} KB${isProduction ? ' (minified)' : ''}`);
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
