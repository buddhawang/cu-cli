/**
 * Unit tests for DefaultsManager service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorCodes } from '../../../src/lib/errors.js';
import type { DefaultsApiResponse } from '../../../src/models/defaults.js';
import type { ConfigProfile } from '../../../src/models/config.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock getAuthService and getConfigService
const mockAuthService: { acquireTokenSilent: ReturnType<typeof vi.fn> } = {
  acquireTokenSilent: vi.fn().mockResolvedValue('mock-token'),
};

const mockProfile: ConfigProfile = {
  endpoint: 'https://test.cognitiveservices.azure.com',
};

const mockConfigService: { getActiveProfile: ReturnType<typeof vi.fn> } = {
  getActiveProfile: vi.fn().mockReturnValue({
    name: 'default',
    profile: mockProfile,
  }),
};

vi.mock('../../../src/services/auth.js', () => ({
  getAuthService: vi.fn(() => mockAuthService),
}));

vi.mock('../../../src/services/config.js', () => ({
  getConfigService: vi.fn(() => mockConfigService),
}));

// Import after mocks
import {
  DefaultsManager,
  getDefaultsManager,
  resetDefaultsManager,
} from '../../../src/services/defaults-manager.js';

describe('DefaultsManager', () => {
  const testEndpoint = 'https://test.cognitiveservices.azure.com';
  let manager: DefaultsManager;

  const mockDefaultsResponse: DefaultsApiResponse = {
    modelDeployments: {
      'gpt-4.1': 'myGpt41Deployment',
      'text-embedding-3-large': 'myTextEmbedding3LargeDeployment',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetDefaultsManager();
    manager = new DefaultsManager(testEndpoint);

    // Re-setup mocks after clearAllMocks
    mockAuthService.acquireTokenSilent.mockResolvedValue('mock-token');
    mockConfigService.getActiveProfile.mockReturnValue({
      name: 'default',
      profile: mockProfile,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetDefaultsManager();
  });

  describe('constructor', () => {
    it('should_create_instance_with_endpoint', () => {
      const instance = new DefaultsManager(testEndpoint);
      expect(instance).toBeInstanceOf(DefaultsManager);
    });

    it('should_remove_trailing_slash_from_endpoint', () => {
      const instance = new DefaultsManager(`${testEndpoint}/`);
      expect(instance).toBeInstanceOf(DefaultsManager);
    });
  });

  describe('getDefaults', () => {
    it('should_return_defaults_when_successful', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockDefaultsResponse),
      } as Response);

      const result = await manager.getDefaults();

      expect(result.modelDeployments).toEqual({
        'gpt-4.1': 'myGpt41Deployment',
        'text-embedding-3-large': 'myTextEmbedding3LargeDeployment',
      });
    });

    it('should_call_correct_endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockDefaultsResponse),
      } as Response);

      await manager.getDefaults();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.cognitiveservices.azure.com/contentunderstanding/defaults?api-version=2025-11-01',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should_return_empty_mapping_when_no_deployments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ modelDeployments: {} }),
      } as Response);

      const result = await manager.getDefaults();

      expect(result.modelDeployments).toEqual({});
    });

    it('should_throw_auth_error_when_401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () =>
          Promise.resolve({
            error: { code: 'Unauthorized', message: 'Invalid token' },
          }),
      } as Response);

      await expect(manager.getDefaults()).rejects.toMatchObject({
        code: ErrorCodes.AUTH_REQUIRED,
      });
    });

    it('should_throw_rate_limit_error_when_429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () =>
          Promise.resolve({
            error: { code: 'TooManyRequests', message: 'Rate limit exceeded' },
          }),
      } as Response);

      await expect(manager.getDefaults()).rejects.toMatchObject({
        code: ErrorCodes.API_RATE_LIMITED,
      });
    });
  });

  describe('updateDefaults', () => {
    it('should_update_defaults_with_merge_patch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockDefaultsResponse),
      } as Response);

      const result = await manager.updateDefaults({
        modelDeployments: {
          'gpt-4.1': 'newGpt41Deployment',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Content-Type': 'application/merge-patch+json',
          }) as Record<string, string>,
          body: JSON.stringify({
            modelDeployments: {
              'gpt-4.1': 'newGpt41Deployment',
            },
          }),
        })
      );

      expect(result.modelDeployments).toBeDefined();
    });

    it('should_send_authorization_header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockDefaultsResponse),
      } as Response);

      await manager.updateDefaults({
        modelDeployments: { 'gpt-4.1': 'test' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }) as Record<string, string>,
        })
      );
    });
  });

  describe('setModelDeployment', () => {
    it('should_set_single_model_deployment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            modelDeployments: {
              'gpt-4.1': 'myDeployment',
            },
          }),
      } as Response);

      const result = await manager.setModelDeployment('gpt-4.1', 'myDeployment');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            modelDeployments: {
              'gpt-4.1': 'myDeployment',
            },
          }),
        })
      );

      const deployments = result.modelDeployments as Record<string, string>;
      expect(deployments['gpt-4.1']).toBe('myDeployment');
    });
  });

  describe('removeModelDeployment', () => {
    it('should_remove_model_deployment_with_null_value', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            modelDeployments: {
              'text-embedding-3-large': 'myTextEmbedding3LargeDeployment',
            },
          }),
      } as Response);

      const result = await manager.removeModelDeployment('gpt-4.1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            modelDeployments: {
              'gpt-4.1': null,
            },
          }),
        })
      );

      const deployments = result.modelDeployments as Record<string, string>;
      expect(deployments['gpt-4.1']).toBeUndefined();
    });
  });

  describe('getDefaultsManager singleton', () => {
    it('should_return_same_instance_on_repeated_calls', () => {
      const instance1 = getDefaultsManager();
      const instance2 = getDefaultsManager();

      expect(instance1).toBe(instance2);
    });

    it('should_return_new_instance_after_reset', () => {
      const instance1 = getDefaultsManager();
      resetDefaultsManager();
      const instance2 = getDefaultsManager();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('error handling', () => {
    it('should_handle_non_json_error_response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Not JSON')),
      } as Response);

      await expect(manager.getDefaults()).rejects.toMatchObject({
        code: ErrorCodes.API_ERROR,
      });
    });

    it('should_include_api_version_in_requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockDefaultsResponse),
      } as Response);

      await manager.getDefaults();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api-version=2025-11-01'),
        expect.any(Object)
      );
    });
  });
});
