# PDF to PNG Rendering in Node.js - Research

## Overview

This document evaluates options for rendering PDF pages to PNG images in Node.js for a CLI tool. The requirements are:

1. Load a PDF file from disk
2. Render each page to a PNG image buffer
3. Support custom DPI (e.g., 150 DPI)
4. Cross-platform (Windows, macOS, Linux)
5. No system-level dependencies (pure JS preferred)
6. Lazy-loadable to avoid CLI startup performance impact
7. Output as Buffer for compositing with sharp

---

## Option 1: pdf-to-png-converter (Recommended)

**Description**: A Node.js utility built on `pdfjs-dist` and `@napi-rs/canvas` that converts PDF pages to PNG buffers with no native binary dependencies.

### Installation

```bash
npm install pdf-to-png-converter
```

### Dependencies

- `pdfjs-dist` (~5.4.530) - Mozilla's PDF.js
- `@napi-rs/canvas` (~0.1.88) - Pure Rust canvas implementation with prebuilt binaries

### Code Example

```typescript
import { pdfToPng } from 'pdf-to-png-converter';
import * as fs from 'fs';

async function renderPdfPageToPng(pdfPath: string, pageNumber: number = 1, dpi: number = 150): Promise<Buffer> {
  // DPI is controlled via viewportScale (72 DPI is the base, so scale = dpi / 72)
  const scale = dpi / 72;
  
  const pngPages = await pdfToPng(pdfPath, {
    viewportScale: scale,
    pagesToProcess: [pageNumber],
    returnPageContent: true,
    disableFontFace: true,     // Use built-in font renderer
    useSystemFonts: false,      // Don't rely on system fonts
    verbosityLevel: 0,          // Suppress logs
  });
  
  if (pngPages.length === 0) {
    throw new Error(`Page ${pageNumber} not found in PDF`);
  }
  
  return pngPages[0].content!;
}

// Usage
const pngBuffer = await renderPdfPageToPng('./document.pdf', 1, 150);

// Composite with sharp
import sharp from 'sharp';
const processed = await sharp(pngBuffer).resize(800).toBuffer();
```

### Node.js Compatibility

- **Minimum Node.js**: 20.x
- **Module System**: ESM and CJS supported
- **TypeScript**: Built-in type declarations

### Native Dependencies

- **None required to install** - Uses `@napi-rs/canvas` which ships prebuilt binaries for:
  - Windows x64
  - macOS x64 and ARM64 (Apple Silicon)
  - Linux x64 (glibc and musl)

### Memory/Performance

- Streams PDF parsing, memory-efficient
- Supports parallel page processing with `processPagesInParallel: true`
- Configurable `concurrencyLimit` (default: 4)
- Can skip returning content buffer with `returnPageContent: false` to save memory when writing to files

### Lazy-Loading

```typescript
// Lazy load the module only when needed
async function renderPdf(pdfPath: string): Promise<Buffer> {
  const { pdfToPng } = await import('pdf-to-png-converter');
  const pages = await pdfToPng(pdfPath, { pagesToProcess: [1] });
  return pages[0].content!;
}
```

### Pros

- ✅ No system dependencies - truly portable
- ✅ Cross-platform with prebuilt binaries
- ✅ Returns Buffer directly - perfect for sharp compositing
- ✅ DPI control via `viewportScale`
- ✅ TypeScript support
- ✅ Active maintenance (v3.13.0, updated recently)
- ✅ 60k+ weekly downloads

### Cons

- ⚠️ Requires Node.js 20+
- ⚠️ `@napi-rs/canvas` adds ~10MB to node_modules

---

## Option 2: pdfjs-dist + node-canvas

**Description**: Using Mozilla's PDF.js directly with node-canvas as the rendering backend.

### Installation

```bash
npm install pdfjs-dist canvas
```

### Code Example

```typescript
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from 'canvas';

async function renderPdfPageToPng(pdfPath: string, pageNumber: number = 1, dpi: number = 150): Promise<Buffer> {
  const scale = dpi / 72;
  
  const loadingTask = pdfjsLib.getDocument(pdfPath);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);
  
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');
  
  await page.render({
    canvasContext: context as any,
    viewport,
  }).promise;
  
  return canvas.toBuffer('image/png');
}
```

