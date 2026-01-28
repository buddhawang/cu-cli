/**
 * Configuration service for managing CLI profiles.
 * Handles reading/writing config.json and profile management.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {
  type AppConfig,
  type ConfigProfile,
  DEFAULT_CONFIG,
} from '../models/config.js';
import { CliError, ErrorCodes } from '../lib/errors.js';
import { validateUrl } from '../lib/validation.js';

/**
 * Gets the configuration file path.
 * Uses CU_CONFIG_DIR environment variable if set, otherwise defaults to ~/.cu.
 * This is evaluated at runtime to respect environment changes.
 */
function getConfigFilePath(): string {
  const configDir = process.env['CU_CONFIG_DIR'] ?? path.join(os.homedir(), '.cu');
  return path.join(configDir, 'config.json');
}

/**
 * Configuration service for managing CLI profiles.
 */
export class ConfigService {
  private config: AppConfig | null = null;
  private configPath: string;

  /**
   * Creates a ConfigService instance.
   * @param configPath - Optional custom config file path (for testing)
   */
  constructor(configPath?: string) {
    this.configPath = configPath ?? getConfigFilePath();
  }

  /**
   * Loads configuration from disk.
   * Creates default config if file doesn't exist.
   * @returns The loaded configuration
   */
  loadConfig(): AppConfig {
    if (this.config !== null) {
      return this.config;
    }

    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data) as unknown;
        
        // Validate basic structure
        if (!this.isValidConfig(parsed)) {
          throw new CliError(
            ErrorCodes.CONFIG_INVALID,
            'Invalid configuration file',
            'The configuration file has an invalid structure',
            `Delete ${this.configPath} and run \`cu config set\` to create a new one`
          );
        }
        
