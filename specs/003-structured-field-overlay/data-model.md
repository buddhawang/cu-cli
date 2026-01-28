# Data Model: Structured Field Overlay Rendering

**Feature**: 003-structured-field-overlay  
**Date**: 2026-01-28  
**Source**: [spec.md](spec.md), [research.md](research.md)

## Overview

This feature enhances the existing overlay rendering by adding support for structured fields (objects and arrays) with full path visualization. The data model leverages existing types with minimal extensions.

---

## Existing Entities (Unchanged)

### ExtractedField

Represents a field extracted from document analysis. Already supports nested structures.

| Attribute | Type | Description |
|-----------|------|-------------|
| type | FieldType | Field type (string, number, date, array, object, etc.) |
| valueString | string? | String value for primitive types |
| valueNumber | number? | Numeric value |
| valueBoolean | boolean? | Boolean value |
| valueArray | ExtractedField[]? | Array elements (for array type) |
| valueObject | Record<string, ExtractedField>? | Nested fields (for object type) |
| confidence | number? | Extraction confidence (0.0-1.0) |
| source | string? | Source grounding string |
| boundingRegions | BoundingBox[]? | Bounding regions for visualization |

### BoundingBox

Represents a region in the document.

| Attribute | Type | Description |
|-----------|------|-------------|
| pageNumber | number | Page number (1-indexed) |
| polygon | number[] | Polygon coordinates [x1,y1, x2,y2, ...] |

### AnalyzedContent

Represents a content segment from analysis (classification/splitting).

| Attribute | Type | Description |
|-----------|------|-------------|
| kind | ContentKind | Content type classification |
| mimeType | string | Source MIME type |
| startPageNumber | number? | Start page (1-indexed, inclusive) |
| endPageNumber | number? | End page (1-indexed, inclusive) |
| fields | Record<string, ExtractedField> | Extracted fields |

---

## New Entities

### FieldPathEntry

Represents a field with its full path, ready for overlay rendering.

| Attribute | Type | Description |
|-----------|------|-------------|
| box | BoundingBox | Bounding region for this field |
| label | string | Full path (e.g., "items[0].amount") |
| displayLabel | string | Truncated label for SVG display |
| type | string | Field type for color selection |
| contentIndex | number? | Content index (when multiple contents) |
| contentKind | string? | Content classification kind |

**State Transitions**: None (stateless value object)

**Validation Rules**:
- `label` must be non-empty
- `box.polygon` must have at least 4 coordinates (2 points)
- `type` must be a valid FieldType string

### OverlayFieldFilter (Optional - P3)

Filter configuration for selective field rendering.

| Attribute | Type | Description |
|-----------|------|-------------|
| pathPattern | string | Glob-like pattern (e.g., "items[*].amount") |
| contentIndex | number? | Limit to specific content index |
| fieldTypes | string[]? | Limit to specific field types |

---

## Relationships

```
AnalysisResult
└── contents: AnalyzedContent[]
    ├── kind: ContentKind
    ├── startPageNumber / endPageNumber
    └── fields: Record<string, ExtractedField>
        ├── valueObject: Record<string, ExtractedField> (recursive)
        └── valueArray: ExtractedField[] (recursive)
            └── boundingRegions: BoundingBox[]

extractFieldsRecursively() traverses this structure and yields:

FieldPathEntry[]
├── box: BoundingBox (from ExtractedField.boundingRegions)
├── label: string (generated path)
├── displayLabel: string (truncated)
├── type: string (from ExtractedField.type)
├── contentIndex?: number
└── contentKind?: string
```

---

## Path Generation Rules

### Object Nesting

```
Parent: "recipient"
Child: "address"
Grandchild: "postalCode"
→ Path: "recipient.address.postalCode"
```

### Array Indexing

```
Parent: "items"
Index: 0
Child: "amount"
→ Path: "items[0].amount"
```

### Multi-Content Prefix

```
When contents.length > 1:
  Content[0], Field "vendorName"
  → Path: "contents[0].vendorName"

When contents.length == 1:
  Field "vendorName"
  → Path: "vendorName" (no prefix)
```

---

## Color Mapping

Existing color palette (no changes):

| Field Type | Color | Hex |
|------------|-------|-----|
| string | Green | #4CAF50 |
| number | Blue | #2196F3 |
| date | Orange | #FF9800 |
| time | Purple | #9C27B0 |
| boolean | Pink | #E91E63 |
| array | Cyan | #00BCD4 |
| object | Brown | #795548 |
| default | Red | #F44336 |

**Note**: Leaf fields within arrays/objects use their own type color, not the parent's.

---

## Label Truncation

| Original Path | Truncated (max 30 chars) |
|--------------|--------------------------|
| `recipient.address.postalCode` | `recipient.address.postalCode` (28 chars, no truncation) |
| `contents[0].items[2].description` | `...items[2].description` |
| `very.deeply.nested.object.field.name` | `...object.field.name` |

Algorithm: Preserve last path segment, truncate from left with `...` prefix.
