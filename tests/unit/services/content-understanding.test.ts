/**
 * Unit tests for ContentUnderstandingClient.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuthService } from '../../../src/services/auth.js';
import type { ConfigService } from '../../../src/services/config.js';
import type { ConfigProfile } from '../../../src/models/config.js';
import { CliError } from '../../../src/lib/errors.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock getAuthService and getConfigService
const mockAuthService = {
  acquireTokenSilent: vi.fn().mockResolvedValue('mock-access-token'),
} as unknown as AuthService;

const mockProfile: ConfigProfile = {
  endpoint: 'https://test-resource.cognitiveservices.azure.com',
};

const mockConfigService = {
  getActiveProfile: vi.fn().mockReturnValue({
    name: 'default',
    profile: mockProfile,
  }),
} as unknown as ConfigService;

vi.mock('../../../src/services/auth.js', () => ({
  getAuthService: vi.fn(() => mockAuthService),
}));

vi.mock('../../../src/services/config.js', () => ({
  getConfigService: vi.fn(() => mockConfigService),
}));

// Import after mocks
import {
  ContentUnderstandingClient,
  getContentUnderstandingClient,
  resetContentUnderstandingClient,
} from '../../../src/services/content-understanding.js';

describe('ContentUnderstandingClient', () => {
  const testEndpoint = 'https://test-resource.cognitiveservices.azure.com';
  
  // Sample API responses matching Azure CU API format
  const mockAnalyzerListResponse = {
    value: [
      {
        analyzerId: 'prebuilt-document',
        status: 'ready',
        description: 'General document processing',
        createdAt: '2025-01-01T00:00:00.000Z',
        modifiedAt: '2025-01-02T00:00:00.000Z',
        supportedContentKinds: ['document', 'image'],
      },
      {
        analyzerId: 'my-custom-analyzer',
        status: 'ready',
        description: 'Custom contract analyzer',
        createdAt: '2025-01-20T10:00:00.000Z',
        modifiedAt: '2025-01-21T14:30:00.000Z',
      },
    ],
    nextLink: 'https://test.com/nextpage',
  };

  const mockAnalyzerDetailResponse = {
    analyzerId: 'my-custom-analyzer',
    status: 'ready',
    description: 'Custom contract analyzer',
    createdAt: '2025-01-20T10:00:00.000Z',
    modifiedAt: '2025-01-21T14:30:00.000Z',
    baseAnalyzerId: 'prebuilt-document',
    supportedContentKinds: ['document', 'image'],
    fieldSchema: {
      name: 'ContractFields',
      fields: {
        ContractNumber: { type: 'string', method: 'extract', description: 'Contract identifier' },
        EffectiveDate: { type: 'date', method: 'extract', description: 'Contract start date' },
        TotalValue: { type: 'number', method: 'extract', description: 'Total contract value' },
        Category: { type: 'string', method: 'classify', enum: ['Services', 'Products'] },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetContentUnderstandingClient();
    mockFetch.mockReset();
  });

  afterEach(() => {
    resetContentUnderstandingClient();
  });

  describe('constructor', () => {
    it('should_create_instance_with_endpoint', () => {
      const client = new ContentUnderstandingClient(testEndpoint);
      expect(client).toBeInstanceOf(ContentUnderstandingClient);
    });

    it('should_remove_trailing_slash_from_endpoint', () => {
      const client = new ContentUnderstandingClient(testEndpoint + '/');
      // Verify by checking that it makes a request to the correct URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAnalyzerListResponse),
      });
      
      // The trailing slash should be removed
      return client.listAnalyzers().then(() => {
        const callUrl = mockFetch.mock.calls[0][0] as string;
        expect(callUrl).toContain(testEndpoint + '/contentunderstanding/analyzers');
        expect(callUrl).not.toContain('//contentunderstanding');
      });
    });
  });

  describe('listAnalyzers', () => {
    it('should_return_analyzer_list_when_api_succeeds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAnalyzerListResponse),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      const result = await client.listAnalyzers();

      expect(result.value).toHaveLength(2);
      expect(result.value[0].id).toBe('prebuilt-document');
      expect(result.value[0].status).toBe('ready');
      expect(result.value[0].description).toBe('General document processing');
      expect(result.value[0].createdAt).toBeInstanceOf(Date);
      expect(result.value[0].supportedContentKinds).toEqual(['document', 'image']);
      expect(result.nextLink).toBe('https://test.com/nextpage');
    });

    it('should_include_api_version_in_request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAnalyzerListResponse),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      await client.listAnalyzers();

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('api-version=2025-11-01');
    });

    it('should_include_bearer_token_in_request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAnalyzerListResponse),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      await client.listAnalyzers();

      const callOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callOptions.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer mock-access-token');
    });

    it('should_use_GET_method_for_list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAnalyzerListResponse),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      await client.listAnalyzers();

      const callOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect(callOptions.method).toBe('GET');
    });

    it('should_throw_auth_required_error_when_401', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({
          error: { code: 'Unauthorized', message: 'Token is invalid' },
        }),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      
      await expect(client.listAnalyzers()).rejects.toThrow(CliError);

      // Reset mock for next call
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({
          error: { code: 'Unauthorized', message: 'Token is invalid' },
        }),
      });
      
      try {
        await client.listAnalyzers();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).code).toBe('AUTH_REQUIRED');
        expect((error as CliError).exitCode).toBe(1);
      }
    });

    it('should_throw_api_error_when_rate_limited', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.resolve({
          error: { code: 'RateLimited', message: 'Too many requests' },
        }),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      
      await expect(client.listAnalyzers()).rejects.toThrow(CliError);
    });

    it('should_return_empty_list_when_no_analyzers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ value: [] }),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      const result = await client.listAnalyzers();

      expect(result.value).toHaveLength(0);
      expect(result.nextLink).toBeUndefined();
    });
  });

  describe('getAnalyzer', () => {
    it('should_return_analyzer_details_when_found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAnalyzerDetailResponse),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      const result = await client.getAnalyzer('my-custom-analyzer');

      expect(result.id).toBe('my-custom-analyzer');
      expect(result.status).toBe('ready');
      expect(result.description).toBe('Custom contract analyzer');
      expect(result.baseAnalyzerId).toBe('prebuilt-document');
      expect(result.fieldSchema).toBeDefined();
      expect(result.fieldSchema?.name).toBe('ContractFields');
      expect(result.fieldSchema?.fields['ContractNumber']).toBeDefined();
      expect(result.fieldSchema?.fields['ContractNumber'].type).toBe('string');
      expect(result.fieldSchema?.fields['ContractNumber'].method).toBe('extract');
    });

    it('should_encode_analyzer_id_in_url', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAnalyzerDetailResponse),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      await client.getAnalyzer('analyzer/with/slashes');

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('analyzer%2Fwith%2Fslashes');
    });

    it('should_throw_resource_not_found_when_404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({
          error: { code: 'NotFound', message: 'Analyzer not found' },
        }),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      
      await expect(client.getAnalyzer('non-existent')).rejects.toThrow(CliError);
      
      // Reset mock for next call
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({
          error: { code: 'NotFound', message: 'Analyzer not found' },
        }),
      });
      
      try {
        await client.getAnalyzer('non-existent');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).code).toBe('RESOURCE_NOT_FOUND');
        expect((error as CliError).exitCode).toBe(4);
      }
    });

    it('should_parse_field_schema_with_nested_fields', async () => {
      const analyzerWithNestedFields = {
        ...mockAnalyzerDetailResponse,
        fieldSchema: {
          name: 'OrderFields',
          fields: {
            LineItems: {
              type: 'array',
              method: 'extract',
              items: {
                type: 'object',
                method: 'extract',
                fields: {
                  Description: { type: 'string', method: 'extract' },
                  Quantity: { type: 'integer', method: 'extract' },
                  UnitPrice: { type: 'number', method: 'extract' },
                },
              },
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(analyzerWithNestedFields),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      const result = await client.getAnalyzer('complex-analyzer');

      const lineItems = result.fieldSchema?.fields['LineItems'];
      expect(lineItems).toBeDefined();
      expect(lineItems?.type).toBe('array');
      expect(lineItems?.items).toBeDefined();
      expect(lineItems?.items?.type).toBe('object');
      expect(lineItems?.items?.fields?.['Description']).toBeDefined();
    });

    it('should_handle_enum_fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAnalyzerDetailResponse),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      const result = await client.getAnalyzer('my-custom-analyzer');

      const categoryField = result.fieldSchema?.fields['Category'];
      expect(categoryField?.enum).toEqual(['Services', 'Products']);
    });
  });

  describe('error handling', () => {
    it('should_handle_403_forbidden', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () => Promise.resolve({
          error: { code: 'Forbidden', message: 'Access denied' },
        }),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      
      try {
        await client.listAnalyzers();
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).code).toBe('AUTH_FAILED');
        expect((error as CliError).exitCode).toBe(1);
      }
    });

    it('should_handle_500_service_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({
          error: { code: 'InternalServerError', message: 'Server error' },
        }),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      
      try {
        await client.listAnalyzers();
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).code).toBe('API_ERROR');
        expect((error as CliError).exitCode).toBe(5);
      }
    });

    it('should_handle_non_json_error_response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Not JSON')),
      });

      const client = new ContentUnderstandingClient(testEndpoint);
      
      try {
        await client.listAnalyzers();
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).message).toContain('Service error');
      }
    });
  });

  describe('getContentUnderstandingClient', () => {
    it('should_return_singleton_instance', () => {
      const client1 = getContentUnderstandingClient();
      const client2 = getContentUnderstandingClient();
      
      expect(client1).toBe(client2);
    });

    it('should_use_endpoint_from_active_profile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAnalyzerListResponse),
      });

      const client = getContentUnderstandingClient();
      await client.listAnalyzers();

      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain(mockProfile.endpoint);
    });
  });

  describe('resetContentUnderstandingClient', () => {
    it('should_clear_singleton_instance', () => {
      const client1 = getContentUnderstandingClient();
      resetContentUnderstandingClient();
      const client2 = getContentUnderstandingClient();
      
      expect(client1).not.toBe(client2);
    });
  });
});
