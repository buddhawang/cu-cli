/**
 * Authentication types for the cu-cli application.
 * Represents user identity and authentication state from MSAL.
 */

/**
 * Represents the authenticated user's identity.
 * Populated from MSAL account info after successful login.
 */
export interface UserIdentity {
  /** User's email or UPN */
  email: string;

  /** Display name */
  name: string;

  /** Azure AD tenant ID */
  tenantId: string;

  /** Home account ID (MSAL identifier) */
  homeAccountId: string;
}

/**
 * Authentication method in use.
 */
export type AuthMethod = 'azure-ad' | 'api-key' | 'none';

/**
 * Authentication state for the current session.
 */
export interface AuthState {
  /** Whether user is currently authenticated */
  isAuthenticated: boolean;

  /** User identity (null if not authenticated) */
  user: UserIdentity | null;

  /** Token expiration time (null if not authenticated) */
  expiresAt: Date | null;

  /** Whether authentication is via API key (no expiry) */
  isApiKey?: boolean;

  /** Whether token needs refresh soon (within 5 minutes) */
  needsRefresh?: boolean;
}

/**
 * Token scopes required for Azure Content Understanding API.
 */
export const AUTH_SCOPES = ['https://cognitiveservices.azure.com/user_impersonation'];

/**
 * MSAL client configuration constants.
 */
export const MSAL_CONFIG = {
  /** Azure AD client ID for the CLI (public client) */
  clientId: '04b07795-8ddb-461a-bbee-02f9e1bf7b46', // Azure CLI client ID
  /** Default authority for multi-tenant apps */
  authority: 'https://login.microsoftonline.com/common',
  /** Redirect URI for interactive auth */
  redirectUri: 'http://localhost',
} as const;
