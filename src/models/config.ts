/**
 * Configuration types for the Azure CU CLI.
 * Defines profile-based configuration for targeting different Azure resources.
 */

/**
 * A named configuration profile for an Azure CU resource.
 * Multiple profiles enable dev/staging/prod switching.
 */
export interface ConfigProfile {
  /** Azure CU resource endpoint (e.g., https://my-resource.cognitiveservices.azure.com) */
  endpoint: string;

  /** Azure subscription ID (optional, for resource management) */
  subscriptionId?: string;

  /** Resource group name (optional, for BYOC operations) */
  resourceGroup?: string;

  /** Resource name (optional, for BYOC operations) */
  resourceName?: string;
}

/**
 * Root configuration stored in ~/.cu/config.json
 */
export interface AppConfig {
  /** Config file schema version */
  version: '1';

  /** Name of the currently active profile */
  activeProfile: string;

  /** Map of profile name → profile configuration */
  profiles: Record<string, ConfigProfile>;
}

/**
 * Default configuration for new installations.
 */
export const DEFAULT_CONFIG: AppConfig = {
  version: '1',
  activeProfile: '',
  profiles: {},
};

/**
 * Default profile name.
 */
export const DEFAULT_PROFILE_NAME = 'default';
