# MSAL Node.js Token Refresh Patterns Research

> Research document for cu-cli authentication optimization  
> Date: January 27, 2026

## Executive Summary

MSAL Node.js handles most token refresh scenarios automatically through `acquireTokenSilent`. The current cu-cli implementation is **nearly optimal**, but there are opportunities to:
1. Avoid unnecessary network calls by inspecting token expiration before calling `acquireTokenSilent`
2. Use `forceRefresh` option strategically when proactive refresh is needed
3. Better detect and handle refresh token expiration scenarios

---

## 1. Token Cache Inspection (Without Network Calls)

### Problem
How to check if a cached token is about to expire (within 5 minutes) WITHOUT making a network call?

### Solution
MSAL's `acquireTokenSilent` returns a result with `fromCache: boolean` that indicates whether the token came from cache. However, to truly avoid network calls, you need to directly inspect the token cache.

### Approach 1: Direct Cache File Inspection (Zero Network Calls)

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface CachedAccessToken {
  home_account_id: string;
  environment: string;
  credential_type: string;
  client_id: string;
  secret: string;
  realm: string;
  target: string;
  cached_at: string;      // Unix timestamp (seconds)
  expires_on: string;     // Unix timestamp (seconds)
  extended_expires_on: string;
}

interface MsalCacheSchema {
  Account: Record<string, unknown>;
  IdToken: Record<string, unknown>;
  AccessToken: Record<string, CachedAccessToken>;
  RefreshToken: Record<string, { secret: string; /* other fields */ }>;
  AppMetadata: Record<string, unknown>;
}

/**
 * Inspects the MSAL cache file directly without any network calls.
 * Returns token expiration info without triggering MSAL's refresh logic.
 */
function inspectTokenCache(cacheFilePath: string): {
  hasValidToken: boolean;
  expiresOn: Date | null;
  isExpiringSoon: boolean; // within 5 minutes
  isExpired: boolean;
} {
  const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
  
  try {
    if (!fs.existsSync(cacheFilePath)) {
      return { hasValidToken: false, expiresOn: null, isExpiringSoon: true, isExpired: true };
    }
    
    const cacheData = fs.readFileSync(cacheFilePath, 'utf-8');
    const cache: MsalCacheSchema = JSON.parse(cacheData);
    
    // Find access tokens for our scopes
    const accessTokens = Object.values(cache.AccessToken || {});
    
    if (accessTokens.length === 0) {
      return { hasValidToken: false, expiresOn: null, isExpiringSoon: true, isExpired: true };
    }
    
    // Get the most recent access token
    const token = accessTokens[0];
    const expiresOnUnix = parseInt(token.expires_on, 10);
    const expiresOn = new Date(expiresOnUnix * 1000);
    const now = Date.now();
    
    const isExpired = now >= expiresOn.getTime();
    const isExpiringSoon = now >= (expiresOn.getTime() - EXPIRY_BUFFER_MS);
    
    return {
      hasValidToken: !isExpired,
      expiresOn,
      isExpiringSoon,
      isExpired,
    };
  } catch {
    return { hasValidToken: false, expiresOn: null, isExpiringSoon: true, isExpired: true };
  }
}

// Usage
const CACHE_FILE = path.join(os.homedir(), '.cu', 'msal-cache.json');
const tokenStatus = inspectTokenCache(CACHE_FILE);

if (!tokenStatus.isExpiringSoon) {
  console.log('Token is valid and not expiring soon - can skip network call');
} else if (!tokenStatus.isExpired) {
  console.log('Token expiring soon - should proactively refresh');
} else {
  console.log('Token expired - must refresh');
}
```

### Approach 2: Using MSAL's TokenCache API

```typescript
import { PublicClientApplication, type AccountInfo } from '@azure/msal-node';

/**
 * Get token expiration from MSAL cache without refresh.
 * Note: This still initializes MSAL but doesn't make network calls.
 */
