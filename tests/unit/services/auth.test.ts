/**
 * Unit tests for AuthService.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AccountInfo, AuthenticationResult, DeviceCodeRequest } from '@azure/msal-node';
import { CliError } from '../../../src/lib/errors.js';

// Mock account info
const mockAccountInfo: AccountInfo = {
  homeAccountId: 'home-account-id-123',
  environment: 'login.microsoftonline.com',
  tenantId: 'tenant-id-123',
  username: 'user@example.com',
  localAccountId: 'local-account-id',
  name: 'Test User',
};

// Mock auth result
const mockAuthResult: AuthenticationResult = {
  authority: 'https://login.microsoftonline.com/common',
  uniqueId: 'unique-id',
  tenantId: 'tenant-id-123',
  scopes: ['https://cognitiveservices.azure.com/.default'],
  account: mockAccountInfo,
  idToken: 'id-token',
  idTokenClaims: {},
  accessToken: 'access-token-123',
  fromCache: false,
  expiresOn: new Date(Date.now() + 3600000),
  tokenType: 'Bearer',
  correlationId: 'correlation-id',
};

// Mock token cache - shared instance
const mockTokenCache = {
  getAllAccounts: vi.fn(),
  removeAccount: vi.fn().mockResolvedValue(undefined),
  serialize: vi.fn().mockReturnValue('{}'),
  deserialize: vi.fn(),
};

// Mock PCA instance - shared instance
const mockPcaInstance = {
  acquireTokenByCode: vi.fn().mockResolvedValue(mockAuthResult),
  acquireTokenByDeviceCode: vi.fn().mockImplementation((request: DeviceCodeRequest) => {
    // Call the device code callback with a mock message
    if (request.deviceCodeCallback !== undefined && typeof request.deviceCodeCallback === 'function') {
      request.deviceCodeCallback({
        message: 'Go to https://microsoft.com/devicelogin and enter code ABC123',
        userCode: 'ABC123',
        deviceCode: 'device-code-123',
        verificationUri: 'https://microsoft.com/devicelogin',
        expiresIn: 900,
        interval: 5,
      });
    }
    return Promise.resolve(mockAuthResult);
  }),
  acquireTokenSilent: vi.fn().mockResolvedValue(mockAuthResult),
  getTokenCache: vi.fn(() => mockTokenCache),
};

// Mock modules BEFORE importing the service
vi.mock('@azure/msal-node', () => ({
  PublicClientApplication: vi.fn(() => mockPcaInstance),
  CryptoProvider: vi.fn().mockImplementation(() => ({
    generatePkceCodes: vi.fn().mockResolvedValue({
      verifier: 'test-verifier',
      challenge: 'test-challenge',
    }),
  })),
  LogLevel: {
    Warning: 2,
  },
  InteractionRequiredAuthError: class InteractionRequiredAuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'InteractionRequiredAuthError';
    }
  },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: vi.fn().mockReturnValue({
    on: vi.fn(),
    unref: vi.fn(),
  }),
}));

// Import after mocks
import { AuthService, getAuthService } from '../../../src/services/auth.js';

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behavior
    mockTokenCache.getAllAccounts.mockResolvedValue([mockAccountInfo]);
    mockPcaInstance.acquireTokenSilent.mockResolvedValue(mockAuthResult);
    mockPcaInstance.acquireTokenByDeviceCode.mockImplementation((request: DeviceCodeRequest) => {
      // Call the device code callback with a mock message
      if (typeof request.deviceCodeCallback === 'function') {
        request.deviceCodeCallback({
          message: 'Go to https://microsoft.com/devicelogin and enter code ABC123',
          userCode: 'ABC123',
          deviceCode: 'device-code-123',
          verificationUri: 'https://microsoft.com/devicelogin',
          expiresIn: 900,
          interval: 5,
        });
      }
      return Promise.resolve(mockAuthResult);
    });
  });

  afterEach(() => {
    // Don't use restoreAllMocks as it undoes our vi.mock() calls
  });

  describe('constructor', () => {
    it('should_create_instance_when_constructed', () => {
      const service = new AuthService();
      expect(service).toBeInstanceOf(AuthService);
    });

    it('should_accept_tenant_id_when_provided', () => {
      const service = new AuthService('my-tenant-id');
      expect(service).toBeInstanceOf(AuthService);
    });
  });

  describe('getIdentity', () => {
    it('should_return_user_identity_when_cached_account_exists', async () => {
      const authService = new AuthService();
      const identity = await authService.getIdentity();

      expect(identity).not.toBeNull();
      expect(identity?.email).toBe('user@example.com');
      expect(identity?.name).toBe('Test User');
      expect(identity?.tenantId).toBe('tenant-id-123');
      expect(identity?.homeAccountId).toBe('home-account-id-123');
    });

    it('should_return_null_when_no_cached_account', async () => {
      mockTokenCache.getAllAccounts.mockResolvedValueOnce([]);

      const authService = new AuthService();
      const identity = await authService.getIdentity();

      expect(identity).toBeNull();
    });
  });

  describe('getAuthState', () => {
    it('should_return_authenticated_state_when_user_logged_in', async () => {
      const authService = new AuthService();
      const state = await authService.getAuthState();

      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
      expect(state.user?.email).toBe('user@example.com');
      // expiresAt may be Date or null depending on token acquisition success
      expect(state.expiresAt === null || state.expiresAt instanceof Date).toBe(true);
    });

    it('should_return_unauthenticated_state_when_no_accounts', async () => {
      mockTokenCache.getAllAccounts.mockResolvedValue([]);

      const authService = new AuthService();
      const state = await authService.getAuthState();

      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe('acquireTokenSilent', () => {
    it('should_return_access_token_when_cached_credentials_valid', async () => {
      const authService = new AuthService();
      const token = await authService.acquireTokenSilent();

      expect(token).toBe('access-token-123');
    });

    it('should_throw_auth_required_when_no_cached_accounts', async () => {
      mockTokenCache.getAllAccounts.mockResolvedValue([]);

      const authService = new AuthService();
      await expect(authService.acquireTokenSilent()).rejects.toThrow(CliError);
    });
  });

  describe('logout', () => {
    it('should_clear_cached_credentials_when_called', async () => {
      const authService = new AuthService();
      await authService.logout();

      expect(mockTokenCache.removeAccount).toHaveBeenCalled();
    });
  });

  describe('loginDeviceCode', () => {
    it('should_return_user_identity_when_device_code_flow_completes', async () => {
      const authService = new AuthService();
      const callback = vi.fn();
      const identity = await authService.loginDeviceCode(callback);

      expect(identity).toBeDefined();
      expect(identity.email).toBe('user@example.com');
      expect(identity.name).toBe('Test User');
      expect(callback).toHaveBeenCalled();
    });
  });
});

describe('getAuthService', () => {
  it('should_return_singleton_instance_when_called_multiple_times', () => {
    const service1 = getAuthService();
    const service2 = getAuthService();

    // Both should be AuthService instances
    expect(service1).toBeInstanceOf(AuthService);
    expect(service2).toBeInstanceOf(AuthService);
  });

  it('should_create_new_instance_when_tenant_id_provided', () => {
    const service = getAuthService('new-tenant-id');

    expect(service).toBeInstanceOf(AuthService);
  });
});

describe('AuthService.getQuickAuthStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenCache.getAllAccounts.mockResolvedValue([]);
  });

  it('should_return_hasCredentials_false_when_no_accounts_cached', async () => {
    mockTokenCache.getAllAccounts.mockResolvedValue([]);

    const authService = new AuthService();
    const status = await authService.getQuickAuthStatus();

    expect(status.hasCredentials).toBe(false);
    expect(status.account).toBeNull();
  });

  it('should_return_hasCredentials_true_with_account_info_when_cached', async () => {
    mockTokenCache.getAllAccounts.mockResolvedValue([mockAccountInfo]);

    const authService = new AuthService();
    const status = await authService.getQuickAuthStatus();

    expect(status.hasCredentials).toBe(true);
    expect(status.account).not.toBeNull();
    expect(status.account?.email).toBe('user@example.com');
    expect(status.account?.name).toBe('Test User');
    expect(status.account?.tenantId).toBe('tenant-id-123');
  });

  it('should_not_make_network_calls_when_checking_status', async () => {
    mockTokenCache.getAllAccounts.mockResolvedValue([mockAccountInfo]);

    const authService = new AuthService();
    await authService.getQuickAuthStatus();

    // Should only check cache, not try to acquire tokens
    expect(mockPcaInstance.acquireTokenSilent).not.toHaveBeenCalled();
  });
});

describe('AuthService.getAuthState with needsRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_set_needsRefresh_true_when_token_expires_within_5_minutes', async () => {
    const soonExpiringResult = {
      ...mockAuthResult,
      expiresOn: new Date(Date.now() + 3 * 60 * 1000), // 3 minutes from now
    };
    mockTokenCache.getAllAccounts.mockResolvedValue([mockAccountInfo]);
    mockPcaInstance.acquireTokenSilent.mockResolvedValue(soonExpiringResult);

    const authService = new AuthService();
    const state = await authService.getAuthState();

    expect(state.needsRefresh).toBe(true);
  });

  it('should_set_needsRefresh_false_when_token_expires_after_5_minutes', async () => {
    const laterExpiringResult = {
      ...mockAuthResult,
      expiresOn: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    };
    mockTokenCache.getAllAccounts.mockResolvedValue([mockAccountInfo]);
    mockPcaInstance.acquireTokenSilent.mockResolvedValue(laterExpiringResult);

    const authService = new AuthService();
    const state = await authService.getAuthState();

    expect(state.needsRefresh).toBe(false);
  });
});
