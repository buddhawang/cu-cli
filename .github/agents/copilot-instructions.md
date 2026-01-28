# cu-cli Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-22

## Active Technologies
- TypeScript 5.7, Node.js 18+ + commander@12, @azure/msal-node@2, sharp@0.34 (optional), pdfjs-dist (new) (002-cli-enhancements)
- JSON files in `~/.cu/` (config.json, msal-cache.json) (002-cli-enhancements)
- TypeScript 5.5, Node.js 18+ + sharp (lazy-loaded), pdf-to-png-converter (lazy-loaded), commander 12.x (003-structured-field-overlay)
- N/A (stateless rendering) (003-structured-field-overlay)

- TypeScript 5.x, Node.js 18 LTS+ + @azure/msal-node (auth), commander (CLI parsing), minimal additional libraries (001-azure-cu-cli)

## Project Structure

```text
src/
tests/
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.x, Node.js 18 LTS+: Follow standard conventions

## Recent Changes
- 003-structured-field-overlay: Added TypeScript 5.5, Node.js 18+ + sharp (lazy-loaded), pdf-to-png-converter (lazy-loaded), commander 12.x
- 002-cli-enhancements: Added TypeScript 5.7, Node.js 18+ + commander@12, @azure/msal-node@2, sharp@0.34 (optional), pdfjs-dist (new)

- 001-azure-cu-cli: Added TypeScript 5.x, Node.js 18 LTS+ + @azure/msal-node (auth), commander (CLI parsing), minimal additional libraries

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