### Node.js Compatibility

- **Minimum Node.js**: 18.x
- **Module System**: ESM preferred (legacy CJS build available)

### Native Dependencies

**node-canvas requires Cairo and other native libraries:**

| Platform | Dependencies |
|----------|-------------|
| macOS | `brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman` |
| Ubuntu | `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev` |
| Windows | Prebuilt binaries available for x64, but may need manual setup |

### Memory/Performance

- Good performance, but requires manual canvas management
- PDF.js streams page content
- Canvas memory must be explicitly managed

### Lazy-Loading

```typescript
async function renderPdf(pdfPath: string): Promise<Buffer> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('canvas');
  // ... render logic
}
```

### Pros

- ✅ Full control over rendering
- ✅ Mature, well-documented libraries
- ✅ Widely used combination

### Cons

- ❌ **node-canvas requires native dependencies** on macOS/Linux
- ❌ Complex installation on Windows
- ❌ More boilerplate code needed
- ❌ Must handle canvas cleanup manually

---

## Option 3: pdf-img-convert

**Description**: A lightweight wrapper around PDF.js for converting PDFs to images.

### Installation

```bash
npm install pdf-img-convert
```

### Code Example

```typescript
async function renderPdfPageToPng(pdfPath: string, pageNumber: number = 1, dpi: number = 150): Promise<Buffer> {
  const pdf2img = await import('pdf-img-convert');
  const scale = dpi / 72;
  
  const images = await pdf2img.convert(pdfPath, {
    scale,
    page_numbers: [pageNumber],
    base64: false,  // Returns Uint8Array
  });
  
  return Buffer.from(images[0]);
}
```

### Node.js Compatibility

- **Module System**: ESM only (dynamic import required)

### Native Dependencies

- Uses PDF.js with its own canvas polyfill
- Should work without native dependencies

### Memory/Performance

- Loads all pages unless filtered
- Returns Uint8Array (needs Buffer conversion)

### Pros

- ✅ Simple API
- ✅ No native dependencies
- ✅ Lightweight (19.5 kB unpacked)

### Cons

- ⚠️ ESM only - requires dynamic import in CJS projects
- ⚠️ Lower weekly downloads (17k) - less community support
- ⚠️ Last update over a year ago
- ⚠️ Less control over rendering options

---

## Option 4: pdf2pic

**Description**: Converts PDFs to images using GraphicsMagick and Ghostscript.

### Installation

```bash
npm install pdf2pic
```

**System Dependencies Required:**
- GraphicsMagick
- Ghostscript

### Code Example

```typescript
import { fromPath } from 'pdf2pic';

async function renderPdfPageToPng(pdfPath: string, pageNumber: number = 1, dpi: number = 150): Promise<Buffer> {
  const convert = fromPath(pdfPath, {
    density: dpi,
    format: 'png',
    width: 800,
    height: 600,
  });
  
  const result = await convert(pageNumber, { responseType: 'buffer' });
  return result.buffer!;
}
```

### Native Dependencies

❌ **Requires system-level installation:**
- GraphicsMagick
- Ghostscript

### Pros

- ✅ High-quality rendering
- ✅ Good DPI control

### Cons

- ❌ **Requires Ghostscript and GraphicsMagick** - not portable
- ❌ Installation varies by platform
- ❌ Not suitable for a portable CLI tool

---

## Option 5: pdf-poppler

**Description**: Uses Poppler binaries for PDF conversion.

### Installation

```bash
npm install pdf-poppler
```

### Native Dependencies

- Includes statically compiled Poppler binaries
- **Windows and macOS only** - no Linux support

### Pros

- ✅ Fast (10x faster than other converters per docs)
- ✅ Bundled binaries - no separate install

### Cons

- ❌ **No Linux support**
- ❌ Large package size (87.9 MB)
- ❌ Writes to files only - no buffer output
- ❌ Not suitable for cross-platform CLI

---

## Option 6: sharp with PDF Support?

**Description**: Can sharp read PDFs directly?

### Answer: **No**

Sharp does not support PDF input. From the sharp documentation, supported input formats are:
- JPEG, PNG, WebP, GIF, AVIF, TIFF, SVG

PDF is not a supported input format. Sharp relies on libvips, which has limited PDF support only when compiled with poppler (not included in prebuilt binaries).

