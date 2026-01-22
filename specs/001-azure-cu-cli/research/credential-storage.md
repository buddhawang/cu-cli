# Cross-Platform Credential Storage Research

## Executive Summary

**Decision: Use `@azure/msal-node-extensions`** for OAuth token storage in the Azure CU CLI.

This library provides:
- Native OS credential store integration (DPAPI on Windows, Keychain on macOS, libsecret on Linux)
- Direct integration with `@azure/msal-node` via `PersistenceCachePlugin`
- Pre-compiled binaries (no build-time dependencies)
- Official Microsoft support and maintenance
- Built-in fallback mechanisms

---

## 1. OS-Level Credential Storage Mechanisms

### Windows: Credential Manager (DPAPI)

| Feature | Details |
|---------|---------|
| **API** | Data Protection API (DPAPI) |
| **Encryption** | AES-256, key derived from user login credentials |
| **Scope** | `CurrentUser` (per-user) or `LocalMachine` |
| **Location** | `%LOCALAPPDATA%\Microsoft\Credentials\` (encrypted) |
| **Security** | Tokens encrypted at rest, decrypted only for logged-in user |

### macOS: Keychain

| Feature | Details |
|---------|---------|
| **API** | Security.framework / `security` CLI |
| **Encryption** | AES-256-GCM |
| **Scope** | Per-application (app must be code-signed for full access) |
| **Location** | `~/Library/Keychains/login.keychain-db` |
| **Security** | Only creating application can access without user prompt |

### Linux: Secret Service (libsecret)

| Feature | Details |
|---------|---------|
| **API** | D-Bus Secret Service API |
| **Implementations** | GNOME Keyring, KWallet, KeePassXC |
| **Encryption** | Depends on implementation (typically AES) |
| **Requirement** | `libsecret-1-dev` package must be installed |
| **Fallback Risk** | Headless servers may not have Secret Service daemon |

---

## 2. NPM Packages for Cross-Platform Keyring Access

### Comparison Matrix

| Package | Weekly Downloads | Platforms | Native Binary | Maintained | TypeScript |
|---------|-----------------|-----------|---------------|------------|------------|
| **keytar** | 1.5M+ | Win/Mac/Linux | Yes | ⚠️ Archived | ✅ |
| **@azure/msal-node-extensions** | 59K+ | Win/Mac/Linux | Yes | ✅ Active | ✅ |
| **keychain** | 400K+ | macOS only | No (uses CLI) | ⚠️ Stale (3yr) | ❌ |

### Detailed Analysis

#### `keytar` (atom/node-keytar)
```bash
npm install keytar
```

**Pros:**
- Simple API: `getPassword()`, `setPassword()`, `deletePassword()`, `findCredentials()`
- High adoption (used by VS Code, Azure CLI)
- Pre-compiled binaries for Node.js and Electron

**Cons:**
- ⚠️ **Project archived** - Last publish 4 years ago
- Requires `libsecret-1-dev` on Linux
- No official MSAL integration

**API Example:**
```typescript
import * as keytar from 'keytar';

await keytar.setPassword('cu-cli', 'azure-oauth', JSON.stringify(tokenData));
const token = await keytar.getPassword('cu-cli', 'azure-oauth');
await keytar.deletePassword('cu-cli', 'azure-oauth');
```

#### `@azure/msal-node-extensions` (Recommended)
```bash
npm install @azure/msal-node-extensions
```

**Pros:**
- Official Microsoft library
- Direct MSAL integration via `PersistenceCachePlugin`
- Active maintenance
- Pre-compiled binaries included
- Built-in lock file mechanism for concurrent access
- Handles cache serialization automatically

**Cons:**
- Larger dependency footprint
- Requires `libsecret-1-dev` on Linux

---

## 3. MSAL Node Token Caching Architecture

### Default Behavior

`@azure/msal-node` uses **in-memory caching only** by default:
- Tokens lost when process exits
- No OS credential store integration out-of-the-box
- Users must re-authenticate on each CLI invocation

### Integration with `@azure/msal-node-extensions`

The extensions package provides `PersistenceCachePlugin` for OS-level secure storage:

```typescript
import { PublicClientApplication } from '@azure/msal-node';
import {
  DataProtectionScope,
  Environment,
  PersistenceCreator,
  PersistenceCachePlugin,
} from '@azure/msal-node-extensions';
import * as path from 'path';

