# CLI Command Reference

**Date**: 2026-01-22  
**Feature**: [spec.md](../spec.md)

This document defines the CLI command contracts—input arguments, options, output formats, and exit codes.

---

## Global Options

Available on all commands:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--json` | flag | false | Output in JSON format |
| `--profile <name>` | string | active profile | Use specific configuration profile |
| `--verbose` | flag | false | Enable verbose output |
| `--help` | flag | - | Show command help |
| `--version` | flag | - | Show CLI version |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Authentication required |
| 2 | Configuration missing or invalid |
| 3 | Network/connection error |
| 4 | API error (client error, 4xx) |
| 5 | API error (server error, 5xx) |
| 6 | File not found |
| 7 | Invalid argument |
| 130 | Interrupted (Ctrl+C) |

---

## Authentication Commands

### `cu login`

Authenticate with Azure AD using browser-based sign-in.

```
cu login [options]
```

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `--tenant <id>` | string | Azure AD tenant ID (default: common) |
| `--device-code` | flag | Use device code flow (for headless environments) |

**Output (table):**
```
✔ Logged in as user@example.com
  Tenant: contoso.onmicrosoft.com (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
```

**Output (JSON):**
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "homeAccountId": "..."
}
```

**Exit Codes:** 0 (success), 1 (auth failed), 3 (network error)

---

### `cu logout`

Clear cached credentials.

```
cu logout
```

**Output:**
```
✔ Logged out successfully
```

**Exit Codes:** 0 (success)

---

### `cu whoami`

Display current authenticated identity.

```
cu whoami [options]
```

**Output (table):**
```
Email:    user@example.com
Name:     User Name
Tenant:   xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Expires:  2026-01-22 15:30:00
```

**Output (JSON):**
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "expiresAt": "2026-01-22T15:30:00.000Z"
}
```

**Exit Codes:** 0 (success), 1 (not authenticated)

---

## Configuration Commands

### `cu config set`

Set configuration values.

```
cu config set --endpoint <url> [options]
```

**Options:**
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `--endpoint <url>` | string | ✓ | Azure CU resource endpoint |
| `--profile <name>` | string | | Profile name (default: "default") |
| `--subscription <id>` | string | | Azure subscription ID |
| `--resource-group <name>` | string | | Resource group name |
| `--resource-name <name>` | string | | Resource name |

**Output:**
```
✔ Configuration saved to profile 'default'
  Endpoint: https://my-resource.cognitiveservices.azure.com
```

**Exit Codes:** 0 (success), 7 (invalid URL)

---

### `cu config show`

Display current configuration.

```
cu config show [options]
```

**Output (table):**
```
Profile: default (active)

  Endpoint:       https://my-resource.cognitiveservices.azure.com
  Subscription:   xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  Resource Group: my-rg
  Resource Name:  my-resource
