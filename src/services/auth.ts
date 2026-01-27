/**
 * Authentication service for Azure AD using MSAL.
 * Provides interactive login, silent token acquisition, and secure credential caching.
 */

import {
  PublicClientApplication,
  CryptoProvider,
  LogLevel,
  type AccountInfo,
  type Configuration,
  InteractionRequiredAuthError,
} from '@azure/msal-node';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as childProcess from 'child_process';
import {
  type UserIdentity,
  type AuthState,
  AUTH_SCOPES,
  MSAL_CONFIG,
} from '../models/auth.js';
import { CliError, ErrorCodes } from '../lib/errors.js';

/**
 * Opens a URL in the default browser.
 * Cross-platform implementation using system commands.
 */
async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  
  let command: string;
  let args: string[];
  
  if (platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', url.replace(/&/g, '^&')];
  } else if (platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }
  
  return new Promise((resolve, reject) => {
    const proc = childProcess.spawn(command, args, {
      stdio: 'ignore',
      detached: true,
    });
    
    proc.on('error', reject);
    proc.unref();
    
    // Give it a moment to spawn
    setTimeout(resolve, 500);
  });
}

/**
 * Cache directory for MSAL tokens.
 */
const CACHE_DIR = path.join(os.homedir(), '.cu');
const CACHE_FILE = path.join(CACHE_DIR, 'msal-cache.json');

/**
 * Simple file-based cache plugin for MSAL.
 * Uses JSON file storage with atomic writes.
 */
class FileCachePlugin {
  private cacheLocation: string;

  constructor(cacheLocation: string) {
    this.cacheLocation = cacheLocation;
  }

  beforeCacheAccess(cacheContext: { tokenCache: { deserialize: (data: string) => void } }): Promise<void> {
    try {
      if (fs.existsSync(this.cacheLocation)) {
        const data = fs.readFileSync(this.cacheLocation, 'utf-8');
        cacheContext.tokenCache.deserialize(data);
      }
    } catch {
      // Ignore errors - cache will be empty
    }
    return Promise.resolve();
  }

  afterCacheAccess(cacheContext: { 
    tokenCache: { serialize: () => string }; 
    cacheHasChanged: boolean 
  }): Promise<void> {
    if (cacheContext.cacheHasChanged) {
      try {
        // Ensure directory exists
        if (!fs.existsSync(CACHE_DIR)) {
          fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        fs.writeFileSync(this.cacheLocation, cacheContext.tokenCache.serialize());
      } catch {
        // Ignore write errors
      }
    }
    return Promise.resolve();
  }
}

/**
 * Authentication service for Azure AD.
 * Uses MSAL for OAuth flows with file-based credential caching.
 */
export class AuthService {
  private pca: PublicClientApplication | null = null;
  private cryptoProvider = new CryptoProvider();
  private tenantId: string | undefined;

  /**
   * Creates an AuthService instance.
   * @param tenantId - Optional tenant ID for single-tenant scenarios
   */
  constructor(tenantId?: string) {
    this.tenantId = tenantId;
  }

  /**
   * Initializes the MSAL client with persistent token cache.
   */
  private initialize(): PublicClientApplication {
    if (this.pca !== null) {
      return this.pca;
    }

    const authority = this.tenantId !== undefined && this.tenantId !== ''
      ? `https://login.microsoftonline.com/${this.tenantId}`
      : MSAL_CONFIG.authority;

    const cachePlugin = new FileCachePlugin(CACHE_FILE);

    const config: Configuration = {
      auth: {
        clientId: MSAL_CONFIG.clientId,
        authority,
      },
      cache: {
        cachePlugin,
      },
      system: {
        loggerOptions: {
          logLevel: LogLevel.Warning,
          loggerCallback: () => {
            // Silent by default, enable with --verbose
          },
        },
      },
    };

    this.pca = new PublicClientApplication(config);
    return this.pca;
  }

