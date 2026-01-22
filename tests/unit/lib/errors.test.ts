/**
 * Unit tests for CliError class and error utilities.
 */

import { describe, it, expect } from 'vitest';
import { CliError, ErrorCodes, Errors } from '../../../src/lib/errors.js';

describe('CliError', () => {
  describe('constructor', () => {
    it('should_create_error_with_all_properties_when_constructed', () => {
      const error = new CliError(
        'TEST_ERROR',
        'Test message',
        'Test reason',
        'Test fix',
        2
      );

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.why).toBe('Test reason');
      expect(error.fix).toBe('Test fix');
      expect(error.exitCode).toBe(2);
      expect(error.name).toBe('CliError');
    });

    it('should_default_exitCode_to_1_when_not_provided', () => {
      const error = new CliError(
        'TEST_ERROR',
        'Test message',
        'Test reason',
        'Test fix'
      );

      expect(error.exitCode).toBe(1);
    });

    it('should_be_instanceof_Error_when_checked', () => {
      const error = new CliError(
        'TEST_ERROR',
        'Test message',
        'Test reason',
        'Test fix'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CliError);
    });

    it('should_have_stack_trace_when_created', () => {
      const error = new CliError(
        'TEST_ERROR',
        'Test message',
        'Test reason',
        'Test fix'
      );

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('CliError');
    });
  });

  describe('format', () => {
    it('should_format_error_with_what_why_how_pattern_when_called', () => {
      const error = new CliError(
        'AUTH_REQUIRED',
        'Authentication required',
        'No cached credentials',
        'Run: cu login'
      );

      const formatted = error.format();

      expect(formatted).toContain('Error: Authentication required');
      expect(formatted).toContain('Why: No cached credentials');
      expect(formatted).toContain('Fix: Run: cu login');
    });

    it('should_include_empty_lines_for_readability_when_formatted', () => {
      const error = new CliError(
        'TEST',
        'Message',
        'Reason',
        'Fix'
      );

      const lines = error.format().split('\n');
      expect(lines.length).toBe(5);
      expect(lines[1]).toBe('');
      expect(lines[3]).toBe('');
    });
  });

  describe('toJSON', () => {
    it('should_return_object_with_all_properties_when_called', () => {
      const error = new CliError(
        'TEST_ERROR',
        'Test message',
        'Test reason',
        'Test fix',
        3
      );

      const json = error.toJSON();

      expect(json).toEqual({
        code: 'TEST_ERROR',
        message: 'Test message',
        why: 'Test reason',
        fix: 'Test fix',
        exitCode: 3,
      });
    });

    it('should_be_serializable_to_json_string_when_stringified', () => {
      const error = new CliError(
        'TEST_ERROR',
        'Test message',
        'Test reason',
        'Test fix'
      );

      const jsonString = JSON.stringify(error.toJSON());
      const parsed = JSON.parse(jsonString) as Record<string, unknown>;

      expect(parsed['code']).toBe('TEST_ERROR');
      expect(parsed['message']).toBe('Test message');
    });
  });
});

describe('ErrorCodes', () => {
  it('should_have_auth_error_codes_when_accessed', () => {
    expect(ErrorCodes.AUTH_REQUIRED).toBe('AUTH_REQUIRED');
    expect(ErrorCodes.AUTH_FAILED).toBe('AUTH_FAILED');
    expect(ErrorCodes.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');
  });

  it('should_have_config_error_codes_when_accessed', () => {
    expect(ErrorCodes.CONFIG_NOT_FOUND).toBe('CONFIG_NOT_FOUND');
    expect(ErrorCodes.PROFILE_NOT_FOUND).toBe('PROFILE_NOT_FOUND');
    expect(ErrorCodes.ENDPOINT_NOT_CONFIGURED).toBe('ENDPOINT_NOT_CONFIGURED');
  });

  it('should_have_api_error_codes_when_accessed', () => {
    expect(ErrorCodes.API_ERROR).toBe('API_ERROR');
    expect(ErrorCodes.API_TIMEOUT).toBe('API_TIMEOUT');
    expect(ErrorCodes.API_RATE_LIMITED).toBe('API_RATE_LIMITED');
  });
});

describe('Errors factory functions', () => {
  describe('authRequired', () => {
    it('should_create_auth_required_error_when_called', () => {
      const error = Errors.authRequired();

      expect(error.code).toBe('AUTH_REQUIRED');
      expect(error.message).toBe('Authentication required');
      expect(error.fix).toContain('cu login');
    });
  });

  describe('configNotFound', () => {
    it('should_create_config_not_found_error_when_called', () => {
      const error = Errors.configNotFound();

      expect(error.code).toBe('CONFIG_NOT_FOUND');
      expect(error.fix).toContain('cu config set');
    });
  });

  describe('profileNotFound', () => {
    it('should_include_profile_name_in_error_when_provided', () => {
      const error = Errors.profileNotFound('production');

      expect(error.code).toBe('PROFILE_NOT_FOUND');
      expect(error.message).toContain('production');
      expect(error.fix).toContain('production');
    });
  });

  describe('invalidUrl', () => {
    it('should_include_url_in_error_message_when_provided', () => {
      const error = Errors.invalidUrl('http://not-https.com');

      expect(error.code).toBe('INVALID_URL');
      expect(error.message).toContain('http://not-https.com');
    });
  });

  describe('fileNotFound', () => {
    it('should_include_path_in_error_message_when_provided', () => {
      const error = Errors.fileNotFound('/path/to/missing.pdf');

      expect(error.code).toBe('FILE_NOT_FOUND');
      expect(error.message).toContain('/path/to/missing.pdf');
    });
  });

  describe('apiError', () => {
    it('should_include_api_code_when_provided', () => {
      const error = Errors.apiError('Something went wrong', 'InvalidRequest');

      expect(error.code).toBe('API_ERROR');
      expect(error.why).toContain('InvalidRequest');
    });

    it('should_work_without_api_code_when_not_provided', () => {
      const error = Errors.apiError('Something went wrong');

      expect(error.code).toBe('API_ERROR');
      expect(error.message).toBe('Something went wrong');
    });
  });

  describe('analyzerNotFound', () => {
    it('should_include_analyzer_id_in_error_when_provided', () => {
      const error = Errors.analyzerNotFound('prebuilt-document');

      expect(error.code).toBe('ANALYZER_NOT_FOUND');
      expect(error.message).toContain('prebuilt-document');
      expect(error.fix).toContain('cu analyzer list');
    });
  });

  describe('operationCancelled', () => {
    it('should_create_cancellation_error_when_called', () => {
      const error = Errors.operationCancelled();

      expect(error.code).toBe('OPERATION_CANCELLED');
      expect(error.exitCode).toBe(1);
    });
  });
});
