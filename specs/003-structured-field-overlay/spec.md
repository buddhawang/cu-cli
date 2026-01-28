# Feature Specification: Structured Field Overlay Rendering

**Feature Branch**: `003-structured-field-overlay`  
**Created**: 2026-01-28  
**Status**: Draft  
**Input**: User description: "Enhance overlay render to support structured fields (array, object, enum) with full field paths like items[1].amount or recipient.address.postalCode"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visualize Nested Object Fields (Priority: P1)

As a user analyzing invoices or complex documents, I want to see bounding boxes for nested object fields (e.g., `recipient.address.postalCode`) so that I can verify the extraction accuracy of deeply nested data.

**Why this priority**: Nested objects are the most common structured type in business documents. Without support for nested paths, users cannot verify extraction of critical data like addresses, line items, or contact information.

**Independent Test**: Can be tested by analyzing a document with nested object fields and verifying that each nested field displays with its full path label.

**Acceptance Scenarios**:

1. **Given** an analysis result with object field `recipient` containing nested fields `name`, `address.street`, `address.city`, `address.postalCode`, **When** rendering overlay, **Then** each nested field is rendered with its full path label (e.g., "recipient.address.postalCode")
2. **Given** nested fields with varying confidence levels, **When** rendering overlay, **Then** each field uses its type-appropriate color and shows its full path
3. **Given** an object field with no bounding region but nested children have regions, **When** rendering overlay, **Then** only the children with bounding regions are rendered

---

### User Story 2 - Visualize Array Element Fields (Priority: P1)

As a user analyzing documents with line items or lists, I want to see bounding boxes for each array element with indexed paths (e.g., `items[0].description`, `items[1].amount`) so that I can verify the extraction of tabular or repeated data.

**Why this priority**: Arrays represent repeated data like invoice line items, which are critical for business document processing. Users need to distinguish between different array elements.

**Independent Test**: Can be tested by analyzing an invoice with multiple line items and verifying each item field shows with its array index in the label.

**Acceptance Scenarios**:

1. **Given** an analysis result with array field `items` containing 3 elements, each with `description`, `quantity`, `amount`, **When** rendering overlay, **Then** each element field is rendered with indexed path (e.g., "items[0].description", "items[1].quantity")
2. **Given** an empty array field, **When** rendering overlay, **Then** no bounding boxes are rendered for that field
3. **Given** array elements at different positions on the document, **When** rendering overlay, **Then** each element's bounding boxes are correctly positioned regardless of document order

---

### User Story 3 - Distinguish Field Types by Color (Priority: P2)

As a user reviewing extracted data, I want different structured field types (array, object, string, number, date, etc.) to be visually distinguished by color so that I can quickly identify the data type of each extracted field.

**Why this priority**: Visual differentiation speeds up document review and helps users identify type mismatches in extraction.

**Independent Test**: Can be tested by analyzing a document with mixed field types and verifying each type displays in its designated color.

**Acceptance Scenarios**:

1. **Given** an analysis result with fields of types string, number, date, array, object, **When** rendering overlay, **Then** each field type displays in its designated color (string=green, number=blue, date=orange, array=cyan, object=brown)
2. **Given** a nested field within an array, **When** rendering overlay, **Then** the field's color reflects the leaf field type, not the parent array type

---

### User Story 4 - Filter Overlay by Field Path Pattern (Priority: P3)

As a user analyzing large documents with many fields, I want to filter the overlay to show only fields matching a specific path pattern so that I can focus on relevant extractions.

**Why this priority**: Large documents can have dozens of fields, making the overlay cluttered. Path filtering enables focused review.

**Independent Test**: Can be tested by providing a path filter and verifying only matching fields are rendered.

**Acceptance Scenarios**:

1. **Given** a path filter pattern "items[*].amount", **When** rendering overlay, **Then** only fields matching that pattern (e.g., items[0].amount, items[1].amount) are rendered
2. **Given** a path filter pattern "recipient.*", **When** rendering overlay, **Then** only fields under recipient (including nested paths like recipient.address.city) are rendered
3. **Given** no path filter, **When** rendering overlay, **Then** all fields are rendered (default behavior)

---

### User Story 5 - Visualize Multi-Content Classification Results (Priority: P2)

As a user analyzing documents with classification (splitting/categorization), I want to see each content segment's classification results and fields on the overlay, with clear visual separation between different document segments.

**Why this priority**: Classification analyzers split documents into multiple content segments (e.g., splitting a multi-invoice PDF into individual invoices). Users need to see which pages/regions belong to each classified segment.

