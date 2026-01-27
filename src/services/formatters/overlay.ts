/**
 * Overlay formatter for rendering bounding boxes on images.
 * Uses sharp library (lazy loaded) for image manipulation.
 * Supports PDF input through pdf-to-png-converter.
 */

import type { AnalysisResult, BoundingBox } from '../../models/analysis-result.js';
import { CliError, ErrorCodes } from '../../lib/errors.js';
import * as path from 'path';

/**
 * Color palette for different field types.
 */
const COLORS: Record<string, string> = {
  string: '#4CAF50',    // Green
  number: '#2196F3',    // Blue
  date: '#FF9800',      // Orange
  time: '#9C27B0',      // Purple
  boolean: '#E91E63',   // Pink
  array: '#00BCD4',     // Cyan
  object: '#795548',    // Brown
  default: '#F44336',   // Red
};

/**
 * Options for overlay rendering.
 */
export interface OverlayOptions {
  /** Line width for bounding boxes */
  lineWidth?: number;
  /** Opacity for fill (0-1) */
  fillOpacity?: number;
  /** Whether to show field labels */
  showLabels?: boolean;
  /** Font size for labels */
  fontSize?: number;
  /** Page number to render (1-indexed, undefined = all pages) */
  pageNumber?: number;
  /** DPI for PDF rendering (default: 150) */
  dpi?: number;
}

/**
 * Result of overlay rendering.
 */
export interface OverlayResult {
  /** Rendered image as buffer */
  buffer: Buffer;
  /** MIME type of output */
  mimeType: string;
  /** Number of bounding boxes drawn */
  boxCount: number;
  /** Page number that was rendered (1-indexed) */
  pageNumber?: number;
}

/**
 * Result of multi-page overlay rendering.
 */
export interface MultiPageOverlayResult {
  /** Array of rendered pages */
  pages: OverlayResult[];
  /** Total number of pages */
  totalPages: number;
}

/**
 * Converts inches to pixels at a given DPI.
 * PDF coordinates from Azure CU are typically in inches.
 * @param inches - Value in inches
 * @param dpi - Dots per inch (default: 150)
 * @returns Value in pixels
 */
export function convertInchesToPixels(inches: number, dpi: number = 150): number {
  return inches * dpi;
}

/**
 * Scales bounding box coordinates from inches to pixels.
 * @param box - Bounding box with coordinates in inches
 * @param dpi - Target DPI for conversion
 * @returns Bounding box with coordinates in pixels
 */
function scaleBoundingBox(box: BoundingBox, dpi: number): BoundingBox {
  return {
    pageNumber: box.pageNumber,
    polygon: box.polygon.map(coord => convertInchesToPixels(coord, dpi)),
  };
}

/**
 * Parses a source grounding string into bounding box.
 * Format: "D(pageNumber,x1,y1,x2,y2,x3,y3,x4,y4)" or "D(pageNumber,x1,y1,x2,y2,x3,y3,x4,y4);D(...)"
 * Note: Coordinates are in inches from the Azure API
 * @param source - The source string from field extraction
 * @returns Array of bounding boxes, or empty array if parsing fails
 */
function parseSourceToBoundingBoxes(source: string): BoundingBox[] {
  const boxes: BoundingBox[] = [];
  
  // Match D(pageNumber, coordinates...) pattern
  // The coordinates can be integers or decimals
  const pattern = /D\((\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)*)\)/g;
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(source)) !== null) {
    const values = match[1]?.split(',').map(v => parseFloat(v.trim()));
    
    // Expect at least 9 values: pageNumber + 4 points (8 coordinates)
    if (values !== undefined && values.length >= 9) {
      const pageNumber = Math.floor(values[0] ?? 1);
      // The remaining values are polygon coordinates
      const polygon = values.slice(1);
      
      // Scale coordinates from inches to pixels (assuming 72 DPI as default)
      // Azure CU uses normalized coordinates - but for overlay we need to check
      // if these are in a 0-1 range or actual coordinates
      boxes.push({
        pageNumber,
        polygon,
      });
    }
  }
  
  return boxes;
}