```

**Output (JSON):**
```json
{
  "activeProfile": "default",
  "profile": {
    "endpoint": "https://my-resource.cognitiveservices.azure.com",
    "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "resourceGroup": "my-rg",
    "resourceName": "my-resource"
  }
}
```

**Exit Codes:** 0 (success), 2 (no configuration)

---

### `cu config list`

List all configuration profiles.

```
cu config list [options]
```

**Output (table):**
```
PROFILE     ENDPOINT                                           ACTIVE
default     https://my-resource.cognitiveservices.azure.com    ✓
staging     https://staging.cognitiveservices.azure.com        
production  https://prod.cognitiveservices.azure.com           
```

**Output (JSON):**
```json
{
  "activeProfile": "default",
  "profiles": [
    {
      "name": "default",
      "endpoint": "https://my-resource.cognitiveservices.azure.com",
      "isActive": true
    },
    {
      "name": "staging",
      "endpoint": "https://staging.cognitiveservices.azure.com",
      "isActive": false
    }
  ]
}
```

**Exit Codes:** 0 (success)

---

### `cu config use`

Switch active configuration profile.

```
cu config use <profile-name>
```

**Arguments:**
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `profile-name` | string | ✓ | Profile to activate |

**Output:**
```
✔ Switched to profile 'staging'
```

**Exit Codes:** 0 (success), 2 (profile not found)

---

## Analyzer Commands

### `cu analyzer list`

List all analyzers in the configured resource.

```
cu analyzer list [options]
```

**Output (table):**
```
ID                      STATUS    DESCRIPTION                    CREATED
prebuilt-document       ready     General document processing    2025-01-01
prebuilt-invoice        ready     Invoice extraction             2025-01-01
my-custom-analyzer      ready     Custom contract analyzer       2026-01-20
```

**Output (JSON):**
```json
{
  "analyzers": [
    {
      "id": "prebuilt-document",
      "status": "ready",
      "description": "General document processing",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "supportedContentKinds": ["document", "image"]
    }
  ]
}
```

**Exit Codes:** 0 (success), 1 (auth required), 2 (config missing), 4 (API error)

---

### `cu analyzer show`

Display details of a specific analyzer.

```
cu analyzer show <analyzer-id> [options]
```

**Arguments:**
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `analyzer-id` | string | ✓ | Analyzer identifier |

**Output (table):**
```
Analyzer: my-custom-analyzer

Status:       ready
Description:  Custom contract analyzer
Created:      2026-01-20 10:00:00
Modified:     2026-01-21 14:30:00
Base:         prebuilt-document

Supported Content Types:
  • document
  • image

Fields:
  NAME              TYPE      METHOD     DESCRIPTION
  ContractNumber    string    extract    Contract identifier
  EffectiveDate     date      extract    Contract start date
  TotalValue        number    extract    Total contract value
  Category          string    classify   Contract category
```

**Output (JSON):**
```json
{
  "id": "my-custom-analyzer",
  "status": "ready",
  "description": "Custom contract analyzer",
  "createdAt": "2026-01-20T10:00:00.000Z",
  "modifiedAt": "2026-01-21T14:30:00.000Z",
  "baseAnalyzerId": "prebuilt-document",
  "supportedContentKinds": ["document", "image"],
  "fieldSchema": {
    "name": "ContractFields",
    "fields": {
      "ContractNumber": { "type": "string", "method": "extract" },
      "EffectiveDate": { "type": "date", "method": "extract" },
      "TotalValue": { "type": "number", "method": "extract" },
      "Category": { "type": "string", "method": "classify", "enum": ["Services", "Products"] }
    }
  }
}
```

**Exit Codes:** 0 (success), 1 (auth required), 4 (analyzer not found)

---

## Analysis Commands

### `cu analyze`

Analyze a document using a specified analyzer.

```
cu analyze <source> --analyzer <id> [options]
```

**Arguments:**
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `source` | string | ✓ | File path or URL to document |

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--analyzer <id>` | string | ✓ | Analyzer to use |
| `--format <type>` | string | table | Output format: json, table, markdown, overlay |
| `--output <path>` | string | - | Write output to file |
| `--force` | flag | false | Overwrite existing output file |
| `--pages <range>` | string | all | Page range (e.g., "1-3,5,10-") |
| `--wait` | flag | true | Wait for analysis to complete |
| `--timeout <seconds>` | number | 300 | Timeout for analysis (seconds) |

**Output (table):**
```
Analyzing invoice.pdf with prebuilt-invoice...
████████████████████████████████████████ 100% Complete

Results:
  FIELD              VALUE                 CONFIDENCE
  VendorName         Contoso Ltd           0.95
  InvoiceNumber      INV-2026-001          0.98
  InvoiceDate        2026-01-15            0.97
  TotalAmount        $1,234.56             0.96
  
Pages analyzed: 2
Time: 3.2s
```

