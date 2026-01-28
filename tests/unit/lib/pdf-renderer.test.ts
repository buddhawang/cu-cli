/**
 * Unit tests for PDF renderer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convertInchesToPixels } from '../../../src/lib/pdf-renderer.js';

// Mock the pdf-to-png-converter module
vi.mock('pdf-to-png-converter', () => ({
  pdfToPng: vi.fn(),
}));

describe('PDF Renderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('convertInchesToPixels', () => {
    it('should_convert_inches_to_pixels_at_default_dpi', () => {
      // Default DPI is 150
      expect(convertInchesToPixels(1)).toBe(150);
      expect(convertInchesToPixels(0.5)).toBe(75);
      expect(convertInchesToPixels(8.5)).toBe(1275);
    });

    it('should_convert_inches_to_pixels_at_custom_dpi', () => {
      expect(convertInchesToPixels(1, 72)).toBe(72);
      expect(convertInchesToPixels(1, 300)).toBe(300);
      expect(convertInchesToPixels(8.5, 72)).toBe(612);
    });

    it('should_handle_zero', () => {
      expect(convertInchesToPixels(0, 150)).toBe(0);
      expect(convertInchesToPixels(0, 72)).toBe(0);
    });

    it('should_handle_fractional_values', () => {
      expect(convertInchesToPixels(0.25, 100)).toBe(25);
      expect(convertInchesToPixels(1.5, 100)).toBe(150);
      expect(convertInchesToPixels(2.75, 200)).toBe(550);
    });
  });

  // Note: Integration tests for actual PDF rendering are in tests/integration/pdf-overlay.test.ts
  // These tests would require actual PDF files and the optional dependency
});