async function getTokenExpirationFromCache(
  pca: PublicClientApplication,
  account: AccountInfo,
  scopes: string[]
): Promise<{ expiresOn: Date | null; needsRefresh: boolean }> {
  const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
  
  try {
    // acquireTokenSilent with forceRefresh: false will return cached token if valid
    const result = await pca.acquireTokenSilent({
      account,
      scopes,
      forceRefresh: false, // Important: don't force network call
    });
    
    if (result?.expiresOn) {
      const timeUntilExpiry = result.expiresOn.getTime() - Date.now();
      return {
        expiresOn: result.expiresOn,
        needsRefresh: timeUntilExpiry < EXPIRY_BUFFER_MS,
      };
    }
    
    return { expiresOn: null, needsRefresh: true };
  } catch {
    return { expiresOn: null, needsRefresh: true };
  }
}
```

---

## 2. Silent Token Acquisition Behavior

### Key Question
Does `acquireTokenSilent` automatically refresh using the refresh token?

### Answer: YES, with nuances

MSAL's `acquireTokenSilent` has the following behavior:

| Scenario | Network Call? | Token Returned |
|----------|---------------|----------------|
| Access token valid & not expired | ❌ No | Cached token |
| Access token expired, refresh token valid | ✅ Yes | New tokens (auto-refresh) |
| Access token expired, refresh token expired | ✅ Yes | Throws `InteractionRequiredAuthError` |
| `forceRefresh: true` | ✅ Yes | Always refreshes |

### MSAL's Internal Token Refresh Logic

```typescript
// Simplified view of MSAL's internal logic
function acquireTokenSilent(request) {
  const cachedToken = getCachedAccessToken(request.account, request.scopes);
  
  if (cachedToken && !isExpired(cachedToken) && !request.forceRefresh) {
    // Return from cache - NO network call
    return { ...cachedToken, fromCache: true };
  }
  
  // Token expired or forceRefresh requested
  const refreshToken = getCachedRefreshToken(request.account);
  
  if (!refreshToken) {
    throw new InteractionRequiredAuthError('no_tokens_found');
  }
  
  try {
    // Use refresh token to get new access token - NETWORK CALL
    const newTokens = await refreshAccessToken(refreshToken);
    cacheTokens(newTokens);
    return { ...newTokens, fromCache: false };
  } catch (error) {
    if (isRefreshTokenExpired(error)) {
      throw new InteractionRequiredAuthError('refresh_token_expired');
    }
    throw error;
  }
}
```

### The `forceRefresh` Option

```typescript
// Force a token refresh even if cached token is valid
const result = await pca.acquireTokenSilent({
  account,
  scopes: AUTH_SCOPES,
  forceRefresh: true,  // Always makes a network call
});

console.log(result.fromCache); // Will be false
```

### SilentFlowRequest Properties

From the MSAL documentation:

```typescript
interface SilentFlowRequest {
  account: AccountInfo;      // Required: Account to get tokens for
  scopes: string[];          // Required: Scopes to request
  forceRefresh?: boolean;    // Optional: Force network call if true
  claims?: string;           // Optional: Claims to include (forces refresh if present)
  authority?: string;        // Optional: Override authority
  correlationId?: string;    // Optional: For telemetry
  tokenQueryParameters?: Record<string, string>; // Optional: Extra params
}
```

---

## 3. Refresh Token Expiry Detection

### Problem
How to detect when the refresh token itself has expired vs just the access token?

### Answer: Catch `InteractionRequiredAuthError`

MSAL throws `InteractionRequiredAuthError` when:
1. Refresh token has expired
2. Refresh token has been revoked
3. User consent is required for new scopes
4. Conditional Access policies require re-authentication

```typescript
import { 
  InteractionRequiredAuthError,
  type AuthenticationResult 
} from '@azure/msal-node';

async function acquireTokenWithRefreshDetection(
  pca: PublicClientApplication,
  account: AccountInfo,
  scopes: string[]
): Promise<{
  result: AuthenticationResult | null;
  requiresReauthentication: boolean;
  reason?: string;
}> {
  try {
    const result = await pca.acquireTokenSilent({
      account,
      scopes,
    });
    
    return {
      result,
      requiresReauthentication: false,
    };
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      // Refresh token is expired or revoked
      return {
        result: null,
        requiresReauthentication: true,
        reason: classifyInteractionError(error),
      };
    }
    throw error;
  }
}

