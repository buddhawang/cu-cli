# Azure Content Understanding API Key Authentication Research

**Date**: 2026-01-27  
**Feature**: [spec.md](../spec.md)

This document details the API key authentication pattern for Azure Content Understanding, based on official Azure documentation and API specifications.

---

## Executive Summary

**Decision: Use `Ocp-Apim-Subscription-Key` header for API key authentication**

Azure Content Understanding (API version `2025-11-01`) supports **both** API key and Azure AD (Bearer token) authentication. API keys offer a simpler authentication path without requiring interactive login, making them ideal for CI/CD pipelines, scripts, and automated workflows.

---

## 1. Header Name for API Key Authentication

### Standard Azure Cognitive Services Header

| Header | Usage |
|--------|-------|
| **`Ocp-Apim-Subscription-Key`** | Primary header for API key authentication across all Azure Cognitive Services |
| `Ocp-Apim-Subscription-Region` | Only required for multi-service (Foundry) resources with certain APIs like Translator |

### Content Understanding API Example

```bash
# Analyze a document with API key
curl -i -X POST "{endpoint}/contentunderstanding/analyzers/prebuilt-invoice:analyze?api-version=2025-11-01" \
  -H "Ocp-Apim-Subscription-Key: {key}" \
  -H "Content-Type: application/json" \
  -d '{
        "inputs":[{"url": "https://example.com/document.pdf"}]
      }'

# Get analysis result with API key
curl -i -X GET "{endpoint}/contentunderstanding/analyzerResults/{request-id}?api-version=2025-11-01" \
  -H "Ocp-Apim-Subscription-Key: {key}"
```

### Azure OpenAI Comparison

Note: Azure OpenAI uses a different header name `api-key` (not `Ocp-Apim-Subscription-Key`). However, **Content Understanding uses the standard Cognitive Services pattern**:

| Service | API Key Header |
|---------|---------------|
| Azure Content Understanding | `Ocp-Apim-Subscription-Key` |
| Azure OpenAI | `api-key` |
| Other Cognitive Services (Vision, Speech, etc.) | `Ocp-Apim-Subscription-Key` |

---

## 2. Azure Content Understanding Specifics (2025-11-01)

### Supported Authentication Methods

| Method | Header | Format | Notes |
|--------|--------|--------|-------|
| **API Key** | `Ocp-Apim-Subscription-Key` | `{key}` | Simpler, no token refresh needed |
| **Azure AD (Bearer)** | `Authorization` | `Bearer {token}` | Recommended for production, supports RBAC |

### Both Methods Work for All Endpoints

Based on the official REST API quickstart documentation, API key authentication works for all Content Understanding endpoints:

- `POST /analyzers/{analyzerId}:analyze` - Submit analysis
- `POST /analyzers/{analyzerId}:analyzeBinary` - Submit binary analysis
- `GET /analyzerResults/{operationId}` - Get results
- `GET /analyzers` - List analyzers
- `GET /analyzers/{analyzerId}` - Get analyzer details
- `GET /defaults` - Get model deployments
- `PATCH /defaults` - Update model deployments

### Custom Subdomain Requirement

For **Azure AD authentication**, a custom subdomain is required. For API key authentication, regional endpoints work fine:

```
# API Key - works with regional endpoint
https://eastus.api.cognitive.microsoft.com/contentunderstanding/...

# API Key - also works with custom subdomain
https://my-resource.cognitiveservices.azure.com/contentunderstanding/...

# Azure AD - REQUIRES custom subdomain
https://my-resource.cognitiveservices.azure.com/contentunderstanding/...
```

---

## 3. API Key vs Bearer Token Interchangeability

### When to Use Each

| Scenario | Recommended Method | Reason |
|----------|-------------------|--------|
| CI/CD pipelines | API Key | No interactive login, simpler setup |
| Automated scripts | API Key | No token expiration concerns |
| User-facing CLI | Bearer Token | Supports user identity, RBAC |
| Service-to-service | Bearer Token (managed identity) | No secrets management |
| Quick testing | API Key | Faster setup |

### Key Differences

| Aspect | API Key | Bearer Token |
|--------|---------|--------------|
| **Token Refresh** | Not needed | Expires (typically 1 hour) |
| **Setup Complexity** | Simple (copy from portal) | Requires OAuth flow |
| **RBAC Support** | No (full access with key) | Yes (fine-grained permissions) |
| **Audit Trail** | Limited | Full user identity tracking |
| **Revocation** | Regenerate keys | Revoke user/app access |
| **Multi-tenancy** | Not supported | Supported |

### Priority Order in CLI

When both are configured, the CLI should use this priority:
1. Command-line `--api-key` option (if supported)
2. Profile's API key configuration
3. Cached Azure AD token (from `cu login`)
4. Interactive login (if no valid auth)

---

## 4. Error Responses

### Authentication Errors

#### Invalid or Missing API Key

**HTTP Status: 401 Unauthorized**

```json
{
  "error": {
    "code": "Unauthorized",
    "message": "Access denied due to invalid subscription key. Make sure to provide a valid key for an active subscription."
  }
}
```

#### Expired or Revoked API Key

**HTTP Status: 401 Unauthorized**

```json
{
  "error": {
    "code": "Unauthorized",
    "message": "The subscription key is not valid or has been revoked."
  }
}
```

#### Wrong Resource/Endpoint

**HTTP Status: 401 Unauthorized**

```json
{
  "error": {
    "code": "Unauthorized",
    "message": "The subscription key is not valid for this resource."
  }
}
```