**Output (JSON):**
```json
{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "succeeded",
  "analyzerId": "prebuilt-invoice",
  "contents": [
    {
      "kind": "document",
      "mimeType": "application/pdf",
      "fields": {
        "VendorName": {
          "type": "string",
          "valueString": "Contoso Ltd",
          "confidence": 0.95
        },
        "InvoiceNumber": {
          "type": "string",
          "valueString": "INV-2026-001",
          "confidence": 0.98
        }
      }
    }
  ],
  "usage": {
    "documentPagesStandard": 2
  }
}
```

**Output (markdown):**
```markdown
# Analysis Results: invoice.pdf

**Analyzer**: prebuilt-invoice  
**Date**: 2026-01-22 10:30:00  
**Status**: Succeeded

## Extracted Fields

| Field | Value | Confidence |
|-------|-------|------------|
| VendorName | Contoso Ltd | 95% |
| InvoiceNumber | INV-2026-001 | 98% |
| InvoiceDate | 2026-01-15 | 97% |
| TotalAmount | $1,234.56 | 96% |

## Tables

### Table 1 (Page 1)

| Item | Quantity | Price |
|------|----------|-------|
| Widget A | 10 | $50.00 |
| Widget B | 5 | $100.00 |
```

**Output (overlay):** Writes PNG/PDF file with bounding boxes

**Exit Codes:** 0 (success), 1 (auth required), 6 (file not found), 4 (API error), 7 (unsupported format)

---

## Model Commands

### `cu model list`

List deployed custom models.

```
cu model list [options]
```

**Output (table):**
```
NAME            STATUS      CREATED              VERSION
my-model        succeeded   2026-01-20 10:00     1.0.0
test-model      running     2026-01-22 09:00     -
failed-model    failed      2026-01-21 15:00     -
```

**Output (JSON):**
```json
{
  "models": [
    {
      "name": "my-model",
      "status": "succeeded",
      "createdAt": "2026-01-20T10:00:00.000Z",
      "version": "1.0.0",
      "endpoint": "https://..."
    }
  ]
}
```

**Exit Codes:** 0 (success), 1 (auth required), 2 (config missing)

---

### `cu model show`

Display details of a deployed model.

```
cu model show <model-name> [options]
```

**Arguments:**
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `model-name` | string | ✓ | Model deployment name |

**Output (table):**
```
Model: my-model

Status:       succeeded
Version:      1.0.0
Created:      2026-01-20 10:00:00
Updated:      2026-01-20 10:15:00
Source:       azureml://...
Endpoint:     https://my-resource.cognitiveservices.azure.com/...
Description:  Custom invoice model for ACME Corp
```

**Output (JSON):** Full model object

**Exit Codes:** 0 (success), 1 (auth required), 4 (model not found)

---

### `cu model deploy`

Deploy a custom model.

```
cu model deploy --name <name> --source <location> [options]
```

**Options:**
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `--name <name>` | string | ✓ | Deployment name |
| `--source <location>` | string | ✓ | Model source (Azure ML model ID, etc.) |
| `--description <text>` | string | | Model description |
| `--wait` | flag | true | Wait for deployment to complete |

**Output:**
```
Deploying model 'my-model'...
████████████████████████████████████████ 100%

✔ Model deployed successfully
  Endpoint: https://my-resource.cognitiveservices.azure.com/...
```

**Exit Codes:** 0 (success), 1 (auth required), 4 (deployment failed), 7 (invalid name)

---

### `cu model delete`

Delete a deployed model.

```
cu model delete <model-name> [options]
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--force` | flag | false | Skip confirmation prompt |

**Output:**
```
Are you sure you want to delete model 'my-model'? [y/N] y
✔ Model 'my-model' deleted
```

**Exit Codes:** 0 (success), 1 (auth required), 4 (model not found)

---

## Error Output Format

All errors are written to stderr with actionable information:

```
Error: [CODE] Brief description

Why: Explanation of what caused the error

Fix: Suggested action to resolve
     $ cu <suggested-command>
```

**Example:**
```
Error: [AUTH_REQUIRED] Authentication required

Why: No cached credentials found or session expired

Fix: Sign in to Azure
     $ cu login
```