        this.config = parsed;
        return this.config;
      }
    } catch (error) {
      if (error instanceof CliError) {
        throw error;
      }
      // JSON parse error or other issues - start fresh
    }

    // Return default config (but don't save until explicitly requested)
    // Deep copy to avoid mutating the constant
    this.config = {
      version: DEFAULT_CONFIG.version,
      activeProfile: DEFAULT_CONFIG.activeProfile,
      profiles: { ...DEFAULT_CONFIG.profiles },
    };
    return this.config;
  }

  /**
   * Saves configuration to disk.
   */
  saveConfig(): void {
    if (this.config === null) {
      throw new CliError(
        ErrorCodes.CONFIG_INVALID,
        'No configuration to save',
        'Configuration has not been loaded or created',
        'Run `cu config set` to create a configuration'
      );
    }

    try {
      // Ensure directory exists
      if (!fs.existsSync(path.dirname(this.configPath))) {
        fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
      }
      
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new CliError(
        ErrorCodes.CONFIG_INVALID,
        'Failed to save configuration',
        message,
        'Check file permissions and disk space'
      );
    }
  }

  /**
   * Sets or updates a configuration profile.
   * @param profileName - Name of the profile to set
   * @param profile - Profile configuration
   * @param options - Optional settings like apiKey
   */
  setProfile(profileName: string, profile: ConfigProfile, options?: { apiKey?: string }): void {
    // Validate endpoint
    const validation = validateUrl(profile.endpoint);
    if (!validation.valid) {
      throw new CliError(
        ErrorCodes.INVALID_URL,
        'Invalid endpoint URL',
        validation.error ?? `The endpoint "${profile.endpoint}" is not a valid HTTPS URL`,
        'Provide a valid HTTPS URL (e.g., https://my-resource.cognitiveservices.azure.com)'
      );
    }

    // Use normalized URL
    profile.endpoint = validation.normalizedValue ?? profile.endpoint;

    // Handle API key
    if (options?.apiKey !== undefined) {
      if (options.apiKey === '') {
        // Empty string means remove the API key
        delete profile.apiKey;
      } else {
        profile.apiKey = options.apiKey;
      }
    }

    const config = this.loadConfig();
    
    // Add or update the profile
    config.profiles[profileName] = profile;
    
    // If this is the first profile or there's no active profile, make it active
    if (config.activeProfile === '' || Object.keys(config.profiles).length === 1) {
      config.activeProfile = profileName;
    }
    
    this.config = config;
    this.saveConfig();
  }

  /**
   * Switches the active profile.
   * @param profileName - Name of the profile to activate
   */
  useProfile(profileName: string): void {
    const config = this.loadConfig();
    
    if (config.profiles[profileName] === undefined) {
      const availableProfiles = Object.keys(config.profiles);
      const suggestion = availableProfiles.length > 0
        ? `Available profiles: ${availableProfiles.join(', ')}`
        : 'No profiles configured. Run `cu config set --endpoint <url>` first';
      
      throw new CliError(
        ErrorCodes.PROFILE_NOT_FOUND,
        `Profile '${profileName}' not found`,
        'The specified profile does not exist in the configuration',
        suggestion,
        2
      );
    }
    
    config.activeProfile = profileName;
    this.config = config;
    this.saveConfig();
  }

  /**
   * Gets the currently active profile.
   * @returns The active profile and its name
   * @throws CliError if no configuration or active profile exists
   */
  getActiveProfile(): { name: string; profile: ConfigProfile } {
    const config = this.loadConfig();
    
    if (config.activeProfile === '' || Object.keys(config.profiles).length === 0) {
      throw new CliError(
        ErrorCodes.CONFIG_NOT_FOUND,
        'No configuration found',
        'No configuration profiles have been set up',
        'Run `cu config set --endpoint <url>` to configure your Azure CU resource',
        2
      );
    }
    
    const profile = config.profiles[config.activeProfile];
    if (profile === undefined) {
      throw new CliError(
        ErrorCodes.CONFIG_INVALID,
        'Active profile not found',
        `The active profile '${config.activeProfile}' does not exist in configuration`,
        'Run `cu config list` to see available profiles and `cu config use <profile>` to switch'
      );
    }
    
    return {
      name: config.activeProfile,
      profile,
    };
  }

  /**
   * Lists all configured profiles.
   * @returns Array of profile names with their configurations
   */
  listProfiles(): Array<{ name: string; profile: ConfigProfile; isActive: boolean }> {
    const config = this.loadConfig();
    
    return Object.entries(config.profiles).map(([name, profile]) => ({
      name,
      profile,
      isActive: name === config.activeProfile,
    }));
  }

  /**
   * Gets a specific profile by name.
   * @param profileName - Name of the profile to get
   * @returns The profile configuration or undefined if not found
   */
  getProfile(profileName: string): ConfigProfile | undefined {
    const config = this.loadConfig();
    return config.profiles[profileName];
  }

  /**
   * Gets the API key from the active profile.
   * @returns The API key or undefined if not configured
   */
  getApiKey(): string | undefined {
    try {
      const { profile } = this.getActiveProfile();
      return profile.apiKey;
    } catch {
      return undefined;
    }
  }

  /**
   * Updates the API key for a profile.
   * @param profileName - Name of the profile to update
   * @param apiKey - API key to set, or empty string to remove
   */
  updateProfileApiKey(profileName: string, apiKey: string): void {
    const config = this.loadConfig();
    
    const profile = config.profiles[profileName];
    if (profile === undefined) {
      throw new CliError(
        ErrorCodes.PROFILE_NOT_FOUND,
        `Profile '${profileName}' not found`,
        'Cannot update API key for a profile that does not exist',
        'Run `cu config list` to see available profiles',
        2
      );
    }
    
    if (apiKey === '') {
      // Remove API key
      delete profile.apiKey;
    } else {
      profile.apiKey = apiKey;
    }
    
    this.config = config;
    this.saveConfig();
  }

  /**
   * Deletes a profile.
   * @param profileName - Name of the profile to delete
   */
  deleteProfile(profileName: string): void {
    const config = this.loadConfig();
    
    if (config.profiles[profileName] === undefined) {
      throw new CliError(
        ErrorCodes.PROFILE_NOT_FOUND,
        `Profile '${profileName}' not found`,
        'Cannot delete a profile that does not exist',
        'Run `cu config list` to see available profiles',
        2
      );
    }
    
    // Don't allow deleting the active profile if it's the only one
    if (config.activeProfile === profileName && Object.keys(config.profiles).length === 1) {
      throw new CliError(
        ErrorCodes.CONFIG_INVALID,
        'Cannot delete the only profile',
        'You must have at least one configuration profile',
        'Create another profile first, then delete this one'
      );
    }
    
    delete config.profiles[profileName];
    
    // If we deleted the active profile, switch to another one
    if (config.activeProfile === profileName) {
      const remaining = Object.keys(config.profiles);
      config.activeProfile = remaining[0] ?? '';
    }
    
    this.config = config;
    this.saveConfig();
  }

  /**
   * Checks if configuration exists and has at least one profile.
   */
  hasConfig(): boolean {
    try {
      const config = this.loadConfig();
      return Object.keys(config.profiles).length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Validates that an object is a valid AppConfig.
   */
  private isValidConfig(obj: unknown): obj is AppConfig {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    
    const config = obj as Record<string, unknown>;
    
    return (
      config['version'] === '1' &&
      typeof config['activeProfile'] === 'string' &&
      typeof config['profiles'] === 'object' &&
      config['profiles'] !== null
    );
  }
}

// Singleton instance for shared use
let configServiceInstance: ConfigService | null = null;

/**
 * Gets the shared ConfigService instance.
 * @param configPath - Optional custom config file path (for testing)
 */
export function getConfigService(configPath?: string): ConfigService {
  if (configServiceInstance === null || configPath !== undefined) {
    configServiceInstance = new ConfigService(configPath);
  }
  return configServiceInstance;
}

/**
 * Resets the singleton instance (for testing).
 */
export function resetConfigService(): void {
  configServiceInstance = null;
}