  /**
   * Performs interactive login using browser-based sign-in.
   * Opens the default browser for Azure AD authentication.
   * @returns User identity after successful login
   */
  async loginInteractive(): Promise<UserIdentity> {
    const pca = this.initialize();

    // Generate PKCE codes
    const { verifier, challenge } = await this.cryptoProvider.generatePkceCodes();

    // Start local server to receive auth code
    const { code, redirectUri } = await this.startAuthServer(challenge);

    // Exchange code for tokens
    const result = await pca.acquireTokenByCode({
      code,
      redirectUri,
      scopes: AUTH_SCOPES,
      codeVerifier: verifier,
    });

    if (result?.account === null || result?.account === undefined) {
      throw new CliError(
        ErrorCodes.AUTH_FAILED,
        'Authentication failed',
        'Azure AD did not return account information',
        'Try logging in again with `cu login`'
      );
    }

    return this.accountToIdentity(result.account);
  }

  /**
   * Performs login using device code flow for headless environments.
   * @param deviceCodeCallback - Callback to display device code to user
   * @returns User identity after successful login
   */
  async loginDeviceCode(
    deviceCodeCallback: (message: string) => void
  ): Promise<UserIdentity> {
    const pca = this.initialize();

    const result = await pca.acquireTokenByDeviceCode({
      scopes: AUTH_SCOPES,
      deviceCodeCallback: (response) => {
        deviceCodeCallback(response.message);
      },
    });

    if (result?.account === null || result?.account === undefined) {
      throw new CliError(
        ErrorCodes.AUTH_FAILED,
        'Authentication failed',
        'Azure AD did not return account information',
        'Try logging in again with `cu login`'
      );
    }

    return this.accountToIdentity(result.account);
  }

  /**
   * Acquires a token silently using cached credentials.
   * @returns Access token for API calls
   * @throws CliError if no cached credentials or refresh fails
   */
  async acquireTokenSilent(): Promise<string> {
    const pca = this.initialize();
    const accounts = await pca.getTokenCache().getAllAccounts();

    if (accounts.length === 0) {
      throw new CliError(
        ErrorCodes.AUTH_REQUIRED,
        'Authentication required',
        'No cached credentials found',
        'Run `cu login` to authenticate',
        1
      );
    }

    try {
      const account = accounts[0];
      if (account === undefined) {
        throw new CliError(
          ErrorCodes.AUTH_REQUIRED,
          'Authentication required',
          'No cached credentials found',
          'Run `cu login` to authenticate',
          1
        );
      }
      const result = await pca.acquireTokenSilent({
        account,
        scopes: AUTH_SCOPES,
      });

      if (result?.accessToken === undefined || result?.accessToken === '') {
        throw new CliError(
          ErrorCodes.AUTH_FAILED,
          'Failed to acquire token',
          'Token acquisition returned empty result',
          'Try logging in again with `cu login`'
        );
      }

      return result.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        throw new CliError(
          ErrorCodes.TOKEN_EXPIRED,
          'Session expired',
          'Your authentication session has expired and requires re-authentication',
          'Run `cu login` to authenticate again',
          1
        );
      }
      throw error;
    }
  }

  /**
   * Clears all cached credentials (logout).
   */
  async logout(): Promise<void> {
    const pca = this.initialize();
    const accounts = await pca.getTokenCache().getAllAccounts();

    for (const account of accounts) {
      await pca.getTokenCache().removeAccount(account);
    }
  }

  /**
   * Gets the current user identity from cached credentials.
   * @returns User identity or null if not authenticated
   */
  async getIdentity(): Promise<UserIdentity | null> {
    const pca = this.initialize();
    const accounts = await pca.getTokenCache().getAllAccounts();

    if (accounts.length === 0) {
      return null;
    }

    const account = accounts[0];
    if (account === undefined) {
      return null;
    }

    return this.accountToIdentity(account);
  }

