/**
 * Unit tests for validation utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateUrl,
  validateFilePath,
  validateDirectoryPath,
  validateSupportedFileType,
  validateProfileName,
  SUPPORTED_EXTENSIONS,
} from '../../../src/lib/validation.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

describe('validateUrl', () => {
  it('should_return_valid_when_https_url_provided', () => {
    const result = validateUrl('https://my-resource.cognitiveservices.azure.com');

    expect(result.valid).toBe(true);
    expect(result.normalizedValue).toBe('https://my-resource.cognitiveservices.azure.com');
  });

  it('should_normalize_url_by_removing_trailing_slash_when_present', () => {
    const result = validateUrl('https://my-resource.cognitiveservices.azure.com/');

    expect(result.valid).toBe(true);
    expect(result.normalizedValue).toBe('https://my-resource.cognitiveservices.azure.com');
  });

  it('should_add_https_prefix_when_protocol_missing', () => {
    const result = validateUrl('my-resource.cognitiveservices.azure.com');

    expect(result.valid).toBe(true);
    expect(result.normalizedValue).toContain('https://');
  });

  it('should_return_invalid_when_http_url_provided', () => {
    const result = validateUrl('http://my-resource.cognitiveservices.azure.com');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('HTTPS');
  });

  it('should_return_invalid_when_malformed_url_provided', () => {
    const result = validateUrl('not a valid url at all');

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should_return_invalid_when_empty_string_provided', () => {
    const result = validateUrl('');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('should_return_invalid_when_null_or_undefined_provided', () => {
    const result1 = validateUrl(null as unknown as string);
    const result2 = validateUrl(undefined as unknown as string);

    expect(result1.valid).toBe(false);
    expect(result2.valid).toBe(false);
  });

  it('should_preserve_path_in_url_when_present', () => {
    const result = validateUrl('https://my-resource.azure.com/content-understanding/v1');

    expect(result.valid).toBe(true);
    expect(result.normalizedValue).toBe('https://my-resource.azure.com/content-understanding/v1');
  });
});

describe('validateFilePath', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should_return_valid_when_file_exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);

    const result = validateFilePath('/path/to/document.pdf');

    expect(result.valid).toBe(true);
    expect(result.normalizedValue).toBeDefined();
  });

  it('should_return_absolute_path_as_normalizedValue_when_valid', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);

    const result = validateFilePath('/absolute/path/to/file.pdf');

    expect(result.valid).toBe(true);
    expect(path.isAbsolute(result.normalizedValue ?? '')).toBe(true);
  });

  it('should_return_invalid_when_file_does_not_exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = validateFilePath('/path/to/nonexistent.pdf');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should_return_invalid_when_path_is_directory', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false } as fs.Stats);

    const result = validateFilePath('/path/to/directory');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not a file');
  });

  it('should_return_invalid_when_empty_string_provided', () => {
    const result = validateFilePath('');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('should_return_invalid_when_null_or_undefined_provided', () => {
    const result1 = validateFilePath(null as unknown as string);
    const result2 = validateFilePath(undefined as unknown as string);

    expect(result1.valid).toBe(false);
    expect(result2.valid).toBe(false);
  });
});

describe('validateDirectoryPath', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should_return_valid_when_directory_exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);

    const result = validateDirectoryPath('/path/to/directory');

    expect(result.valid).toBe(true);
    expect(result.normalizedValue).toBeDefined();
  });

  it('should_return_invalid_when_directory_does_not_exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = validateDirectoryPath('/path/to/nonexistent');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should_return_invalid_when_path_is_file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as fs.Stats);

    const result = validateDirectoryPath('/path/to/file.txt');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not a directory');
  });
});

describe('validateSupportedFileType', () => {
  it('should_return_valid_for_pdf_files', () => {
    const result = validateSupportedFileType('/path/to/document.pdf');

    expect(result.valid).toBe(true);
    expect(result.normalizedValue).toBe('.pdf');
  });

  it('should_return_valid_for_image_files', () => {
    expect(validateSupportedFileType('image.png').valid).toBe(true);
    expect(validateSupportedFileType('image.jpg').valid).toBe(true);
    expect(validateSupportedFileType('image.jpeg').valid).toBe(true);
    expect(validateSupportedFileType('image.tiff').valid).toBe(true);
    expect(validateSupportedFileType('image.bmp').valid).toBe(true);
  });

  it('should_return_valid_for_office_files', () => {
    expect(validateSupportedFileType('document.docx').valid).toBe(true);
    expect(validateSupportedFileType('spreadsheet.xlsx').valid).toBe(true);
    expect(validateSupportedFileType('presentation.pptx').valid).toBe(true);
  });

  it('should_return_valid_for_html_files', () => {
    const result = validateSupportedFileType('page.html');

    expect(result.valid).toBe(true);
    expect(result.normalizedValue).toBe('.html');
  });

  it('should_be_case_insensitive_when_checking_extension', () => {
    expect(validateSupportedFileType('document.PDF').valid).toBe(true);
    expect(validateSupportedFileType('image.PNG').valid).toBe(true);
    expect(validateSupportedFileType('doc.DOCX').valid).toBe(true);
  });

  it('should_return_invalid_for_unsupported_extensions', () => {
    const result = validateSupportedFileType('video.mp4');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unsupported file type');
    expect(result.error).toContain('.mp4');
  });

  it('should_return_invalid_for_files_without_extension', () => {
    const result = validateSupportedFileType('noextension');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('no extension');
  });

  it('should_list_supported_extensions_in_error_message', () => {
    const result = validateSupportedFileType('file.xyz');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('.pdf');
    expect(result.error).toContain('.png');
  });
});

describe('validateProfileName', () => {
  it('should_return_valid_for_alphanumeric_names', () => {
    const result = validateProfileName('default');

    expect(result.valid).toBe(true);
    expect(result.normalizedValue).toBe('default');
  });

  it('should_return_valid_for_names_with_hyphens', () => {
    const result = validateProfileName('my-profile');

    expect(result.valid).toBe(true);
  });

  it('should_return_valid_for_names_with_underscores', () => {
    const result = validateProfileName('my_profile');

    expect(result.valid).toBe(true);
  });

  it('should_return_valid_for_names_with_numbers', () => {
    const result = validateProfileName('profile123');

    expect(result.valid).toBe(true);
  });

  it('should_trim_whitespace_from_name_when_provided', () => {
    const result = validateProfileName('  myprofile  ');

    expect(result.valid).toBe(true);
    expect(result.normalizedValue).toBe('myprofile');
  });

  it('should_return_invalid_for_empty_string', () => {
    const result = validateProfileName('');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  it('should_return_invalid_for_names_with_spaces', () => {
    const result = validateProfileName('my profile');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('letters, numbers, hyphens, and underscores');
  });

  it('should_return_invalid_for_names_with_special_characters', () => {
    expect(validateProfileName('profile!').valid).toBe(false);
    expect(validateProfileName('profile@name').valid).toBe(false);
    expect(validateProfileName('profile.name').valid).toBe(false);
  });

  it('should_return_invalid_for_names_over_64_characters', () => {
    const longName = 'a'.repeat(65);
    const result = validateProfileName(longName);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('64 characters');
  });

  it('should_return_valid_for_names_exactly_64_characters', () => {
    const exactName = 'a'.repeat(64);
    const result = validateProfileName(exactName);

    expect(result.valid).toBe(true);
  });
});

describe('SUPPORTED_EXTENSIONS', () => {
  it('should_include_common_document_types', () => {
    expect(SUPPORTED_EXTENSIONS).toContain('.pdf');
    expect(SUPPORTED_EXTENSIONS).toContain('.docx');
    expect(SUPPORTED_EXTENSIONS).toContain('.xlsx');
    expect(SUPPORTED_EXTENSIONS).toContain('.pptx');
  });

  it('should_include_common_image_types', () => {
    expect(SUPPORTED_EXTENSIONS).toContain('.png');
    expect(SUPPORTED_EXTENSIONS).toContain('.jpg');
    expect(SUPPORTED_EXTENSIONS).toContain('.jpeg');
    expect(SUPPORTED_EXTENSIONS).toContain('.tiff');
    expect(SUPPORTED_EXTENSIONS).toContain('.bmp');
  });
});