#### API Key for Wrong Region

**HTTP Status: 401 Unauthorized**

```json
{
  "error": {
    "code": "Unauthorized", 
    "message": "Invalid region for the subscription key."
  }
}
```

### Authorization Errors (RBAC - Bearer Token Only)

**HTTP Status: 403 Forbidden**

```json
{
  "error": {
    "code": "Forbidden",
    "message": "The user does not have permission to perform this action."
  }
}
```

### Rate Limiting

**HTTP Status: 429 Too Many Requests**

```json
{
  "error": {
    "code": "RateLimitExceeded",
    "message": "Rate limit exceeded. Retry after 30 seconds."
  }
}
```

Headers:
- `Retry-After: 30` (seconds to wait)

### Error Handling in CLI

```typescript
// Suggested error handling for auth failures
function handleAuthError(status: number, error: ApiError): never {
  switch (status) {
    case 401:
      if (isApiKeyAuth) {
        throw new CliError(
          'Invalid API key. Verify the key in Azure portal or run "cu config set --api-key <key>"',
          ErrorCodes.AUTH_INVALID_KEY
        );
      } else {
        throw new CliError(
          'Authentication failed. Run "cu login" to authenticate.',
          ErrorCodes.AUTH_TOKEN_EXPIRED
        );
      }
    case 403:
      throw new CliError(
        'Access denied. Ensure you have the required role (Cognitive Services User).',
        ErrorCodes.AUTH_FORBIDDEN
      );
    case 429:
      // Handle rate limiting with retry
      break;
  }
}
```

---

## 5. Security Considerations for CLI Config

### Best Practices for API Key Storage

| Practice | Implementation | Risk Level |
|----------|----------------|------------|
| **Never store in plain text** | Use OS credential store | High if ignored |
| **Don't commit to source control** | Use `.gitignore` for config | High if ignored |
| **Encrypt at rest** | DPAPI (Windows), Keychain (macOS) | Medium |
| **Restrict file permissions** | 600 on Unix, user-only on Windows | Medium |
| **Support key rotation** | Easy update via CLI | Low |

### Recommended Storage Locations

| OS | Location | Protection |
|----|----------|------------|
| Windows | `%LOCALAPPDATA%\cu-cli\credentials` with DPAPI | Encrypted with user login |
| macOS | Keychain via `@azure/msal-node-extensions` | Encrypted, requires user auth |
| Linux | libsecret (GNOME Keyring/KWallet) | Depends on DE, may require unlock |
| Fallback | `~/.cu/config.json` with `600` permissions | File permissions only |

### CLI Config File Structure

```json
// ~/.cu/config.json (fallback, not recommended for API keys)
{
  "profiles": {
    "default": {
      "endpoint": "https://my-resource.cognitiveservices.azure.com",
      "defaultAnalyzer": "prebuilt-document"
      // API key should NOT be stored here
    }
  },
  "activeProfile": "default"
}
```

```typescript
// API key stored separately via keytar or msal-node-extensions
interface SecureStorage {
  setApiKey(profile: string, apiKey: string): Promise<void>;
  getApiKey(profile: string): Promise<string | null>;
  deleteApiKey(profile: string): Promise<void>;
}
```

### Security Warnings in CLI

Display warnings when:
1. API key is passed via command line (visible in shell history)
2. Config file has insecure permissions (non-Windows)
3. Using plaintext fallback storage

```typescript
// Example warning for command-line API key
if (options.apiKey) {
  console.warn(
    chalk.yellow('Warning: API key passed via command line may be stored in shell history.')
  );
  console.warn(
    chalk.yellow('Consider using "cu config set --api-key" for secure storage.')
  );
}
```

---

## 6. Implementation Recommendations

### HTTP Client Updates

```typescript
// src/services/content-understanding.ts
interface AuthConfig {
  type: 'api-key' | 'bearer';
  value: string;
}

function getAuthHeaders(auth: AuthConfig): Record<string, string> {
  if (auth.type === 'api-key') {
    return {
      'Ocp-Apim-Subscription-Key': auth.value,
    };
  } else {
    return {
      'Authorization': `Bearer ${auth.value}`,
    };
  }
}
```

### Config Command Updates

```bash
# Set API key for current profile
cu config set --api-key <key>

# Remove API key (revert to Azure AD)
cu config unset api-key

# Show current auth method (without revealing key)
cu config show
# Output:
# endpoint: https://my-resource.cognitiveservices.azure.com
# authentication: API Key (configured)
# defaultAnalyzer: prebuilt-document
```

### Auth Priority Logic

```typescript
async function getAuthConfig(): Promise<AuthConfig> {
  // 1. Check for API key in current profile
  const apiKey = await secureStorage.getApiKey(activeProfile);
  if (apiKey) {
    return { type: 'api-key', value: apiKey };
  }
  
  // 2. Check for cached Azure AD token
  const token = await authService.getAccessToken();
  if (token) {
    return { type: 'bearer', value: token };
  }
  
  // 3. No valid auth - throw error
  throw new CliError(
    'Not authenticated. Run "cu login" or "cu config set --api-key <key>"',
    ErrorCodes.AUTH_REQUIRED
  );
}
```

---

## 7. References

- [Azure Cognitive Services Authentication](https://learn.microsoft.com/en-us/azure/ai-services/authentication)
- [Content Understanding REST API Quickstart](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/quickstart/use-rest-api)
- [Content Understanding Overview](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/overview)
- [Azure OpenAI Reference](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference) (different header for comparison)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-27 | Initial research document |