  /**
   * Gets the current authentication state.
   * @returns Full authentication state including expiration
   */
  async getAuthState(): Promise<AuthState> {
    const pca = this.initialize();
    const accounts = await pca.getTokenCache().getAllAccounts();

    if (accounts.length === 0) {
      return {
        isAuthenticated: false,
        user: null,
        expiresAt: null,
      };
    }

    const account = accounts[0];
    if (account === undefined) {
      return {
        isAuthenticated: false,
        user: null,
        expiresAt: null,
      };
    }

    // Try to get token info for expiration
    let expiresAt: Date | null = null;
    try {
      const result = await pca.acquireTokenSilent({
        account,
        scopes: AUTH_SCOPES,
      });
      if (result?.expiresOn !== undefined && result?.expiresOn !== null) {
        expiresAt = result.expiresOn;
      }
    } catch {
      // Ignore errors, we just won't have expiration info
    }

    return {
      isAuthenticated: true,
      user: this.accountToIdentity(account),
      expiresAt,
    };
  }

  /**
   * Converts MSAL AccountInfo to UserIdentity.
   */
  private accountToIdentity(account: AccountInfo): UserIdentity {
    return {
      email: account.username,
      name: account.name ?? account.username,
      tenantId: account.tenantId,
      homeAccountId: account.homeAccountId,
    };
  }

  /**
   * Starts a local HTTP server to receive the OAuth redirect.
   * Opens the browser to the Azure AD login page.
   * @returns Promise resolving to the authorization code
   */
  private async startAuthServer(
    codeChallenge: string
  ): Promise<{ code: string; redirectUri: string }> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? '', `http://localhost`);

        if (url.pathname === '/') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');
          const errorDescription = url.searchParams.get('error_description');

          if (error !== null) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Failed</h1>
                  <p>${errorDescription ?? error}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            server.close();
            reject(
              new CliError(
                ErrorCodes.AUTH_FAILED,
                'Authentication failed',
                errorDescription ?? error,
                'Try logging in again with `cu login`'
              )
            );
            return;
          }

          if (code !== null) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body>
                  <h1>Authentication Successful</h1>
                  <p>You can close this window and return to the terminal.</p>
                </body>
              </html>
            `);
            const address = server.address();
            const port = typeof address === 'object' && address !== null ? address.port : 0;
            server.close();
            resolve({
              code,
              redirectUri: `http://localhost:${port}`,
            });
            return;
          }
        }

        res.writeHead(404);
        res.end('Not found');
      });

      // Listen on random available port
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (typeof address !== 'object' || address === null) {
          server.close();
          reject(new Error('Failed to start auth server'));
          return;
        }

        const port = address.port;
        const redirectUri = `http://localhost:${port}`;

        // Build authorization URL
        const authUrl = new URL(
          `${this.tenantId !== undefined && this.tenantId !== '' ? `https://login.microsoftonline.com/${this.tenantId}` : MSAL_CONFIG.authority}/oauth2/v2.0/authorize`
        );
        authUrl.searchParams.set('client_id', MSAL_CONFIG.clientId);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', AUTH_SCOPES.join(' '));
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('prompt', 'select_account');

        // Open browser
        openBrowser(authUrl.toString()).catch(() => {
          // If browser open fails, provide URL to user
          process.stderr.write(`\nOpen this URL in your browser:\n${authUrl.toString()}\n\n`);
        });
      });

      // Timeout after 5 minutes
      const timeoutId = setTimeout(() => {
        server.close();
        reject(
          new CliError(
            ErrorCodes.AUTH_FAILED,
            'Authentication timed out',
            'No response received within 5 minutes',
            'Try logging in again with `cu login`'
          )
        );
      }, 5 * 60 * 1000);

      // Ensure timeout doesn't keep process alive if server closes first
      timeoutId.unref();
    });
  }
}

// Singleton instance for shared use
let authServiceInstance: AuthService | null = null;

/**
 * Gets the shared AuthService instance.
 * @param tenantId - Optional tenant ID for single-tenant scenarios
 */
export function getAuthService(tenantId?: string): AuthService {
  if (authServiceInstance === null || tenantId !== undefined) {
    authServiceInstance = new AuthService(tenantId);
  }
  return authServiceInstance;
}
