/**
 * Defaults Manager service.
 * Manages default model deployment mappings for Azure Content Understanding.
 */

import type {
  ContentUnderstandingDefaults,
  UpdateDefaultsRequest,
  DefaultsApiResponse,
} from '../models/defaults.js';
import { getAuthService } from './auth.js';
import { getConfigService } from './config.js';
import { CliError, ErrorCodes } from '../lib/errors.js';

/**
 * API version for Azure Content Understanding.
 */
const API_VERSION = '2025-11-01';

/**
 * Error response from the API.
 */
interface ApiError {
  error: {
    code: string;
    message: string;
    target?: string;
    details?: Array<{ code: string; message: string }>;
  };
}

/**
 * Defaults Manager for Azure CU resources.
 */
export class DefaultsManager {
  private endpoint: string;

  /**
   * Creates a DefaultsManager instance.
   * @param endpoint - The Azure CU resource endpoint
   */
  constructor(endpoint: string) {
    // Remove trailing slash if present
    this.endpoint = endpoint.replace(/\/$/, '');
  }

  /**
   * Acquires an access token for API calls.
   * @returns Access token string
   */
  private async getAccessToken(): Promise<string> {
    const authService = getAuthService();
    return authService.acquireTokenSilent();
  }

  /**
   * Makes an authenticated API request.
   * Uses API key if configured, otherwise falls back to Azure AD token.
   */
  private async makeRequest<T>(
    method: string,
    body?: unknown,
    contentType?: string
  ): Promise<T> {
    const url = `${this.endpoint}/contentunderstanding/defaults?api-version=${API_VERSION}`;

    const headers: Record<string, string> = {
      'Content-Type': contentType ?? 'application/json',
    };

    // Check for API key first (takes priority over Azure AD)
    const configService = getConfigService();
    const apiKey: string | undefined = configService.getApiKey();

    if (apiKey !== undefined && apiKey !== '') {
      headers['Ocp-Apim-Subscription-Key'] = apiKey;
    } else {
      const token = await this.getAccessToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Handles error responses from the API.
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: ApiError | undefined;
    try {
      errorData = (await response.json()) as ApiError;
    } catch {
      // Response body not JSON
    }

    const code = errorData?.error?.code ?? `HTTP${response.status}`;
    const message = errorData?.error?.message ?? response.statusText;

    // Check if API key was used for this request
    const configService = getConfigService();
    const apiKey: string | undefined = configService.getApiKey();
    const usingApiKey = apiKey !== undefined && apiKey !== '';

    switch (response.status) {
      case 401:
        if (usingApiKey) {
          throw new CliError(
            ErrorCodes.AUTH_FAILED,
            'Invalid API key',
            message,
            'Verify your API key is correct with `cu config show`, or update it with `cu config set --api-key <key>`'
          );
        }
        throw new CliError(
          ErrorCodes.AUTH_REQUIRED,
          'Authentication required',
          message,
          'Run `cu login` to authenticate'
        );
      case 403:
        throw new CliError(
          ErrorCodes.AUTH_REQUIRED,
          'Access denied',
          message,
          'Check your Azure permissions for this resource'
        );
      case 404:
        throw new CliError(
          ErrorCodes.RESOURCE_NOT_FOUND,
          'Resource not found',
          message,
          'Check that the endpoint is correct'
        );
      case 429:
        throw new CliError(
          ErrorCodes.API_RATE_LIMITED,
          'Rate limited',
          message,
          'Wait a moment and try again'
        );
      default:
        throw new CliError(
          ErrorCodes.API_ERROR,
          `API error: ${code}`,
          message,
          'Check the Azure portal for more details'
        );
    }
  }

  /**
   * Gets the current defaults configuration.
   */
  async getDefaults(): Promise<ContentUnderstandingDefaults> {
    const response = await this.makeRequest<DefaultsApiResponse>('GET');

    return {
      modelDeployments: response.modelDeployments ?? {},
    };
  }

  /**
   * Updates the defaults configuration (merge-patch).
   * Only specified model mappings are updated; others are preserved.
   * To remove a mapping, set its value to null in the request.
   */
  async updateDefaults(request: UpdateDefaultsRequest): Promise<ContentUnderstandingDefaults> {
    const response = await this.makeRequest<DefaultsApiResponse>(
      'PATCH',
      request,
      'application/merge-patch+json'
    );

    return {
      modelDeployments: response.modelDeployments ?? {},
    };
  }

  /**
   * Sets a single model deployment mapping.
   * @param modelName - The model name (e.g., "gpt-4.1")
   * @param deploymentName - The deployment name to map to
   */
  async setModelDeployment(modelName: string, deploymentName: string): Promise<ContentUnderstandingDefaults> {
    return this.updateDefaults({
      modelDeployments: {
        [modelName]: deploymentName,
      },
    });
  }

  /**
   * Removes a model deployment mapping.
   * Note: This sets the mapping to null via merge-patch to remove it.
   * @param modelName - The model name to remove
   */
  async removeModelDeployment(modelName: string): Promise<ContentUnderstandingDefaults> {
    // Use merge-patch with null value to remove
    const response = await this.makeRequest<DefaultsApiResponse>(
      'PATCH',
      {
        modelDeployments: {
          [modelName]: null,
        },
      },
      'application/merge-patch+json'
    );

    return {
      modelDeployments: response.modelDeployments ?? {},
    };
  }
}

/**
 * Singleton instance.
 */
let defaultsManagerInstance: DefaultsManager | null = null;

/**
 * Gets the DefaultsManager instance.
 * Creates a new instance if one doesn't exist.
 */
export function getDefaultsManager(): DefaultsManager {
  if (defaultsManagerInstance === null) {
    const configService = getConfigService();
    const activeProfile = configService.getActiveProfile();

    defaultsManagerInstance = new DefaultsManager(activeProfile.profile.endpoint);
  }

  return defaultsManagerInstance;
}

/**
 * Resets the DefaultsManager instance.
 * Useful for testing.
 */
export function resetDefaultsManager(): void {
  defaultsManagerInstance = null;
}