/**
 * Extracts all bounding boxes from an analysis result.
 */
export function extractBoundingBoxes(
  result: AnalysisResult,
  pageNumber?: number
): Array<{ box: BoundingBox; label: string; type: string }> {
  const boxes: Array<{ box: BoundingBox; label: string; type: string }> = [];

  for (const content of result.contents ?? []) {
    // Extract from fields
    for (const [name, field] of Object.entries(content.fields)) {
      // First try boundingRegions (standard format)
      if (field.boundingRegions !== undefined && field.boundingRegions.length > 0) {
        for (const region of field.boundingRegions) {
          if (pageNumber === undefined || region.pageNumber === pageNumber) {
            boxes.push({
              box: region,
              label: name,
              type: field.type,
            });
          }
        }
      } else if (field.source !== undefined) {
        // Fallback: parse source grounding string
        const parsedBoxes = parseSourceToBoundingBoxes(field.source);
        for (const box of parsedBoxes) {
          if (pageNumber === undefined || box.pageNumber === pageNumber) {
            boxes.push({
              box,
              label: name,
              type: field.type,
            });
          }
        }
      }
    }

    // Extract from tables
    if (content.tables !== undefined) {
      for (let i = 0; i < content.tables.length; i++) {
        const table = content.tables[i];
        if (table?.boundingRegions !== undefined) {
          for (const region of table.boundingRegions) {
            if (pageNumber === undefined || region.pageNumber === pageNumber) {
              boxes.push({
                box: region,
                label: `Table ${i + 1}`,
                type: 'object',
              });
            }
          }
        }
      }
    }

    // Extract from figures
    if (content.figures !== undefined) {
      for (const figure of content.figures) {
        if (figure.boundingRegions !== undefined) {
          for (const region of figure.boundingRegions) {
            if (pageNumber === undefined || region.pageNumber === pageNumber) {
              boxes.push({
                box: region,
                label: figure.caption ?? figure.id,
                type: 'object',
              });
            }
          }
        }
      }
    }
  }

  return boxes;
}

/**
 * Gets color for a field type.
 */
export function getColorForType(type: string): string {
  return COLORS[type] ?? COLORS['default'] ?? '#F44336';
}

/**
 * Converts hex color to RGB values.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result === null) {
    return { r: 255, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1] ?? '0', 16),
    g: parseInt(result[2] ?? '0', 16),
    b: parseInt(result[3] ?? '0', 16),
  };
}

/**
 * Creates an SVG overlay with bounding boxes.
 */
