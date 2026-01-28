# Quickstart: Structured Field Overlay Rendering

**Feature**: 003-structured-field-overlay  
**Date**: 2026-01-28

## Overview

This feature enhances the `cu analyze` command's overlay output to display structured fields (nested objects and arrays) with full path labels like `items[0].amount` or `recipient.address.postalCode`.

---

## Usage

### Basic Overlay with Structured Fields

```bash
# Analyze an invoice and generate overlay showing all fields including nested
cu analyze invoice.pdf --format overlay --output invoice-overlay.png
```

The overlay will now show:
- Top-level fields: `vendorName`, `invoiceDate`
- Nested object fields: `recipient.name`, `recipient.address.city`
- Array element fields: `items[0].description`, `items[0].amount`, `items[1].description`

### Multi-Content Classification Results

When analyzing documents that are split/classified into multiple segments:

```bash
# Analyze a multi-document PDF
cu analyze multi-doc.pdf --analyzer classifier-v1 --format overlay --output result.png
```

Fields will be prefixed with content index:
- `contents[0].vendorName` (first document segment)
- `contents[1].customerName` (second document segment)

---

## Visual Guide

### Field Path Labels

| Scenario | Label Format |
|----------|--------------|
| Simple field | `vendorName` |
| Nested object | `recipient.address.city` |
| Array element | `items[0].amount` |
| Deep nesting | `...address.postalCode` (truncated) |
| Multi-content | `contents[0].vendorName` |

### Color Legend

| Type | Color | Example |
|------|-------|---------|
| String | Green | `vendorName` |
| Number | Blue | `items[0].amount` |
| Date | Orange | `invoiceDate` |
| Time | Purple | `processingTime` |
| Boolean | Pink | `isPaid` |

### Long Path Truncation

Paths longer than 30 characters are truncated:
- Full path: `contents[0].lineItems[5].productDetails.manufacturer`
- Display: `...productDetails.manufacturer`

---

## Examples

### Example 1: Invoice Analysis

**Command**:
```bash
cu analyze samples/invoice.pdf --format overlay --output overlay.png
```

**Output Labels**:
```
vendorName
invoiceNumber
invoiceDate
recipient.name
recipient.address.street
recipient.address.city
recipient.address.postalCode
items[0].description
items[0].quantity
items[0].unitPrice
items[0].amount
items[1].description
items[1].quantity
items[1].unitPrice
items[1].amount
subtotal
tax
total
```

### Example 2: Multi-Document Classification

**Command**:
```bash
cu analyze samples/batch.pdf --analyzer document-splitter --format overlay --output pages/
```

**Output Labels** (when 2 documents detected):
```
contents[0].documentType    # "Invoice"
contents[0].vendorName
contents[0].total
contents[1].documentType    # "Receipt"  
contents[1].merchantName
contents[1].total
```

---

## Backward Compatibility

- Single-content results: No change to label format
- Existing overlay options (`--line-width`, `--show-labels`, `--page`): Still work
- Color scheme: Unchanged
- SVG output format: Compatible with existing tools

---

## Troubleshooting

### Labels Overlapping

Long document with many fields may have overlapping labels. Use:
```bash
cu analyze doc.pdf --format overlay --page 1 --output page1.png
```
to render one page at a time.

### Missing Nested Fields

If nested fields are not appearing:
1. Verify the analyzer extracts structured fields (check JSON output first)
2. Ensure nested fields have `boundingRegions` or `source` grounding

```bash
# Check raw JSON to verify structure
cu analyze doc.pdf --format json | jq '.contents[0].fields'
```

### Performance

For documents with 100+ fields, overlay rendering may take 1-2 seconds. This is within the expected performance budget.