**Conclusion**: PDF must be converted to an image format first, then processed with sharp.

---

## Comparison Matrix

| Feature | pdf-to-png-converter | pdfjs-dist + canvas | pdf-img-convert | pdf2pic | pdf-poppler |
|---------|---------------------|---------------------|-----------------|---------|-------------|
| Pure JS | ✅ (Rust binaries) | ❌ (Cairo needed) | ✅ | ❌ | ❌ |
| Windows | ✅ | ⚠️ Complex | ✅ | ⚠️ | ✅ |
| macOS | ✅ | ⚠️ Homebrew | ✅ | ⚠️ | ✅ |
| Linux | ✅ | ⚠️ apt-get | ✅ | ⚠️ | ❌ |
| Buffer Output | ✅ | ✅ | ✅ | ✅ | ❌ |
| DPI Control | ✅ | ✅ | ✅ | ✅ | ✅ |
| TypeScript | ✅ | ✅ | ✅ | ✅ | ❌ |
| Lazy-loadable | ✅ | ✅ | ✅ | ✅ | ✅ |
| Weekly Downloads | 60k | 7M (pdfjs) / 4.8M (canvas) | 17k | 355k | 25k |
| Node.js Min | 20 | 18 | ? | 14 | ? |
| Package Size | ~40 kB + deps | ~37 MB (pdfjs) | 19 kB | 117 kB | 88 MB |

---

## Recommendation

### Primary Recommendation: **pdf-to-png-converter**

For a cross-platform CLI tool, `pdf-to-png-converter` is the best choice because:

1. **Zero system dependencies** - Uses `@napi-rs/canvas` with prebuilt binaries
2. **Cross-platform** - Windows, macOS (Intel + ARM), Linux
3. **Buffer output** - Perfect for compositing with sharp
4. **DPI control** - Via `viewportScale` parameter
5. **Lazy-loadable** - Can be dynamically imported
6. **Active maintenance** - Regular updates, good community support
7. **TypeScript** - Full type definitions included

### Implementation Pattern for CLI

```typescript
// src/services/pdf-renderer.ts

interface PdfRenderOptions {
  pageNumber?: number;
  dpi?: number;
}

interface PdfRenderResult {
  buffer: Buffer;
  width: number;
  height: number;
}

export async function renderPdfPage(
  pdfPath: string,
  options: PdfRenderOptions = {}
): Promise<PdfRenderResult> {
  const { pageNumber = 1, dpi = 150 } = options;
  
  // Lazy load to avoid startup performance impact
  const { pdfToPng } = await import('pdf-to-png-converter');
  
  const scale = dpi / 72;
  
  const pages = await pdfToPng(pdfPath, {
    viewportScale: scale,
    pagesToProcess: [pageNumber],
    returnPageContent: true,
    disableFontFace: true,
    useSystemFonts: false,
    verbosityLevel: 0,
  });
  
  if (pages.length === 0) {
    throw new Error(`Failed to render page ${pageNumber} from PDF`);
  }
  
  const page = pages[0];
  
  return {
    buffer: page.content!,
    width: page.width,
    height: page.height,
  };
}

export async function getPdfPageCount(pdfPath: string): Promise<number> {
  const { pdfToPng } = await import('pdf-to-png-converter');
  
  // Get all pages with minimal overhead
  const pages = await pdfToPng(pdfPath, {
    viewportScale: 0.1, // Very small to minimize memory
    returnPageContent: false,
    verbosityLevel: 0,
  });
  
  return pages.length;
}
```

### Alternative: pdfjs-dist + @napi-rs/canvas

If you need more control or want to avoid the pdf-to-png-converter wrapper, you can use `pdfjs-dist` directly with `@napi-rs/canvas` (the same canvas library used internally by pdf-to-png-converter). This gives you full control over rendering but requires more boilerplate.

---

## Notes on Node.js 20 Requirement

`pdf-to-png-converter` requires Node.js 20+. If you need to support Node.js 18:

1. Use `pdfjs-dist` directly with `@napi-rs/canvas`
2. Or use `pdf-img-convert` (though less maintained)

For a new CLI tool targeting modern Node.js, this requirement is acceptable as Node.js 20 is the current LTS version.
