# Research: Structured Field Overlay Rendering

**Feature**: 003-structured-field-overlay  
**Date**: 2026-01-28  
**Status**: Complete

## Research Tasks

Since no NEEDS CLARIFICATION markers exist in the Technical Context, research focused on:
1. Best practices for recursive field traversal in TypeScript
2. Path notation conventions for nested data
3. SVG label rendering optimization for long paths

---

## 1. Recursive Field Traversal Patterns

**Task**: Determine the best approach for recursively traversing `ExtractedField` objects with `valueObject` and `valueArray` properties.

### Decision: Generator Function with Path Accumulation

**Rationale**: Using a generator function (`function*`) provides memory-efficient traversal for deeply nested structures, yields results lazily, and allows early termination if a filter is applied.

**Implementation Pattern**:
```typescript
function* extractFieldsRecursively(
  fields: Record<string, ExtractedField>,
  parentPath: string = '',
  pageNumber?: number
): Generator<{ box: BoundingBox; label: string; type: string }> {
  for (const [name, field] of Object.entries(fields)) {
    const currentPath = parentPath ? `${parentPath}.${name}` : name;
    
    // Yield bounding boxes at current level
    if (field.boundingRegions) {
      for (const region of field.boundingRegions) {
        if (pageNumber === undefined || region.pageNumber === pageNumber) {
          yield { box: region, label: currentPath, type: field.type };
        }
      }
    }
    
    // Recurse into nested objects
    if (field.valueObject) {
      yield* extractFieldsRecursively(field.valueObject, currentPath, pageNumber);
    }
    
    // Recurse into array elements
    if (field.valueArray) {
      for (let i = 0; i < field.valueArray.length; i++) {
        const element = field.valueArray[i];
        const elementPath = `${currentPath}[${i}]`;
        // ... handle element
      }
    }
  }
}
```

**Alternatives Considered**:
- **Recursive function returning array**: Simpler but allocates all results upfront; memory inefficient for large documents
- **Stack-based iteration**: More complex, no significant benefit for expected nesting depths (<10 levels)

---

## 2. Path Notation Conventions

**Task**: Define the path notation format for nested fields and array elements.

### Decision: JSON Path-like Notation

**Format**:
- Object nesting: Dot notation (e.g., `recipient.address.city`)
- Array indexing: Bracket notation with 0-based index (e.g., `items[0].amount`)
- Multi-content: Indexed prefix when >1 content (e.g., `contents[0].vendorName`)

**Rationale**: 
- Matches JavaScript/TypeScript property access syntax
- Familiar to developers working with JSON
- Consistent with JSON Path standard (RFC 9535)
- 0-based indexing aligns with raw JSON output

**Examples**:
| JSON Structure | Generated Path |
|---------------|----------------|
| `{ recipient: { name: "..." } }` | `recipient.name` |
| `{ items: [{ amount: 100 }] }` | `items[0].amount` |
| `{ address: { street: { line1: "..." } } }` | `address.street.line1` |
| Multi-content: content 0, field "total" | `contents[0].total` |

**Alternatives Considered**:
- **Slash notation** (`recipient/address/city`): Less familiar, conflicts with file paths
- **1-based indexing**: Inconsistent with JavaScript conventions and raw JSON

---

## 3. SVG Label Rendering for Long Paths

**Task**: Handle long path labels that may exceed bounding box width.

### Decision: Truncate with Ellipsis, Show Last Segment

**Strategy**:
- If path length > 30 characters, truncate from the left
- Preserve the field name (last segment) for identification
- Format: `...parent.fieldName` or `...[2].fieldName`

**Implementation**:
```typescript
function truncateLabel(path: string, maxLength: number = 30): string {
  if (path.length <= maxLength) return path;
  
  // Find last segment (after last dot or bracket)
  const lastDot = path.lastIndexOf('.');
  const lastBracket = path.lastIndexOf('[');
  const lastSep = Math.max(lastDot, lastBracket);
  
  if (lastSep > 0) {
    const suffix = path.slice(lastSep);
    const available = maxLength - suffix.length - 3; // 3 for "..."
    if (available > 0) {
      return '...' + suffix;
    }
  }
  
  return '...' + path.slice(-maxLength + 3);
}
```

**Rationale**: Users primarily need to identify which field is highlighted; the last segment is most informative. Full path is preserved in the data structure for programmatic access.

**Alternatives Considered**:
- **No truncation**: Labels overlap and become unreadable
- **Middle truncation**: Harder to implement, less intuitive reading
- **Tooltip-only**: SVG doesn't support native tooltips; would require JavaScript

---

## 4. Multi-Content Handling

**Task**: Determine how to handle `result.contents` with multiple items.

### Decision: Conditional Content Index Prefix

**Rules**:
1. If `result.contents.length === 1`: No prefix (backward compatible)
2. If `result.contents.length > 1`: Prefix with `contents[i].`
3. Include `kind` in legend or as visual grouping cue

**Implementation**:
```typescript
for (let contentIndex = 0; contentIndex < (result.contents ?? []).length; contentIndex++) {
  const content = result.contents![contentIndex];
  const prefix = result.contents!.length > 1 ? `contents[${contentIndex}].` : '';
  
  // Check page range
  if (pageNumber !== undefined) {
    const start = content.startPageNumber ?? 1;
    const end = content.endPageNumber ?? start;
    if (pageNumber < start || pageNumber > end) continue;
  }
  
  // Extract fields with prefix
  for (const { box, label, type } of extractFieldsRecursively(content.fields, prefix)) {
    // ...
  }
}
```

**Rationale**: Single-content is the common case; prefixing would add noise. Multi-content needs disambiguation.

---

## 5. Performance Considerations

**Task**: Ensure overlay rendering stays within performance budget (<2 seconds for 100 fields).

### Findings

| Operation | Estimated Time | Notes |
|-----------|---------------|-------|
| Field traversal (100 fields, 5 depth) | <10ms | Generator avoids memory allocation |
| SVG generation | <50ms | String concatenation, no DOM |
| Sharp composite | 500-1500ms | Dominant factor; already optimized |
| Total | <1600ms | Within 2-second budget |

**Optimizations Applied**:
- Generator-based traversal (memory efficient)
- Single-pass SVG generation (no intermediate structures)
- No additional sharp operations (reuse existing composite)

**No additional optimization needed** for expected workloads.

---

## Summary

| Topic | Decision | Confidence |
|-------|----------|------------|
| Traversal pattern | Generator function with path accumulation | High |
| Path notation | Dot for objects, brackets for arrays (0-indexed) | High |
| Label truncation | Ellipsis prefix, preserve last segment | High |
| Multi-content | Conditional `contents[i].` prefix | High |
| Performance | Within budget, no changes needed | High |

All research tasks complete. Ready for Phase 1 design artifacts.
