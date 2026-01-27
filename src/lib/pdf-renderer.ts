/**
 * PDF rendering utilities for converting PDF pages to images.
 * Uses lazy-loaded pdf-to-png-converter to avoid startup overhead.
 */

import { CliError, ErrorCodes } from './errors.js';

/**
 * Options for rendering a PDF page.
 */
export interface PdfRenderOptions {
  /** DPI for rendering (default: 150) */
  dpi?: number;
  /** Specific page number to render (1-indexed) */
  pageNumber?: number;
  /** Path to the PDF file */
  pdfPath: string;
}

/**
 * Result of rendering a PDF page to an image.
 */
export interface PdfRenderResult {
  /** Rendered image as PNG buffer */
  buffer: Buffer;
  /** Width of the rendered image in pixels */
  width: number;
  /** Height of the rendered image in pixels */
  height: number;
  /** Page number that was rendered (1-indexed) */
  pageNumber: number;
}

/**
 * Result of rendering all PDF pages.
 */
export interface PdfRenderAllResult {
  /** Array of rendered pages */
  pages: PdfRenderResult[];
  /** Total number of pages in the PDF */
  totalPages: number;
}

// Lazy-loaded pdf-to-png-converter module
let pdfToPngModule: typeof import('pdf-to-png-converter') | null = null;

/**
 * Gets the pdf-to-png-converter module, loading it lazily.
 * @throws CliError if the module is not installed
 */
async function getPdfToPng(): Promise<typeof import('pdf-to-png-converter')> {
  if (pdfToPngModule !== null) {
    return pdfToPngModule;
  }

  try {
    pdfToPngModule = await import('pdf-to-png-converter');
    return pdfToPngModule;
  } catch {
    throw new CliError(
      ErrorCodes.UNSUPPORTED_FILE_TYPE,
      'PDF rendering not available',
      'The pdf-to-png-converter package is not installed',
      'Install optional dependency: npm install pdf-to-png-converter'
    );
  }
}

/**
 * Renders a single page from a PDF to a PNG image.
 * @param options - Render options
 * @returns Rendered page result
 */
export async function renderPdfPage(options: PdfRenderOptions): Promise<PdfRenderResult> {
  const { dpi = 150, pageNumber = 1, pdfPath } = options;

  const pdfToPng = await getPdfToPng();

  try {
    const pages = await pdfToPng.pdfToPng(pdfPath, {
      viewportScale: dpi / 72, // PDF default is 72 DPI
      pagesToProcess: [pageNumber],
    });

    if (pages.length === 0) {
      throw new CliError(
        ErrorCodes.API_ERROR,
        'PDF rendering failed',
        `Could not render page ${pageNumber} from PDF`,
        'Check that the page number exists in the PDF'
      );
    }

    const page = pages[0];
    if (page === undefined || page.content === undefined) {
      throw new CliError(
        ErrorCodes.API_ERROR,
        'PDF rendering failed',
        'Page content is undefined',
        'Try a different page or check the PDF file'
      );
    }

    return {
      buffer: page.content,
      width: page.width,
      height: page.height,
      pageNumber,
    };
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);

    // Check for password-protected PDF
    if (message.toLowerCase().includes('password')) {
      throw new CliError(
        ErrorCodes.UNSUPPORTED_FILE_TYPE,
        'Password-protected PDF',
        'The PDF file is password-protected',
        'Remove the password protection or use a different file'
      );
    }

    // Check for corrupted PDF
    if (message.toLowerCase().includes('invalid') || 
        message.toLowerCase().includes('corrupt') ||
        message.toLowerCase().includes('parse')) {
      throw new CliError(
        ErrorCodes.UNSUPPORTED_FILE_TYPE,
        'Corrupted PDF',
        'The PDF file appears to be corrupted or invalid',
        'Try a different file or repair the PDF'
      );
    }

    throw new CliError(
      ErrorCodes.API_ERROR,
      'PDF rendering failed',
      message,
      'Check that the PDF file is valid'
    );
  }
}

/**
 * Renders all pages from a PDF to PNG images.
 * @param options - Render options (pageNumber is ignored)
 * @returns Array of rendered pages
 */
export async function renderAllPdfPages(options: Omit<PdfRenderOptions, 'pageNumber'>): Promise<PdfRenderAllResult> {
  const { dpi = 150, pdfPath } = options;

  const pdfToPng = await getPdfToPng();

  try {
    const pages = await pdfToPng.pdfToPng(pdfPath, {
      viewportScale: dpi / 72, // PDF default is 72 DPI
    });

    const results: PdfRenderResult[] = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (page !== undefined && page.content !== undefined) {
        results.push({
          buffer: page.content,
          width: page.width,
          height: page.height,
          pageNumber: i + 1,
        });
      }
    }

    return {
      pages: results,
      totalPages: pages.length,
    };
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);

    // Check for password-protected PDF
    if (message.toLowerCase().includes('password')) {
      throw new CliError(
        ErrorCodes.UNSUPPORTED_FILE_TYPE,
        'Password-protected PDF',
        'The PDF file is password-protected',
        'Remove the password protection or use a different file'
      );
    }

    // Check for corrupted PDF
    if (message.toLowerCase().includes('invalid') || 
        message.toLowerCase().includes('corrupt') ||
        message.toLowerCase().includes('parse')) {
      throw new CliError(
        ErrorCodes.UNSUPPORTED_FILE_TYPE,
        'Corrupted PDF',
        'The PDF file appears to be corrupted or invalid',
        'Try a different file or repair the PDF'
      );
    }

    throw new CliError(
      ErrorCodes.API_ERROR,
      'PDF rendering failed',
      message,
      'Check that the PDF file is valid'
    );
  }
}

/**
 * Converts inches to pixels at a given DPI.
 * PDF coordinates are typically in inches.
 * @param inches - Value in inches
 * @param dpi - Dots per inch
 * @returns Value in pixels
 */
export function convertInchesToPixels(inches: number, dpi: number = 150): number {
  return inches * dpi;
}