// Configure persistence
const cachePath = path.join(
  Environment.getUserRootDirectory(),
  '.cu-cli',
  'msal-cache.json'
);

const persistenceConfig = {
  cachePath,
  dataProtectionScope: DataProtectionScope.CurrentUser,
  serviceName: 'cu-cli',
  accountName: 'azure-oauth',
  usePlaintextFileOnLinux: false, // Require libsecret
};

// Create persistence and MSAL client
async function createMsalClient() {
  const persistence = await PersistenceCreator.createPersistence(persistenceConfig);
  
  const pca = new PublicClientApplication({
    auth: {
      clientId: '<CLIENT_ID>',
      authority: 'https://login.microsoftonline.com/common',
    },
    cache: {
      cachePlugin: new PersistenceCachePlugin(persistence),
    },
  });
  
  return pca;
}
```

### Platform-Specific Behavior

| Platform | Cache File | Encryption Method |
|----------|-----------|-------------------|
| Windows | `~/.cu-cli/msal-cache.json` | DPAPI encrypted |
| macOS | `~/.cu-cli/msal-cache.json` | Keychain secured |
| Linux | Secret Service | libsecret (D-Bus) |

---

## 4. Fallback Strategies

### When OS Credential Store is Unavailable

Common scenarios:
- Headless Linux servers (no D-Bus/Secret Service)
- Docker containers
- SSH sessions without X11/Wayland forwarding
- WSL without credential bridge

### Fallback Hierarchy

```
┌─────────────────────────────────────┐
│  1. OS Credential Store (preferred) │
│     - DPAPI (Windows)               │
│     - Keychain (macOS)              │
│     - libsecret (Linux)             │
└────────────────┬────────────────────┘
                 │ fails
                 ▼
┌─────────────────────────────────────┐
│  2. Encrypted File (fallback)       │
│     - AES-256-GCM encryption        │
│     - Key from environment variable │
│     - ~/.cu-cli/tokens.enc          │
└────────────────┬────────────────────┘
                 │ fails
                 ▼
┌─────────────────────────────────────┐
│  3. In-Memory Only (last resort)    │
│     - Re-auth on each invocation    │
│     - Warning to user               │
└─────────────────────────────────────┘
```

### Implementation Options

#### Option A: Use `usePlaintextFileOnLinux` Flag (Simple)
```typescript
const persistenceConfig = {
  // ...
  usePlaintextFileOnLinux: true, // Falls back to plaintext if libsecret fails
};
```
⚠️ **Security Warning:** Tokens stored in plaintext (file permissions only).

#### Option B: Custom Encrypted File Fallback (Recommended)
```typescript
import * as crypto from 'crypto';
import * as fs from 'fs/promises';

class EncryptedFileFallback {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyEnvVar = 'CU_CLI_ENCRYPTION_KEY';
  
  private getKey(): Buffer {
    const key = process.env[this.keyEnvVar];
    if (!key) {
      throw new Error(
        `Environment variable ${this.keyEnvVar} required for token encryption`
      );
    }
    return crypto.scryptSync(key, 'cu-cli-salt', 32);
  }
  
