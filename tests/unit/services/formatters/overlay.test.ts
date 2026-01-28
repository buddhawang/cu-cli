/**
 * Unit tests for overlay formatter.
 */

import { describe, it, expect } from 'vitest';
import {
  extractBoundingBoxes,
  getColorForType,
  createSvgOverlay,
  getOverlaySummary,
  convertInchesToPixels,
  extractFieldsRecursively,
  truncateLabel,
  matchPathPattern,
} from '../../../../src/services/formatters/overlay.js';
import type { AnalysisResult, BoundingBox, ExtractedField } from '../../../../src/models/analysis-result.js';

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
            ...(boxes.length > 0 && { boundingRegions: [boxes[0]!] }),
          },
          Amount: {
            type: 'number',
            valueNumber: 1234.56,
            confidence: 0.88,
            ...(boxes.length > 1 && { boundingRegions: [boxes[1]!] }),
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

    it('should_filter_boxes_by_path_pattern', () => {
      const result: AnalysisResult = {
        id: 'test-op-id',
        status: 'succeeded',
        analyzerId: 'prebuilt-invoice',
        apiVersion: '2025-11-01',
        createdAt: new Date(),
        warnings: [],
        contents: [
          {
            kind: 'document',
            mimeType: 'application/pdf',
            fields: {
              vendorName: {
                type: 'string',
                valueString: 'Acme Corp',
                confidence: 0.95,
                boundingRegions: [{ pageNumber: 1, polygon: [10, 10, 100, 10, 100, 30, 10, 30] }],
              },
              items: {
                type: 'array',
                valueArray: [
                  {
                    type: 'object',
                    valueObject: {
                      description: {
                        type: 'string',
                        valueString: 'Widget',
                        confidence: 0.9,
                        boundingRegions: [{ pageNumber: 1, polygon: [10, 50, 100, 50, 100, 70, 10, 70] }],
                      },
                      amount: {
                        type: 'number',
                        valueNumber: 100,
                        confidence: 0.85,
                        boundingRegions: [{ pageNumber: 1, polygon: [110, 50, 150, 50, 150, 70, 110, 70] }],
                      },
                    },
                  },
                  {
                    type: 'object',
                    valueObject: {
                      description: {
                        type: 'string',
                        valueString: 'Gadget',
                        confidence: 0.88,
                        boundingRegions: [{ pageNumber: 1, polygon: [10, 80, 100, 80, 100, 100, 10, 100] }],
                      },
                      amount: {
                        type: 'number',
                        valueNumber: 200,
                        confidence: 0.87,
                        boundingRegions: [{ pageNumber: 1, polygon: [110, 80, 150, 80, 150, 100, 110, 100] }],
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      };

      // Filter for only amounts
      const amountBoxes = extractBoundingBoxes(result, undefined, 'items[*].amount');
      expect(amountBoxes).toHaveLength(2);
      expect(amountBoxes.map(b => b.label)).toEqual(['items[0].amount', 'items[1].amount']);

      // Filter for only first item
      const firstItemBoxes = extractBoundingBoxes(result, undefined, 'items[0].*');
      expect(firstItemBoxes).toHaveLength(2);
      expect(firstItemBoxes[0]?.label).toBe('items[0].description');
      expect(firstItemBoxes[1]?.label).toBe('items[0].amount');

      // Filter for vendor only
      const vendorBoxes = extractBoundingBoxes(result, undefined, 'vendorName');
      expect(vendorBoxes).toHaveLength(1);
      expect(vendorBoxes[0]?.label).toBe('vendorName');
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

  describe('convertInchesToPixels', () => {
    it('should_convert_inches_to_pixels_at_default_dpi', () => {
      // Default DPI is 150
      expect(convertInchesToPixels(1)).toBe(150);
      expect(convertInchesToPixels(0.5)).toBe(75);
      expect(convertInchesToPixels(8.5)).toBe(1275); // Standard letter width
    });

    it('should_convert_inches_to_pixels_at_custom_dpi', () => {
      expect(convertInchesToPixels(1, 72)).toBe(72);  // PDF default DPI
      expect(convertInchesToPixels(1, 300)).toBe(300); // High resolution
      expect(convertInchesToPixels(8.5, 72)).toBe(612); // Letter width at 72 DPI
    });

    it('should_handle_fractional_inches', () => {
      expect(convertInchesToPixels(0.25, 100)).toBe(25);
      expect(convertInchesToPixels(1.5, 100)).toBe(150);
    });

    it('should_handle_zero', () => {
      expect(convertInchesToPixels(0, 150)).toBe(0);
    });
  });
});

// Helper to create a bounding box for structured field tests
function createTestBox(pageNumber: number = 1): BoundingBox {
  return {
    pageNumber,
    polygon: [0, 0, 100, 0, 100, 50, 0, 50],
  };
}

// Helper to create an extracted field for structured field tests
function createTestField(
  type: string,
  options: {
    boundingRegions?: BoundingBox[];
    valueObject?: Record<string, ExtractedField>;
    valueArray?: ExtractedField[];
    source?: string;
  } = {}
): ExtractedField {
  return {
    type: type as ExtractedField['type'],
    ...options,
  };
}

describe('truncateLabel', () => {
  it('should_return_short_paths_unchanged', () => {
    expect(truncateLabel('vendorName')).toBe('vendorName');
    expect(truncateLabel('recipient.name')).toBe('recipient.name');
    expect(truncateLabel('items[0].amount')).toBe('items[0].amount');
  });

  it('should_truncate_long_paths_with_ellipsis', () => {
    const longPath = 'contents[0].items[2].productDetails.description';
    const result = truncateLabel(longPath, 30);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result.startsWith('...')).toBe(true);
  });

  it('should_preserve_the_last_segment', () => {
    const result = truncateLabel('very.long.nested.object.field.name', 20);
    expect(result).toContain('.name');
    expect(result.startsWith('...')).toBe(true);
  });

  it('should_handle_array_notation_in_last_segment', () => {
    const result = truncateLabel('contents[0].lineItems[5].amount', 25);
    expect(result.startsWith('...')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(25);
  });

  it('should_use_custom_maxLength', () => {
    const path = 'a.b.c.d.e.f.g';
    const result = truncateLabel(path, 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it('should_handle_edge_case_of_very_short_maxLength', () => {
    const result = truncateLabel('recipient.address.city', 8);
    expect(result.length).toBeLessThanOrEqual(8);
    expect(result.startsWith('...')).toBe(true);
  });
});

describe('matchPathPattern', () => {
  describe('exact matching', () => {
    it('should_match_exact_simple_path', () => {
      expect(matchPathPattern('vendorName', 'vendorName')).toBe(true);
      expect(matchPathPattern('vendorName', 'otherName')).toBe(false);
    });

    it('should_match_exact_nested_path', () => {
      expect(matchPathPattern('recipient.address.city', 'recipient.address.city')).toBe(true);
      expect(matchPathPattern('recipient.address.city', 'recipient.address.state')).toBe(false);
    });

    it('should_match_exact_array_path', () => {
      expect(matchPathPattern('items[0].amount', 'items[0].amount')).toBe(true);
      expect(matchPathPattern('items[0].amount', 'items[1].amount')).toBe(false);
    });
  });

  describe('array wildcard [*]', () => {
    it('should_match_any_array_index', () => {
      expect(matchPathPattern('items[0].amount', 'items[*].amount')).toBe(true);
      expect(matchPathPattern('items[5].amount', 'items[*].amount')).toBe(true);
      expect(matchPathPattern('items[99].amount', 'items[*].amount')).toBe(true);
    });

    it('should_match_multiple_array_wildcards', () => {
      expect(matchPathPattern('contents[0].items[2].amount', 'contents[*].items[*].amount')).toBe(true);
      expect(matchPathPattern('contents[1].items[0].amount', 'contents[*].items[*].amount')).toBe(true);
    });

    it('should_not_match_different_field_names', () => {
      expect(matchPathPattern('items[0].total', 'items[*].amount')).toBe(false);
    });
  });

  describe('wildcard *', () => {
    it('should_match_prefix_pattern', () => {
      expect(matchPathPattern('recipient.address.city', 'recipient.*')).toBe(true);
      expect(matchPathPattern('recipient.address.postalCode', 'recipient.*')).toBe(true);
      expect(matchPathPattern('vendor.name', 'recipient.*')).toBe(false);
    });

    it('should_match_suffix_pattern', () => {
      expect(matchPathPattern('items[0].amount', '*.amount')).toBe(true);
      expect(matchPathPattern('lineItems[2].amount', '*.amount')).toBe(true);
      expect(matchPathPattern('items[0].quantity', '*.amount')).toBe(false);
    });

    it('should_match_contains_pattern', () => {
      expect(matchPathPattern('order.items[0].price', '*items*')).toBe(true);
      expect(matchPathPattern('lineItems[0].amount', '*Items*')).toBe(true);
      expect(matchPathPattern('vendor.name', '*items*')).toBe(false);
    });
  });

  describe('combined patterns', () => {
    it('should_match_complex_patterns', () => {
      expect(matchPathPattern('contents[0].items[3].amount', 'contents[*].items[*].*')).toBe(true);
      expect(matchPathPattern('contents[2].items[0].quantity', 'contents[*].items[*].*')).toBe(true);
    });

    it('should_not_match_when_structure_differs', () => {
      expect(matchPathPattern('items[0].amount', 'contents[*].items[*].amount')).toBe(false);
    });
  });
});

describe('extractFieldsRecursively', () => {
  it('should_extract_simple_top_level_fields', () => {
    const fields: Record<string, ExtractedField> = {
      vendorName: createTestField('string', { boundingRegions: [createTestBox()] }),
      total: createTestField('number', { boundingRegions: [createTestBox()] }),
    };

    const results = [...extractFieldsRecursively(fields)];

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      box: createTestBox(),
      label: 'vendorName',
      type: 'string',
    });
    expect(results[1]).toEqual({
      box: createTestBox(),
      label: 'total',
      type: 'number',
    });
  });

  it('should_extract_nested_object_fields_with_dot_notation', () => {
    const fields: Record<string, ExtractedField> = {
      recipient: createTestField('object', {
        valueObject: {
          name: createTestField('string', { boundingRegions: [createTestBox()] }),
          address: createTestField('object', {
            valueObject: {
              city: createTestField('string', { boundingRegions: [createTestBox()] }),
              postalCode: createTestField('string', { boundingRegions: [createTestBox()] }),
            },
          }),
        },
      }),
    };

    const results = [...extractFieldsRecursively(fields)];

    expect(results).toHaveLength(3);
    expect(results.map(r => r.label)).toEqual([
      'recipient.name',
      'recipient.address.city',
      'recipient.address.postalCode',
    ]);
  });

  it('should_extract_array_elements_with_bracket_notation', () => {
    const fields: Record<string, ExtractedField> = {
      items: createTestField('array', {
        valueArray: [
          createTestField('object', {
            valueObject: {
              description: createTestField('string', { boundingRegions: [createTestBox()] }),
              amount: createTestField('number', { boundingRegions: [createTestBox()] }),
            },
          }),
          createTestField('object', {
            valueObject: {
              description: createTestField('string', { boundingRegions: [createTestBox()] }),
              amount: createTestField('number', { boundingRegions: [createTestBox()] }),
            },
          }),
        ],
      }),
    };

    const results = [...extractFieldsRecursively(fields)];

    expect(results).toHaveLength(4);
    expect(results.map(r => r.label)).toEqual([
      'items[0].description',
      'items[0].amount',
      'items[1].description',
      'items[1].amount',
    ]);
  });

  it('should_skip_fields_without_bounding_regions', () => {
    const fields: Record<string, ExtractedField> = {
      hasBox: createTestField('string', { boundingRegions: [createTestBox()] }),
      noBox: createTestField('string', {}),
      alsoNoBox: createTestField('number', { valueObject: {} }),
    };

    const results = [...extractFieldsRecursively(fields)];

    expect(results).toHaveLength(1);
    expect(results[0]?.label).toBe('hasBox');
  });

  it('should_handle_empty_arrays_gracefully', () => {
    const fields: Record<string, ExtractedField> = {
      emptyItems: createTestField('array', { valueArray: [] }),
      vendorName: createTestField('string', { boundingRegions: [createTestBox()] }),
    };

    const results = [...extractFieldsRecursively(fields)];

    expect(results).toHaveLength(1);
    expect(results[0]?.label).toBe('vendorName');
  });

  it('should_filter_by_page_number', () => {
    const fields: Record<string, ExtractedField> = {
      page1Field: createTestField('string', { boundingRegions: [createTestBox(1)] }),
      page2Field: createTestField('string', { boundingRegions: [createTestBox(2)] }),
      page3Field: createTestField('string', { boundingRegions: [createTestBox(3)] }),
    };

    const page2Results = [...extractFieldsRecursively(fields, '', 2)];

    expect(page2Results).toHaveLength(1);
    expect(page2Results[0]?.label).toBe('page2Field');
  });

  it('should_use_parent_path_prefix_correctly', () => {
    const fields: Record<string, ExtractedField> = {
      city: createTestField('string', { boundingRegions: [createTestBox()] }),
    };

    const results = [...extractFieldsRecursively(fields, 'recipient.address')];

    expect(results).toHaveLength(1);
    expect(results[0]?.label).toBe('recipient.address.city');
  });

  it('should_handle_deeply_nested_structures', () => {
    const fields: Record<string, ExtractedField> = {
      level1: createTestField('object', {
        valueObject: {
          level2: createTestField('object', {
            valueObject: {
              level3: createTestField('object', {
                valueObject: {
                  level4: createTestField('object', {
                    valueObject: {
                      deepValue: createTestField('string', { boundingRegions: [createTestBox()] }),
                    },
                  }),
                },
              }),
            },
          }),
        },
      }),
    };

    const results = [...extractFieldsRecursively(fields)];

    expect(results).toHaveLength(1);
    expect(results[0]?.label).toBe('level1.level2.level3.level4.deepValue');
  });

  it('should_extract_array_element_with_bounding_region', () => {
    const fields: Record<string, ExtractedField> = {
      items: createTestField('array', {
        valueArray: [
          createTestField('string', { boundingRegions: [createTestBox()] }),
          createTestField('string', { boundingRegions: [createTestBox()] }),
        ],
      }),
    };

    const results = [...extractFieldsRecursively(fields)];

    expect(results).toHaveLength(2);
    expect(results.map(r => r.label)).toEqual(['items[0]', 'items[1]']);
  });

  it('should_preserve_field_types_through_recursion', () => {
    const fields: Record<string, ExtractedField> = {
      data: createTestField('object', {
        valueObject: {
          count: createTestField('number', { boundingRegions: [createTestBox()] }),
          name: createTestField('string', { boundingRegions: [createTestBox()] }),
          date: createTestField('date', { boundingRegions: [createTestBox()] }),
        },
      }),
    };

    const results = [...extractFieldsRecursively(fields)];

    expect(results).toHaveLength(3);
    expect(results.find(r => r.label === 'data.count')?.type).toBe('number');
    expect(results.find(r => r.label === 'data.name')?.type).toBe('string');
    expect(results.find(r => r.label === 'data.date')?.type).toBe('date');
  });
});

// Contract tests for structured field overlay feature (FR-001 to FR-015)
describe('Structured Field Overlay Contract', () => {
  // Helper to create analysis result with structured fields
  function createStructuredResult(): AnalysisResult {
    return {
      id: 'test-op-id',
      status: 'succeeded',
      analyzerId: 'prebuilt-invoice',
      apiVersion: '2025-11-01',
      createdAt: new Date(),
      warnings: [],
      contents: [
        {
          kind: 'document',
          mimeType: 'application/pdf',
          fields: {
            vendorName: createTestField('string', { boundingRegions: [createTestBox(1)] }),
            recipient: createTestField('object', {
              valueObject: {
                name: createTestField('string', { boundingRegions: [createTestBox(1)] }),
                address: createTestField('object', {
                  valueObject: {
                    street: createTestField('string', { boundingRegions: [createTestBox(1)] }),
                    city: createTestField('string', { boundingRegions: [createTestBox(1)] }),
                    postalCode: createTestField('string', { boundingRegions: [createTestBox(1)] }),
                  },
                }),
              },
            }),
            items: createTestField('array', {
              valueArray: [
                createTestField('object', {
                  valueObject: {
                    description: createTestField('string', { boundingRegions: [createTestBox(1)] }),
                    quantity: createTestField('number', { boundingRegions: [createTestBox(1)] }),
                    amount: createTestField('number', { boundingRegions: [createTestBox(1)] }),
                  },
                }),
                createTestField('object', {
                  valueObject: {
                    description: createTestField('string', { boundingRegions: [createTestBox(1)] }),
                    quantity: createTestField('number', { boundingRegions: [createTestBox(1)] }),
                    amount: createTestField('number', { boundingRegions: [createTestBox(1)] }),
                  },
                }),
              ],
            }),
          },
        },
      ],
    };
  }

  describe('[US1] Nested Object Fields', () => {
    it('should_render_nested_objects_with_dot_notation_paths', () => {
      const result = createStructuredResult();
      const boxes = extractBoundingBoxes(result);

      // Check that nested object fields have full paths
      const labels = boxes.map(b => b.label);
      expect(labels).toContain('recipient.name');
      expect(labels).toContain('recipient.address.street');
      expect(labels).toContain('recipient.address.city');
      expect(labels).toContain('recipient.address.postalCode');
    });

    it('should_skip_object_field_without_bounding_region', () => {
      const result = createStructuredResult();
      const boxes = extractBoundingBoxes(result);

      // The parent object fields (recipient, recipient.address) should not be in results
      // Only leaf fields with bounding regions should appear
      const labels = boxes.map(b => b.label);
      expect(labels).not.toContain('recipient');
      expect(labels).not.toContain('recipient.address');
    });
  });

  describe('[US2] Array Element Fields', () => {
    it('should_render_array_elements_with_bracket_notation_paths', () => {
      const result = createStructuredResult();
      const boxes = extractBoundingBoxes(result);

      const labels = boxes.map(b => b.label);
      expect(labels).toContain('items[0].description');
      expect(labels).toContain('items[0].quantity');
      expect(labels).toContain('items[0].amount');
      expect(labels).toContain('items[1].description');
      expect(labels).toContain('items[1].quantity');
      expect(labels).toContain('items[1].amount');
    });

    it('should_handle_empty_arrays', () => {
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
            fields: {
              emptyItems: createTestField('array', { valueArray: [] }),
              vendorName: createTestField('string', { boundingRegions: [createTestBox(1)] }),
            },
          },
        ],
      };

      const boxes = extractBoundingBoxes(result);
      expect(boxes).toHaveLength(1);
      expect(boxes[0]?.label).toBe('vendorName');
    });
  });

  describe('[US3] Field Type Colors', () => {
    it('should_use_leaf_field_type_not_parent_type', () => {
      const result = createStructuredResult();
      const boxes = extractBoundingBoxes(result);

      // Check that nested fields use their actual types
      const quantityBox = boxes.find(b => b.label === 'items[0].quantity');
      expect(quantityBox?.type).toBe('number');

      const descriptionBox = boxes.find(b => b.label === 'items[0].description');
      expect(descriptionBox?.type).toBe('string');

      const nameBox = boxes.find(b => b.label === 'recipient.name');
      expect(nameBox?.type).toBe('string');
    });
  });

  describe('[US5] Multi-Content Classification', () => {
    it('should_prefix_fields_with_content_index_when_multiple_contents', () => {
      const result: AnalysisResult = {
        id: 'test-op-id',
        status: 'succeeded',
        analyzerId: 'document-classifier',
        apiVersion: '2025-11-01',
        createdAt: new Date(),
        warnings: [],
        contents: [
          {
            kind: 'document',
            mimeType: 'application/pdf',
            startPageNumber: 1,
            endPageNumber: 2,
            fields: {
              vendorName: createTestField('string', { boundingRegions: [createTestBox(1)] }),
              total: createTestField('number', { boundingRegions: [createTestBox(2)] }),
            },
          },
          {
            kind: 'document',
            mimeType: 'application/pdf',
            startPageNumber: 3,
            endPageNumber: 3,
            fields: {
              merchantName: createTestField('string', { boundingRegions: [createTestBox(3)] }),
              total: createTestField('number', { boundingRegions: [createTestBox(3)] }),
            },
          },
        ],
      };

      const boxes = extractBoundingBoxes(result);
      const labels = boxes.map(b => b.label);

      expect(labels).toContain('contents[0].vendorName');
      expect(labels).toContain('contents[0].total');
      expect(labels).toContain('contents[1].merchantName');
      expect(labels).toContain('contents[1].total');
    });

    it('should_not_prefix_fields_when_single_content', () => {
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
            fields: {
              vendorName: createTestField('string', { boundingRegions: [createTestBox(1)] }),
            },
          },
        ],
      };

      const boxes = extractBoundingBoxes(result);
      expect(boxes[0]?.label).toBe('vendorName');
      expect(boxes[0]?.label).not.toContain('contents[');
    });

    it('should_filter_by_page_range_when_multi_content', () => {
      const result: AnalysisResult = {
        id: 'test-op-id',
        status: 'succeeded',
        analyzerId: 'document-classifier',
        apiVersion: '2025-11-01',
        createdAt: new Date(),
        warnings: [],
        contents: [
          {
            kind: 'document',
            mimeType: 'application/pdf',
            startPageNumber: 1,
            endPageNumber: 2,
            fields: {
              vendorName: createTestField('string', { boundingRegions: [createTestBox(1)] }),
            },
          },
          {
            kind: 'document',
            mimeType: 'application/pdf',
            startPageNumber: 3,
            endPageNumber: 3,
            fields: {
              merchantName: createTestField('string', { boundingRegions: [createTestBox(3)] }),
            },
          },
        ],
      };

      // Request page 1 - should only get invoice fields
      const page1Boxes = extractBoundingBoxes(result, 1);
      expect(page1Boxes).toHaveLength(1);
      expect(page1Boxes[0]?.label).toBe('contents[0].vendorName');

      // Request page 3 - should only get receipt fields
      const page3Boxes = extractBoundingBoxes(result, 3);
      expect(page3Boxes).toHaveLength(1);
      expect(page3Boxes[0]?.label).toBe('contents[1].merchantName');
    });
  });
});
