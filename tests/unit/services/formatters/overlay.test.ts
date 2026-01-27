/**
 * Unit tests for overlay formatter.
 */

import { describe, it, expect } from 'vitest';
import {
  extractBoundingBoxes,
  getColorForType,
  createSvgOverlay,
  getOverlaySummary,
} from '../../../../src/services/formatters/overlay.js';
import type { AnalysisResult, BoundingBox } from '../../../../src/models/analysis-result.js';

describe('Overlay Formatter', () => {
  // Sample analysis result for testing
  const createMockResult = (boxes: BoundingBox[] = []): AnalysisResult => ({
    id: 'test-op-id',
    status: 'succeeded',
    analyzerId: 'prebuilt-document',
    apiVersion: '2025-11-01',
    createdAt: new Date('2026-01-22T10:00:00Z'),
    warnings: [],
    contents: [
      {
        kind: 'document',
        mimeType: 'application/pdf',
        fields: {
          Title: {
            type: 'string',
            valueString: 'Test Document',
            confidence: 0.95,
            boundingRegions: boxes.length > 0 ? [boxes[0]!] : undefined,
          },
          Amount: {
            type: 'number',
            valueNumber: 1234.56,
            confidence: 0.88,
            boundingRegions: boxes.length > 1 ? [boxes[1]!] : undefined,
          },
        },
      },
    ],
  });

  describe('extractBoundingBoxes', () => {
    it('should_return_empty_array_when_no_boxes', () => {
      const result = createMockResult();
      const boxes = extractBoundingBoxes(result);
      expect(boxes).toHaveLength(0);
    });

    it('should_extract_boxes_from_fields', () => {
      const mockBoxes: BoundingBox[] = [
        { pageNumber: 1, polygon: [10, 10, 100, 10, 100, 50, 10, 50] },
        { pageNumber: 1, polygon: [10, 60, 100, 60, 100, 100, 10, 100] },
      ];
      const result = createMockResult(mockBoxes);
      const boxes = extractBoundingBoxes(result);

      expect(boxes).toHaveLength(2);
      expect(boxes[0]?.label).toBe('Title');
      expect(boxes[0]?.type).toBe('string');
      expect(boxes[1]?.label).toBe('Amount');
      expect(boxes[1]?.type).toBe('number');
    });

    it('should_filter_boxes_by_page_number', () => {
      const mockBoxes: BoundingBox[] = [
        { pageNumber: 1, polygon: [10, 10, 100, 10, 100, 50, 10, 50] },
        { pageNumber: 2, polygon: [10, 60, 100, 60, 100, 100, 10, 100] },
      ];
      const result = createMockResult(mockBoxes);

      const page1Boxes = extractBoundingBoxes(result, 1);
      expect(page1Boxes).toHaveLength(1);
      expect(page1Boxes[0]?.box.pageNumber).toBe(1);

      const page2Boxes = extractBoundingBoxes(result, 2);
      expect(page2Boxes).toHaveLength(1);
      expect(page2Boxes[0]?.box.pageNumber).toBe(2);
    });

    it('should_extract_boxes_from_tables', () => {
      const result: AnalysisResult = {
        id: 'test-op-id',
        status: 'succeeded',
        analyzerId: 'prebuilt-document',
        apiVersion: '2025-11-01',
        createdAt: new Date(),
        warnings: [],
        contents: [
          {
            kind: 'document',
            mimeType: 'application/pdf',
            fields: {},
            tables: [
              {
                rowCount: 2,
                columnCount: 3,
                cells: [],
                boundingRegions: [
                  { pageNumber: 1, polygon: [0, 0, 200, 0, 200, 100, 0, 100] },
                ],
              },
            ],
          },
        ],
      };

      const boxes = extractBoundingBoxes(result);
      expect(boxes).toHaveLength(1);
      expect(boxes[0]?.label).toBe('Table 1');
    });

    it('should_extract_boxes_from_figures', () => {
      const result: AnalysisResult = {
        id: 'test-op-id',
        status: 'succeeded',
        analyzerId: 'prebuilt-document',
        apiVersion: '2025-11-01',
        createdAt: new Date(),
        warnings: [],
        contents: [
          {
            kind: 'document',
            mimeType: 'application/pdf',
            fields: {},
            figures: [
              {
                id: 'fig-1',
                caption: 'Company Logo',
                boundingRegions: [
                  { pageNumber: 1, polygon: [50, 50, 150, 50, 150, 150, 50, 150] },
                ],
              },
            ],
          },
        ],
      };

      const boxes = extractBoundingBoxes(result);
      expect(boxes).toHaveLength(1);
      expect(boxes[0]?.label).toBe('Company Logo');
    });
  });

  describe('getColorForType', () => {
    it('should_return_green_for_string_type', () => {
      expect(getColorForType('string')).toBe('#4CAF50');
    });

    it('should_return_blue_for_number_type', () => {
      expect(getColorForType('number')).toBe('#2196F3');
    });

    it('should_return_orange_for_date_type', () => {
      expect(getColorForType('date')).toBe('#FF9800');
    });

    it('should_return_default_color_for_unknown_type', () => {
      expect(getColorForType('unknown')).toBe('#F44336');
    });
  });

  describe('createSvgOverlay', () => {
    it('should_create_valid_svg', () => {
      const boxes = [
        {
          box: { pageNumber: 1, polygon: [10, 10, 100, 10, 100, 50, 10, 50] },
          label: 'Test',
          type: 'string',
        },
      ];
      const svg = createSvgOverlay(200, 200, boxes);

      expect(svg).toContain('<svg');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('width="200"');
      expect(svg).toContain('height="200"');
      expect(svg).toContain('<polygon');
      expect(svg).toContain('Test');
    });

    it('should_create_empty_svg_when_no_boxes', () => {
      const svg = createSvgOverlay(200, 200, []);

      expect(svg).toContain('<svg');
      expect(svg).not.toContain('<polygon');
    });

    it('should_hide_labels_when_disabled', () => {
      const boxes = [
        {
          box: { pageNumber: 1, polygon: [10, 10, 100, 10, 100, 50, 10, 50] },
          label: 'Test',
          type: 'string',
        },
      ];
      const svg = createSvgOverlay(200, 200, boxes, { showLabels: false });

      expect(svg).toContain('<polygon');
      expect(svg).not.toContain('<text');
    });

    it('should_use_custom_line_width', () => {
      const boxes = [
        {
          box: { pageNumber: 1, polygon: [10, 10, 100, 10, 100, 50, 10, 50] },
          label: 'Test',
          type: 'string',
        },
      ];
      const svg = createSvgOverlay(200, 200, boxes, { lineWidth: 5 });

      expect(svg).toContain('stroke-width="5"');
    });

    it('should_escape_xml_characters_in_labels', () => {
      const boxes = [
        {
          box: { pageNumber: 1, polygon: [10, 10, 100, 10, 100, 50, 10, 50] },
          label: '<script>alert("XSS")</script>',
          type: 'string',
        },
      ];
      const svg = createSvgOverlay(200, 200, boxes);

      expect(svg).not.toContain('<script>');
      expect(svg).toContain('&lt;script&gt;');
    });
  });

  describe('getOverlaySummary', () => {
    it('should_return_no_boxes_message_when_empty', () => {
      const result = createMockResult();
      const summary = getOverlaySummary(result);

      expect(summary).toContain('No bounding boxes');
    });

    it('should_return_box_count_and_types', () => {
      const mockBoxes: BoundingBox[] = [
        { pageNumber: 1, polygon: [10, 10, 100, 10, 100, 50, 10, 50] },
        { pageNumber: 1, polygon: [10, 60, 100, 60, 100, 100, 10, 100] },
      ];
      const result = createMockResult(mockBoxes);
      const summary = getOverlaySummary(result);

      expect(summary).toContain('Found 2 bounding box(es)');
      expect(summary).toContain('string: 1');
      expect(summary).toContain('number: 1');
    });

    it('should_filter_by_page_number', () => {
      const mockBoxes: BoundingBox[] = [
        { pageNumber: 1, polygon: [10, 10, 100, 10, 100, 50, 10, 50] },
        { pageNumber: 2, polygon: [10, 60, 100, 60, 100, 100, 10, 100] },
      ];
      const result = createMockResult(mockBoxes);
      const summary = getOverlaySummary(result, 1);

      expect(summary).toContain('Found 1 bounding box(es)');
    });
  });
});