export function createSvgOverlay(
  width: number,
  height: number,
  boxes: Array<{ box: BoundingBox; label: string; type: string }>,
  options: OverlayOptions = {}
): string {
  const {
    lineWidth = 2,
    fillOpacity = 0.1,
    showLabels = true,
    fontSize = 12,
  } = options;

  const elements: string[] = [];

  for (const { box, label, type } of boxes) {
    const color = getColorForType(type);
    const rgb = hexToRgb(color);
    const polygon = box.polygon;

    // Convert polygon points to SVG path
    // Polygon format: [x1,y1, x2,y2, x3,y3, x4,y4, ...]
    if (polygon.length >= 4) {
      const points: string[] = [];
      for (let i = 0; i < polygon.length; i += 2) {
        const x = polygon[i];
        const y = polygon[i + 1];
        if (x !== undefined && y !== undefined) {
          points.push(`${x},${y}`);
        }
      }

      if (points.length >= 2) {
        // Draw polygon
        elements.push(
          `<polygon points="${points.join(' ')}" ` +
          `fill="rgba(${rgb.r},${rgb.g},${rgb.b},${fillOpacity})" ` +
          `stroke="${color}" stroke-width="${lineWidth}" />`
        );

        // Draw label if enabled
        if (showLabels && polygon[0] !== undefined && polygon[1] !== undefined) {
          const labelX = polygon[0];
          const labelY = Math.max(polygon[1] - 5, fontSize);
          elements.push(
            `<text x="${labelX}" y="${labelY}" ` +
            `font-size="${fontSize}" font-family="Arial, sans-serif" ` +
            `fill="${color}" font-weight="bold">` +
            `${escapeXml(label)}</text>`
          );
        }
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${elements.join('')}</svg>`;
}

/**
 * Escapes XML special characters.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sharp module type for lazy loading.
 */
interface SharpInstance {
  metadata(): Promise<{ width?: number; height?: number }>;
  composite(overlays: Array<{ input: Buffer; top: number; left: number }>): SharpInstance;
  png(): SharpInstance;
  toBuffer(): Promise<Buffer>;
}

type SharpFunction = (input: string | Buffer) => SharpInstance;

/**
 * Renders overlay on an image using sharp.
 * Sharp is loaded lazily to avoid startup performance impact.
 * Supports both image files and PDF files.
 */
export async function renderOverlay(
  imagePath: string,
  result: AnalysisResult,
  options: OverlayOptions = {}
): Promise<OverlayResult> {
  const ext = path.extname(imagePath).toLowerCase();
  const isPdf = ext === '.pdf';

  // For PDF files, render the page to image first
  if (isPdf) {
    return renderPdfOverlay(imagePath, result, options);
  }

  // Lazy load sharp
  let sharp: SharpFunction;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharpModule = await import('sharp') as { default: SharpFunction };
    sharp = sharpModule.default;
  } catch {
    throw new CliError(
      ErrorCodes.UNSUPPORTED_FILE_TYPE,
      'Sharp library not available',
      'The sharp image processing library is required for overlay output',
      'Install sharp: npm install sharp'
    );
  }

  // Load the source image
  const image = sharp(imagePath);
  const metadata = await image.metadata();

  if (metadata.width === undefined || metadata.height === undefined) {
    throw new CliError(
      ErrorCodes.UNSUPPORTED_FILE_TYPE,
      'Cannot read image dimensions',
      `Failed to get dimensions from: ${imagePath}`,
      'Ensure the file is a valid image format'
    );
  }

  const width = metadata.width;
  const height = metadata.height;

  // Extract bounding boxes for the specified page
  const boxes = extractBoundingBoxes(result, options.pageNumber ?? 1);

  if (boxes.length === 0) {
    // No boxes to draw, return original image
    return {
      buffer: await image.png().toBuffer(),
      mimeType: 'image/png',
      boxCount: 0,
    };
  }

  // Create SVG overlay
  const svg = createSvgOverlay(width, height, boxes, options);

  // Composite the overlay onto the image
  const composited = await image
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return {
    buffer: composited,
    mimeType: 'image/png',
    boxCount: boxes.length,
  };
}

/**
 * Renders overlay on a PDF page.
 * Converts the PDF page to image first, then applies overlay.
 */
async function renderPdfOverlay(
  pdfPath: string,
  result: AnalysisResult,
  options: OverlayOptions = {}
): Promise<OverlayResult> {
  const dpi = options.dpi ?? 150;
  const pageNumber = options.pageNumber ?? 1;

  // Lazy load pdf-renderer
  let renderPdfPage: typeof import('../../lib/pdf-renderer.js').renderPdfPage;
  try {
    const pdfRenderer = await import('../../lib/pdf-renderer.js');
    renderPdfPage = pdfRenderer.renderPdfPage;
  } catch {
    throw new CliError(
      ErrorCodes.UNSUPPORTED_FILE_TYPE,
      'PDF rendering not available',
      'The pdf-to-png-converter package is not installed',
      'Install optional dependency: npm install pdf-to-png-converter'
    );
  }

  // Render the PDF page to image
  const pageResult = await renderPdfPage({
    pdfPath,
    dpi,
    pageNumber,
  });

  // Lazy load sharp
  let sharp: SharpFunction;
  try {
    const sharpModule = await import('sharp') as { default: SharpFunction };
    sharp = sharpModule.default;
  } catch {
    throw new CliError(
      ErrorCodes.UNSUPPORTED_FILE_TYPE,
      'Sharp library not available',
      'The sharp image processing library is required for overlay output',
      'Install sharp: npm install sharp'
    );
  }

  const width = pageResult.width;
  const height = pageResult.height;

  // Extract bounding boxes for the specified page
  // Scale coordinates from inches to pixels since PDF coordinates are in inches
  const rawBoxes = extractBoundingBoxes(result, pageNumber);
  const boxes = rawBoxes.map(({ box, label, type }) => ({
    box: scaleBoundingBox(box, dpi),
    label,
    type,
  }));

  if (boxes.length === 0) {
    // No boxes to draw, return rendered page
    return {
      buffer: pageResult.buffer,
      mimeType: 'image/png',
      boxCount: 0,
      pageNumber,
    };
  }

  // Create SVG overlay with scaled coordinates
  const svg = createSvgOverlay(width, height, boxes, options);

  // Composite the overlay onto the rendered page
  const image = sharp(pageResult.buffer);
  const composited = await image
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return {
    buffer: composited,
    mimeType: 'image/png',
    boxCount: boxes.length,
    pageNumber,
  };
}

/**
 * Renders overlay on all pages of a PDF.
 * Returns an array of rendered page buffers.
 */
export async function renderPdfOverlayAllPages(
  pdfPath: string,
  result: AnalysisResult,
  options: OverlayOptions = {}
): Promise<MultiPageOverlayResult> {
  const dpi = options.dpi ?? 150;

  // Lazy load pdf-renderer
  let renderAllPdfPages: typeof import('../../lib/pdf-renderer.js').renderAllPdfPages;
  try {
    const pdfRenderer = await import('../../lib/pdf-renderer.js');
    renderAllPdfPages = pdfRenderer.renderAllPdfPages;
  } catch {
    throw new CliError(
      ErrorCodes.UNSUPPORTED_FILE_TYPE,
      'PDF rendering not available',
      'The pdf-to-png-converter package is not installed',
      'Install optional dependency: npm install pdf-to-png-converter'
    );
  }

  // Render all PDF pages
  const pagesResult = await renderAllPdfPages({
    pdfPath,
    dpi,
  });

  // Lazy load sharp
  let sharp: SharpFunction;
  try {
    const sharpModule = await import('sharp') as { default: SharpFunction };
    sharp = sharpModule.default;
  } catch {
    throw new CliError(
      ErrorCodes.UNSUPPORTED_FILE_TYPE,
      'Sharp library not available',
      'The sharp image processing library is required for overlay output',
      'Install sharp: npm install sharp'
    );
  }

  const results: OverlayResult[] = [];

  for (const page of pagesResult.pages) {
    const width = page.width;
    const height = page.height;
    const pageNumber = page.pageNumber;

    // Extract and scale bounding boxes for this page
    const rawBoxes = extractBoundingBoxes(result, pageNumber);
    const boxes = rawBoxes.map(({ box, label, type }) => ({
      box: scaleBoundingBox(box, dpi),
      label,
      type,
    }));

    if (boxes.length === 0) {
      // No boxes to draw, return rendered page as-is
      results.push({
        buffer: page.buffer,
        mimeType: 'image/png',
        boxCount: 0,
        pageNumber,
      });
      continue;
    }

    // Create SVG overlay with scaled coordinates
    const svg = createSvgOverlay(width, height, boxes, options);

    // Composite the overlay onto the rendered page
    const image = sharp(page.buffer);
    const composited = await image
      .composite([
        {
          input: Buffer.from(svg),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    results.push({
      buffer: composited,
      mimeType: 'image/png',
      boxCount: boxes.length,
      pageNumber,
    });
  }

  return {
    pages: results,
    totalPages: pagesResult.totalPages,
  };
}

/**
 * Generates a summary of what would be rendered.
 */
export function getOverlaySummary(
  result: AnalysisResult,
  pageNumber?: number
): string {
  const boxes = extractBoundingBoxes(result, pageNumber);
  
  if (boxes.length === 0) {
    return 'No bounding boxes found in analysis result.';
  }

  const byType = new Map<string, number>();
  for (const { type } of boxes) {
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }

  const summary = [`Found ${boxes.length} bounding box(es):`];
  for (const [type, count] of byType) {
    summary.push(`  - ${type}: ${count}`);
  }

  return summary.join('\n');
}