**Independent Test**: Can be tested by analyzing a multi-document PDF with a classifier and verifying each content segment is labeled with its classification and page range.

**Acceptance Scenarios**:

1. **Given** an analysis result with multiple contents (e.g., `contents[0]` covering pages 1-2 as "Invoice", `contents[1]` covering pages 3-4 as "Receipt"), **When** rendering overlay, **Then** each content's fields are labeled with their content index prefix (e.g., "contents[0].vendorName", "contents[1].total")
2. **Given** a classified content with `kind` and page range (`startPageNumber`, `endPageNumber`), **When** rendering overlay for a specific page, **Then** only fields from contents covering that page are rendered
3. **Given** multiple contents with overlapping page ranges, **When** rendering overlay, **Then** all applicable fields from all overlapping contents are rendered with distinguishing prefixes

---

### Edge Cases

- What happens when a field has no bounding region but its children do? → Render only the children with regions
- How does system handle deeply nested objects (e.g., 5+ levels deep)? → Support unlimited nesting depth with full path rendering
- What happens when array contains mixed types? → Render each element with its actual type color
- How are null/undefined values in arrays handled? → Skip elements without bounding regions
- What happens when the path label is very long? → Truncate display label with ellipsis while maintaining full path in tooltip/metadata
- What happens when result.contents has multiple items? → Each content is treated as a separate document/segment with indexed prefix
- How are classification results displayed when content.kind is present? → Show content kind as part of label or legend

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST recursively traverse object fields and render bounding boxes for all nested fields with valid bounding regions
- **FR-002**: System MUST generate full field paths using dot notation for object nesting (e.g., `parent.child.grandchild`)
- **FR-003**: System MUST generate full field paths using bracket notation for array indexing (e.g., `items[0]`, `items[1].amount`)
- **FR-004**: System MUST render each field's bounding box using its type-specific color from the existing color palette
- **FR-005**: System MUST display the full field path as the label for each bounding box when `showLabels` option is enabled
- **FR-006**: System MUST handle empty arrays gracefully by not rendering any bounding boxes for them
- **FR-007**: System MUST skip fields (at any nesting level) that have no bounding region data
- **FR-008**: System MUST support unlimited nesting depth for object hierarchies
- **FR-009**: System SHOULD truncate long path labels in the visual display while preserving readability
- **FR-010**: System MAY support path filtering to render only fields matching a given pattern
- **FR-011**: System MUST treat each item in `result.contents` as a distinct document/content segment
- **FR-012**: System MUST prefix field paths with content index when multiple contents exist (e.g., `contents[0].vendorName`, `contents[1].items[0].amount`)
- **FR-013**: System MUST respect each content's page range (`startPageNumber`, `endPageNumber`) when filtering fields for page-specific rendering
- **FR-014**: System MUST display the content `kind` (classification type) when available, either in labels or as a legend
- **FR-015**: System MUST handle single-content results without content index prefix (backward compatible with existing behavior)

### Key Entities

- **FieldPath**: A string representing the full path to a field (e.g., `recipient.address.postalCode`, `items[0].amount`)
- **StructuredField**: An ExtractedField with `valueObject` or `valueArray` containing nested fields
- **LeafField**: A terminal field with a primitive type (string, number, date, etc.) that has bounding regions
- **ContentSegment**: A single item in `result.contents` representing a classified document segment with `kind`, page range, and fields

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify the source location of any nested field within 5 seconds by reading its full path label on the overlay
- **SC-002**: 100% of fields with bounding regions are rendered, including those nested within objects and arrays
- **SC-003**: Field path labels correctly reflect the data hierarchy as visible in the raw JSON output
- **SC-004**: Overlay rendering completes in under 2 seconds for documents with up to 100 extracted fields
- **SC-005**: Users can visually distinguish between different field types using the color-coded bounding boxes
- **SC-006**: Users can identify which classified content segment a field belongs to when multiple contents exist

## Assumptions

- The existing color palette is sufficient for distinguishing field types; no new colors are needed for enum types (will use default or string color)
- Bounding region coordinates in nested fields use the same coordinate system as top-level fields
- Array indices are 0-based in path notation (matching JSON/JavaScript conventions)
- The `source` field grounding format is consistent across all nesting levels
- When only one content exists in `result.contents`, the content index prefix is omitted for cleaner labels
- Each content's `kind` field contains the classification category (e.g., "document", "invoice", "receipt")
- Content page ranges (`startPageNumber`, `endPageNumber`) are 1-indexed and inclusive
