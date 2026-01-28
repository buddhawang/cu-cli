# Contract: Overlay Formatter Functions

**Feature**: 003-structured-field-overlay  
**Date**: 2026-01-28  
**Type**: Internal API (TypeScript module functions)

## Overview

This contract defines the public functions in `src/services/formatters/overlay.ts` that are affected by the structured field overlay feature.

---

## Function: extractBoundingBoxes (Modified)

Extracts all bounding boxes from an analysis result, now with recursive field traversal.

### Signature

```typescript
export function extractBoundingBoxes(
  result: AnalysisResult,
  pageNumber?: number
): Array<{ box: BoundingBox; label: string; type: string }>
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| result | AnalysisResult | Yes | The analysis result containing contents and fields |
| pageNumber | number | No | Optional page filter (1-indexed) |

### Returns

Array of objects containing:

| Field | Type | Description |
|-------|------|-------------|
| box | BoundingBox | The bounding region |
| label | string | Full field path (e.g., "items[0].amount") |
| type | string | Field type for color mapping |

### Behavior Changes

| Scenario | Previous Behavior | New Behavior |
|----------|------------------|--------------|
| Nested object field | Not rendered | Rendered with dot-notation path |
| Array element field | Not rendered | Rendered with bracket-notation path |
| Multi-content result | All fields without prefix | Prefix with `contents[i].` when >1 content |
| Single-content result | Fields without prefix | No change (backward compatible) |

### Examples

**Input**: Analysis result with nested fields
```json
{
  "contents": [{
    "fields": {
      "recipient": {
        "type": "object",
        "valueObject": {
          "name": { "type": "string", "boundingRegions": [...] },
          "address": {
            "type": "object",
            "valueObject": {
              "city": { "type": "string", "boundingRegions": [...] }
            }
          }
        }
      }
    }
  }]
}
```

**Output**:
```typescript
[
  { box: {...}, label: "recipient.name", type: "string" },
  { box: {...}, label: "recipient.address.city", type: "string" }
]
```

**Input**: Multi-content classification result
```json
{
  "contents": [
    { "kind": "invoice", "fields": { "total": { "type": "number", ... } } },
    { "kind": "receipt", "fields": { "total": { "type": "number", ... } } }
  ]
}
```

**Output**:
```typescript
[
  { box: {...}, label: "contents[0].total", type: "number" },
  { box: {...}, label: "contents[1].total", type: "number" }
]
```

---

## Function: extractFieldsRecursively (New)

Generator function for recursive field traversal.

### Signature

```typescript
export function* extractFieldsRecursively(
  fields: Record<string, ExtractedField>,
  parentPath?: string,
  pageNumber?: number
): Generator<{ box: BoundingBox; label: string; type: string }>
```

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| fields | Record<string, ExtractedField> | Yes | Fields to traverse |
| parentPath | string | No | Path prefix for nested fields |
| pageNumber | number | No | Optional page filter |

### Yields

Objects with `box`, `label`, and `type` for each field with bounding regions.

### Traversal Order

1. Depth-first traversal
2. Object fields before array elements
3. Array elements in index order (0, 1, 2, ...)

---

## Function: truncateLabel (New)

Truncates long path labels for display.

### Signature

```typescript
export function truncateLabel(path: string, maxLength?: number): string
```

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| path | string | Yes | - | Full field path |
| maxLength | number | No | 30 | Maximum label length |

### Returns

Truncated path with `...` prefix if needed.

### Examples

| Input | Output |
|-------|--------|
| `"recipient.name"` | `"recipient.name"` |
| `"contents[0].items[2].description"` | `"...items[2].description"` |
| `"a.b.c.d.e.f.g.h.i.j.k"` | `"...g.h.i.j.k"` |

---

## Function: renderOverlay (Unchanged Signature)

Renders overlay on an image. No signature changes; behavior updated via extractBoundingBoxes.

### Signature

```typescript
export async function renderOverlay(
  imagePath: string,
  result: AnalysisResult,
  options?: OverlayOptions
): Promise<OverlayResult>
```

---

## Function: createSvgOverlay (Unchanged Signature)

Creates SVG overlay. No signature changes; receives updated box labels from extractBoundingBoxes.

### Signature

```typescript
export function createSvgOverlay(
  width: number,
  height: number,
  boxes: Array<{ box: BoundingBox; label: string; type: string }>,
  options?: OverlayOptions
): string
```

---

## Interface: OverlayOptions (Extended)

### New Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| pathFilter | string | undefined | Glob pattern to filter fields (P3 feature) |
| maxLabelLength | number | 30 | Maximum label length before truncation |
| showContentKind | boolean | true | Show content kind in legend (multi-content) |

---

## Backward Compatibility

| Aspect | Guarantee |
|--------|-----------|
| Function signatures | All existing signatures unchanged |
| Single-content output | Labels unchanged (no prefix) |
| Existing options | All existing options work as before |
| Color mapping | Unchanged |
| SVG structure | Compatible with existing consumers |