function classifyInteractionError(error: InteractionRequiredAuthError): string {
  // MSAL provides error codes to distinguish scenarios
  switch (error.errorCode) {
    case 'consent_required':
      return 'Additional consent required for requested scopes';
    case 'login_required':
      return 'Session expired - login required';
    case 'interaction_required':
      return 'Interactive authentication required';
    case 'invalid_grant':
      return 'Refresh token expired or revoked';
    default:
      return `Re-authentication required: ${error.errorCode}`;
  }
}
```

### Refresh Token Lifetimes (Azure AD)

From Microsoft documentation:
- **Single-Page Apps (SPAs)**: 24 hours
- **Native/Desktop Apps (Public Clients)**: 90 days sliding window
- **Web Apps (Confidential Clients)**: 24 hours to 90 days (configurable)

> ⚠️ Note: Refresh tokens can also be revoked by:
> - Password changes
> - Admin revocation
> - Conditional Access policy changes
> - User signing out from all devices

---

## 4. Token Expiration Info from Cache

### Getting `expiresOn` Without Triggering Refresh

The `AuthenticationResult` type includes:

```typescript
interface AuthenticationResult {
  accessToken: string;
  account: AccountInfo | null;
  expiresOn: Date | null;       // When access token expires
  extExpiresOn?: Date;          // Extended expiry (for resilience)
  refreshOn?: Date;             // When token should be proactively refreshed
  fromCache: boolean;           // Whether token came from cache
  // ... other fields
}
```

### Best Practice: Use `fromCache` to Detect Network Calls

```typescript
async function getToken(
  pca: PublicClientApplication,
  account: AccountInfo,
  scopes: string[]
): Promise<AuthenticationResult> {
  const result = await pca.acquireTokenSilent({
    account,
    scopes,
    forceRefresh: false,
  });
  
  // Log whether a network call was made
  if (result.fromCache) {
    console.debug('Token retrieved from cache (no network call)');
  } else {
    console.debug('Token refreshed from server (network call made)');
  }
  
  // Log expiration info
  if (result.expiresOn) {
    const minutesUntilExpiry = Math.round(
      (result.expiresOn.getTime() - Date.now()) / 60000
    );
    console.debug(`Token expires in ${minutesUntilExpiry} minutes`);
  }
  
  return result;
}
```

---

## 5. Best Practices for CLI Applications

### Recommended Pattern for cu-cli

```typescript
import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
  type AuthenticationResult,
} from '@azure/msal-node';
import * as fs from 'fs';

const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

interface TokenAcquisitionResult {
  accessToken: string;
  expiresOn: Date;
  fromCache: boolean;
  networkCallMade: boolean;
}

export class OptimizedAuthService {
  private pca: PublicClientApplication;
  private cacheFilePath: string;
  
  constructor(pca: PublicClientApplication, cacheFilePath: string) {
    this.pca = pca;
    this.cacheFilePath = cacheFilePath;
  }
  
  /**
   * Optimized token acquisition that minimizes network calls.
   * 
   * Strategy:
   * 1. Check if token is valid and not expiring soon (no network call)
   * 2. If expiring soon, proactively refresh
   * 3. Handle refresh token expiration gracefully
   */
  async acquireToken(scopes: string[]): Promise<TokenAcquisitionResult> {
    const accounts = await this.pca.getTokenCache().getAllAccounts();
    
    if (accounts.length === 0) {
      throw new Error('Not authenticated. Run `cu login` first.');
    }
    
    const account = accounts[0]!;
    
    // Step 1: Quick cache check (optional optimization)
    const cacheStatus = this.quickCacheCheck(scopes);
    
    if (cacheStatus.hasValidToken && !cacheStatus.isExpiringSoon) {
      // Token is valid and not expiring soon
      // Still call acquireTokenSilent but it will return from cache (no network)
      const result = await this.pca.acquireTokenSilent({
        account,
        scopes,
        forceRefresh: false,
      });
      
      return {
        accessToken: result.accessToken,
        expiresOn: result.expiresOn!,
        fromCache: result.fromCache,
        networkCallMade: !result.fromCache,
      };
    }
    
    // Step 2: Token expired or expiring soon - attempt refresh
    try {
      const result = await this.pca.acquireTokenSilent({
        account,
        scopes,
        // Use forceRefresh if token is about to expire (proactive refresh)
        forceRefresh: cacheStatus.isExpiringSoon && !cacheStatus.isExpired,
      });
      
      return {
        accessToken: result.accessToken,
        expiresOn: result.expiresOn!,
        fromCache: result.fromCache,
        networkCallMade: !result.fromCache,
      };
    } catch (error) {
      // Step 3: Handle refresh token expiration
      if (error instanceof InteractionRequiredAuthError) {
        throw new Error(
          'Your session has expired. Please run `cu login` to re-authenticate.'
        );
      }
      throw error;
    }
  }
  