  async save(filePath: string, data: string): Promise<void> {
    const key = this.getKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    const payload = JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted,
    });
    
    await fs.writeFile(filePath, payload, { mode: 0o600 });
  }
  
  async load(filePath: string): Promise<string> {
    const payload = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const key = this.getKey();
    
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(payload.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
    
    let decrypted = decipher.update(payload.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

#### Option C: Azure CLI Compatibility Mode
Use `az account get-access-token` as fallback:
```typescript
import { execSync } from 'child_process';

function getTokenViaAzCli(resource: string): string {
  const result = execSync(
    `az account get-access-token --resource ${resource} --query accessToken -o tsv`,
    { encoding: 'utf8' }
  );
  return result.trim();
}
```

---

## 5. Security Best Practices

### Token Storage Security Checklist

| Requirement | Implementation |
|-------------|----------------|
| ✅ Encrypt at rest | Use OS credential store (DPAPI/Keychain/libsecret) |
| ✅ Restrict file permissions | `chmod 600` on any cache files |
| ✅ Scope to current user | `DataProtectionScope.CurrentUser` |
| ✅ Never log tokens | Mask in debug output |
| ✅ Token rotation | Use refresh tokens, respect `expires_in` |
| ✅ Secure deletion | Use `keytar.deletePassword()` or clear cache |
| ✅ No hardcoded secrets | Use environment variables or secure config |

### Additional Security Measures

1. **Minimal Token Scope**
   ```typescript
   const scopes = ['https://management.azure.com/.default'];
   // Request only necessary permissions
   ```

2. **Token Expiry Handling**
   ```typescript
   // MSAL handles token refresh automatically when using acquireTokenSilent
   try {
     const response = await pca.acquireTokenSilent({ account, scopes });
   } catch (error) {
     // Token expired or revoked, re-authenticate
     await pca.acquireTokenInteractive({ scopes });
   }
   ```

3. **Logout/Clear Credentials**
   ```typescript
   async function logout(pca: PublicClientApplication): Promise<void> {
     const accounts = await pca.getTokenCache().getAllAccounts();
     for (const account of accounts) {
       await pca.getTokenCache().removeAccount(account);
     }
     // Also clear from OS credential store via persistence
   }
   ```

4. **Environment Detection for CI/CD**
   ```typescript
   function isInteractiveEnvironment(): boolean {
     return (
       process.stdout.isTTY &&
       !process.env.CI &&
       !process.env.GITHUB_ACTIONS &&
       !process.env.AZURE_DEVOPS
     );
   }
   ```

---

## 6. Recommended Implementation

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      cu-cli                              │
├──────────────────────────────────────────────────────────┤
│  CredentialManager                                       │
│  ├── PersistenceProvider (interface)                     │
│  │   ├── MsalExtensionsPersistence (primary)            │
│  │   ├── EncryptedFilePersistence (fallback)            │
│  │   └── InMemoryPersistence (last resort)              │
│  └── detectAvailableProvider()                          │
├──────────────────────────────────────────────────────────┤
│  @azure/msal-node                                        │
│  └── cache: PersistenceCachePlugin                       │
├──────────────────────────────────────────────────────────┤
│  @azure/msal-node-extensions                             │
│  ├── Windows: DPAPI                                      │
│  ├── macOS: Keychain                                     │
│  └── Linux: libsecret                                    │
└──────────────────────────────────────────────────────────┘
```

### Dependencies

```json
{
  "dependencies": {
    "@azure/msal-node": "^2.x",
    "@azure/msal-node-extensions": "^1.x"
  }
}
```

### Linux Prerequisites (for users)

```bash
# Debian/Ubuntu
sudo apt-get install libsecret-1-dev

# Red Hat/Fedora
sudo yum install libsecret-devel

# Arch Linux
sudo pacman -S libsecret
```

---

## 7. Summary

| Aspect | Recommendation |
|--------|----------------|
| **Primary Library** | `@azure/msal-node-extensions` |
| **Fallback** | Encrypted file with env-var key, then in-memory |
| **Windows** | DPAPI (automatic via msal-node-extensions) |
| **macOS** | Keychain (automatic via msal-node-extensions) |
| **Linux** | libsecret with encrypted file fallback |
| **CI/CD** | Environment variable authentication (no stored tokens) |
| **Security** | Never store plaintext tokens; use shortest-lived tokens possible |

### Why Not `keytar`?

While `keytar` has higher adoption (1.5M weekly downloads), it is:
- Archived and unmaintained (last update 4+ years ago)
- Does not integrate directly with MSAL
- Requires manual cache serialization

`@azure/msal-node-extensions` is the official Microsoft solution, actively maintained, and provides seamless MSAL integration.
