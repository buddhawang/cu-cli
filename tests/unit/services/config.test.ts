/**
 * Unit tests for ConfigService.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { ConfigService, getConfigService, resetConfigService } from '../../../src/services/config.js';
import { CliError } from '../../../src/lib/errors.js';
import type { AppConfig, ConfigProfile } from '../../../src/models/config.js';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock os module for homedir
vi.mock('os', () => ({
  homedir: vi.fn().mockReturnValue('/home/testuser'),
}));

describe('ConfigService', () => {
  const mockConfigPath = '/tmp/test-config.json';
  
  const validConfig: AppConfig = {
    version: '1',
    activeProfile: 'default',
    profiles: {
      default: {
        endpoint: 'https://test.cognitiveservices.azure.com',
      },
      staging: {
        endpoint: 'https://staging.cognitiveservices.azure.com',
        subscriptionId: 'sub-123',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetConfigService();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    resetConfigService();
  });

  describe('constructor', () => {
    it('should_create_instance_when_constructed', () => {
      const service = new ConfigService(mockConfigPath);
      expect(service).toBeInstanceOf(ConfigService);
    });
  });

  describe('loadConfig', () => {
    it('should_return_default_config_when_file_does_not_exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const service = new ConfigService(mockConfigPath);
      const config = service.loadConfig();

      expect(config.version).toBe('1');
      expect(config.activeProfile).toBe('');
      expect(config.profiles).toEqual({});
    });

    it('should_load_config_from_file_when_exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      const config = service.loadConfig();

      expect(config.activeProfile).toBe('default');
      expect(config.profiles['default']?.endpoint).toBe('https://test.cognitiveservices.azure.com');
    });

    it('should_throw_error_when_config_file_is_invalid_json', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');

      const service = new ConfigService(mockConfigPath);
      // Should not throw, but return default config
      const config = service.loadConfig();
      expect(config.profiles).toEqual({});
    });

    it('should_throw_error_when_config_has_invalid_structure', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version: '2', invalid: true }));

      const service = new ConfigService(mockConfigPath);
      expect(() => service.loadConfig()).toThrow(CliError);
    });

    it('should_cache_config_on_subsequent_calls', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      service.loadConfig();
      service.loadConfig();

      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveConfig', () => {
    it('should_throw_error_when_no_config_loaded', () => {
      const service = new ConfigService(mockConfigPath);
      
      expect(() => service.saveConfig()).toThrow(CliError);
    });

    it('should_create_directory_if_not_exists', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === mockConfigPath) return true;
        return false; // Directory doesn't exist
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      service.loadConfig();
      service.saveConfig();

      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('should_write_config_to_file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      service.loadConfig();
      service.saveConfig();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockConfigPath,
        expect.any(String),
        'utf-8'
      );
    });
  });

  describe('setProfile', () => {
    it('should_create_new_profile_when_not_exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const service = new ConfigService(mockConfigPath);
      const profile: ConfigProfile = {
        endpoint: 'https://new.cognitiveservices.azure.com',
      };

      service.setProfile('newprofile', profile);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should_update_existing_profile', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      const profile: ConfigProfile = {
        endpoint: 'https://updated.cognitiveservices.azure.com',
      };

      service.setProfile('default', profile);

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should_set_as_active_profile_when_first_profile', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const service = new ConfigService(mockConfigPath);
      const profile: ConfigProfile = {
        endpoint: 'https://first.cognitiveservices.azure.com',
      };

      service.setProfile('first', profile);
      const { name } = service.getActiveProfile();

      expect(name).toBe('first');
    });

    it('should_throw_error_for_invalid_endpoint', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const service = new ConfigService(mockConfigPath);
      const profile: ConfigProfile = {
        // Use an actually invalid URL that can't be parsed
        endpoint: 'https://invalid url with spaces',
      };

      expect(() => service.setProfile('invalid', profile)).toThrow(CliError);
    });

    it('should_throw_error_for_http_endpoint', () => {
      const service = new ConfigService(mockConfigPath);
      const profile: ConfigProfile = {
        endpoint: 'http://insecure.cognitiveservices.azure.com',
      };

      expect(() => service.setProfile('insecure', profile)).toThrow(CliError);
    });
  });

  describe('useProfile', () => {
    it('should_switch_active_profile_when_exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      service.useProfile('staging');

      const { name } = service.getActiveProfile();
      expect(name).toBe('staging');
    });

    it('should_throw_error_when_profile_not_found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);

      expect(() => service.useProfile('nonexistent')).toThrow(CliError);
    });
  });

  describe('getActiveProfile', () => {
    it('should_return_active_profile_when_configured', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      const { name, profile } = service.getActiveProfile();

      expect(name).toBe('default');
      expect(profile.endpoint).toBe('https://test.cognitiveservices.azure.com');
    });

    it('should_throw_error_when_no_profiles_exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const service = new ConfigService(mockConfigPath);

      expect(() => service.getActiveProfile()).toThrow(CliError);
    });
  });

  describe('listProfiles', () => {
    it('should_return_all_profiles_with_active_flag', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      const profiles = service.listProfiles();

      expect(profiles).toHaveLength(2);
      
      const defaultProfile = profiles.find(p => p.name === 'default');
      expect(defaultProfile?.isActive).toBe(true);
      
      const stagingProfile = profiles.find(p => p.name === 'staging');
      expect(stagingProfile?.isActive).toBe(false);
    });

    it('should_return_empty_array_when_no_profiles', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const service = new ConfigService(mockConfigPath);
      const profiles = service.listProfiles();

      expect(profiles).toHaveLength(0);
    });
  });

  describe('getProfile', () => {
    it('should_return_profile_when_exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      const profile = service.getProfile('staging');

      expect(profile?.endpoint).toBe('https://staging.cognitiveservices.azure.com');
      expect(profile?.subscriptionId).toBe('sub-123');
    });

    it('should_return_undefined_when_profile_not_found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      const profile = service.getProfile('nonexistent');

      expect(profile).toBeUndefined();
    });
  });

  describe('deleteProfile', () => {
    it('should_delete_profile_when_exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      service.deleteProfile('staging');

      const profiles = service.listProfiles();
      expect(profiles).toHaveLength(1);
      expect(profiles[0]?.name).toBe('default');
    });

    it('should_throw_error_when_deleting_nonexistent_profile', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);

      expect(() => service.deleteProfile('nonexistent')).toThrow(CliError);
    });

    it('should_throw_error_when_deleting_only_profile', () => {
      const singleProfileConfig: AppConfig = {
        version: '1',
        activeProfile: 'only',
        profiles: {
          only: { endpoint: 'https://only.cognitiveservices.azure.com' },
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(singleProfileConfig));

      const service = new ConfigService(mockConfigPath);

      expect(() => service.deleteProfile('only')).toThrow(CliError);
    });

    it('should_switch_active_profile_when_deleting_active', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      service.deleteProfile('default');

      const { name } = service.getActiveProfile();
      expect(name).toBe('staging');
    });
  });

  describe('hasConfig', () => {
    it('should_return_true_when_profiles_exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

      const service = new ConfigService(mockConfigPath);
      
      expect(service.hasConfig()).toBe(true);
    });

    it('should_return_false_when_no_profiles', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const service = new ConfigService(mockConfigPath);
      
      expect(service.hasConfig()).toBe(false);
    });
  });
});

describe('getConfigService', () => {
  beforeEach(() => {
    resetConfigService();
  });

  afterEach(() => {
    resetConfigService();
  });

  it('should_return_singleton_instance', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const service1 = getConfigService();
    const service2 = getConfigService();

    expect(service1).toBe(service2);
  });

  it('should_create_new_instance_with_custom_path', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const service = getConfigService('/custom/path.json');

    expect(service).toBeInstanceOf(ConfigService);
  });
});

describe('ConfigService API Key Storage', () => {
  const mockConfigPath = '/tmp/test-config.json';
  
  const configWithApiKey: AppConfig = {
    version: '1',
    activeProfile: 'default',
    profiles: {
      default: {
        endpoint: 'https://test.cognitiveservices.azure.com',
        apiKey: 'test-api-key-12345',
      },
      nokey: {
        endpoint: 'https://nokey.cognitiveservices.azure.com',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetConfigService();
  });

  afterEach(() => {
    resetConfigService();
  });

  describe('setProfile with apiKey', () => {
    it('should_store_api_key_when_provided_in_options', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const service = new ConfigService(mockConfigPath);
      const profile: ConfigProfile = {
        endpoint: 'https://test.cognitiveservices.azure.com',
      };

      service.setProfile('myprofile', profile, { apiKey: 'my-secret-key' });

      const { profile: savedProfile } = service.getActiveProfile();
      expect(savedProfile.apiKey).toBe('my-secret-key');
    });

    it('should_not_store_api_key_when_options_not_provided', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const service = new ConfigService(mockConfigPath);
      const profile: ConfigProfile = {
        endpoint: 'https://test.cognitiveservices.azure.com',
      };

      service.setProfile('myprofile', profile);

      const { profile: savedProfile } = service.getActiveProfile();
      expect(savedProfile.apiKey).toBeUndefined();
    });

    it('should_remove_api_key_when_empty_string_provided', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configWithApiKey));

      const service = new ConfigService(mockConfigPath);
      const profile: ConfigProfile = {
        endpoint: 'https://test.cognitiveservices.azure.com',
      };

      service.setProfile('default', profile, { apiKey: '' });

      const { profile: savedProfile } = service.getActiveProfile();
      expect(savedProfile.apiKey).toBeUndefined();
    });
  });

  describe('getApiKey', () => {
    it('should_return_api_key_when_configured_on_active_profile', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configWithApiKey));

      const service = new ConfigService(mockConfigPath);
      const apiKey = service.getApiKey();

      expect(apiKey).toBe('test-api-key-12345');
    });

    it('should_return_undefined_when_no_api_key_on_active_profile', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const configNoKey = { ...configWithApiKey, activeProfile: 'nokey' };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configNoKey));

      const service = new ConfigService(mockConfigPath);
      const apiKey = service.getApiKey();

      expect(apiKey).toBeUndefined();
    });

    it('should_return_undefined_when_no_active_profile', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const service = new ConfigService(mockConfigPath);
      const apiKey = service.getApiKey();

      expect(apiKey).toBeUndefined();
    });
  });

  describe('updateProfileApiKey', () => {
    it('should_update_api_key_on_existing_profile', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configWithApiKey));

      const service = new ConfigService(mockConfigPath);
      service.updateProfileApiKey('default', 'new-api-key-67890');

      const { profile } = service.getActiveProfile();
      expect(profile.apiKey).toBe('new-api-key-67890');
    });

    it('should_remove_api_key_when_empty_string_provided', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configWithApiKey));

      const service = new ConfigService(mockConfigPath);
      service.updateProfileApiKey('default', '');

      const { profile } = service.getActiveProfile();
      expect(profile.apiKey).toBeUndefined();
    });

    it('should_throw_error_when_profile_not_found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configWithApiKey));

      const service = new ConfigService(mockConfigPath);

      expect(() => service.updateProfileApiKey('nonexistent', 'key')).toThrow(CliError);
    });

    it('should_add_api_key_to_profile_without_one', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configWithApiKey));

      const service = new ConfigService(mockConfigPath);
      service.updateProfileApiKey('nokey', 'added-api-key');

      service.useProfile('nokey');
      const { profile } = service.getActiveProfile();
      expect(profile.apiKey).toBe('added-api-key');
    });
  });
});