  /**
   * Quick cache inspection without MSAL initialization.
   * Useful for fast startup checks.
   */
  private quickCacheCheck(scopes: string[]): {
    hasValidToken: boolean;
    isExpiringSoon: boolean;
    isExpired: boolean;
  } {
    try {
      if (!fs.existsSync(this.cacheFilePath)) {
        return { hasValidToken: false, isExpiringSoon: true, isExpired: true };
      }
      
      const cacheData = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf-8'));
      const accessTokens = Object.values(cacheData.AccessToken || {}) as Array<{
        expires_on: string;
        target: string;
      }>;
      
      // Find token matching our scopes
      const scopeSet = new Set(scopes.map(s => s.toLowerCase()));
      const matchingToken = accessTokens.find(token => {
        const tokenScopes = token.target.toLowerCase().split(' ');
        return tokenScopes.some(s => scopeSet.has(s));
      });
      
      if (!matchingToken) {
        return { hasValidToken: false, isExpiringSoon: true, isExpired: true };
      }
      
      const expiresOnMs = parseInt(matchingToken.expires_on, 10) * 1000;
      const now = Date.now();
      
      return {
        hasValidToken: now < expiresOnMs,
        isExpiringSoon: now >= (expiresOnMs - EXPIRY_BUFFER_MS),
        isExpired: now >= expiresOnMs,
      };
    } catch {
      return { hasValidToken: false, isExpiringSoon: true, isExpired: true };
    }
  }
  
  /**
   * Check authentication status without making any network calls.
   * Useful for `cu status` or similar commands.
   */
  async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    user: { email: string; name: string } | null;
    tokenStatus: 'valid' | 'expiring_soon' | 'expired' | 'missing';
    expiresAt: Date | null;
    requiresReauthentication: boolean;
  }> {
    const accounts = await this.pca.getTokenCache().getAllAccounts();
    
    if (accounts.length === 0) {
      return {
        isAuthenticated: false,
        user: null,
        tokenStatus: 'missing',
        expiresAt: null,
        requiresReauthentication: true,
      };
    }
    
    const account = accounts[0]!;
    const cacheStatus = this.quickCacheCheck(['https://cognitiveservices.azure.com/user_impersonation']);
    
    let tokenStatus: 'valid' | 'expiring_soon' | 'expired' | 'missing';
    if (!cacheStatus.hasValidToken) {
      tokenStatus = cacheStatus.isExpired ? 'expired' : 'missing';
    } else {
      tokenStatus = cacheStatus.isExpiringSoon ? 'expiring_soon' : 'valid';
    }
    
    return {
      isAuthenticated: cacheStatus.hasValidToken,
      user: {
        email: account.username,
        name: account.name ?? account.username,
      },
      tokenStatus,
      expiresAt: null, // Would need to parse from cache
      requiresReauthentication: cacheStatus.isExpired,
    };
  }
}
```

### Summary of Optimization Strategies

| Strategy | Use When | Benefit |
|----------|----------|---------|
| `forceRefresh: false` (default) | Normal token acquisition | MSAL handles caching automatically |
| Direct cache inspection | Need to check status without any MSAL calls | Zero network calls, fastest |
| `forceRefresh: true` | Proactively refresh before expiry | Ensures fresh token, but costs network call |
| Catch `InteractionRequiredAuthError` | Always | Proper error handling for expired sessions |

---

## 6. Current Implementation Assessment

### Current cu-cli `acquireTokenSilent` Implementation

```typescript
// From src/services/auth.ts
async acquireTokenSilent(): Promise<string> {
  const pca = this.initialize();
  const accounts = await pca.getTokenCache().getAllAccounts();
  
  // ... account validation ...
  
  const result = await pca.acquireTokenSilent({
    account,
    scopes: AUTH_SCOPES,
  });
  
  return result.accessToken;
}
```

### Assessment: ✅ Already Optimal for Most Cases

The current implementation:
1. ✅ Uses persistent file-based cache
2. ✅ Correctly handles `InteractionRequiredAuthError`
3. ✅ Lets MSAL manage token refresh automatically

### Potential Improvements

1. **Add `forceRefresh` option for proactive refresh**
   ```typescript
   async acquireTokenSilent(options?: { forceRefresh?: boolean }): Promise<string>
   ```

2. **Add cache inspection for status command**
   ```typescript
   async getTokenStatus(): Promise<{ isValid: boolean; expiresAt: Date | null }>
   ```

3. **Return more token metadata**
   ```typescript
   interface TokenResult {
     accessToken: string;
     expiresOn: Date;
     fromCache: boolean;
   }
   ```

---

## References

1. [MSAL Node Caching Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/caching.md)
2. [MSAL Node Request Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/request.md)
3. [MSAL FAQ](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/faq.md)
4. [AuthenticationResult Type](https://azuread.github.io/microsoft-authentication-library-for-js/ref/types/_azure_msal_node.AuthenticationResult.html)
5. [SilentFlowRequest Type](https://azuread.github.io/microsoft-authentication-library-for-js/ref/types/_azure_msal_node.SilentFlowRequest.html)
6. [Microsoft Token Lifetime Documentation](https://docs.microsoft.com/azure/active-directory/develop/active-directory-configurable-token-lifetimes)
