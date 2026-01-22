/**
 * Validation utilities for CLI inputs.
 * Provides URL and file path validation with detailed error messages.
 */

import { existsSync, statSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';

/**
 * Result of a validation operation.
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Normalized/cleaned value if validation passed */
  normalizedValue?: string;
}

/**
 * Validates that a URL is a valid HTTPS URL for Azure CU endpoints.
 * @param url - The URL to validate
 * @returns Validation result with normalized URL
 */
export function validateUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      error: 'URL is required',
    };
  }

  const trimmedUrl = url.trim();

  // Check if it looks like a URL
  if (!trimmedUrl.includes('://') && !trimmedUrl.startsWith('//')) {
    // Try adding https:// prefix
    return validateUrl(`https://${trimmedUrl}`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return {
      valid: false,
      error: `Invalid URL format: ${url}`,
    };
  }

  // Only HTTPS is allowed for Azure endpoints
  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: `URL must use HTTPS protocol, got: ${parsed.protocol}`,
    };
  }

  // Validate hostname
  if (!parsed.hostname || parsed.hostname.length === 0) {
    return {
      valid: false,
      error: 'URL must have a valid hostname',
    };
  }

  // Normalize: remove trailing slash, lowercase hostname
  const normalizedUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, '')}`;

  return {
    valid: true,
    normalizedValue: normalizedUrl,
  };
}

/**
 * Validates that a file path points to an existing file.
 * @param filePath - The file path to validate
 * @returns Validation result with absolute path
 */
export function validateFilePath(filePath: string): ValidationResult {
  if (!filePath || typeof filePath !== 'string') {
    return {
      valid: false,
      error: 'File path is required',
    };
  }

  const trimmedPath = filePath.trim();

  if (trimmedPath.length === 0) {
    return {
      valid: false,
      error: 'File path cannot be empty',
    };
  }

  // Resolve to absolute path
  const absolutePath = isAbsolute(trimmedPath) ? trimmedPath : resolve(process.cwd(), trimmedPath);

  // Check if file exists
  if (!existsSync(absolutePath)) {
    return {
      valid: false,
      error: `File not found: ${absolutePath}`,
    };
  }

  // Check if it's actually a file (not a directory)
  const stats = statSync(absolutePath);
  if (!stats.isFile()) {
    return {
      valid: false,
      error: `Path is not a file: ${absolutePath}`,
    };
  }

  return {
    valid: true,
    normalizedValue: absolutePath,
  };
}

/**
 * Validates that a directory path points to an existing directory.
 * @param dirPath - The directory path to validate
 * @returns Validation result with absolute path
 */
export function validateDirectoryPath(dirPath: string): ValidationResult {
  if (!dirPath || typeof dirPath !== 'string') {
    return {
      valid: false,
      error: 'Directory path is required',
    };
  }

  const trimmedPath = dirPath.trim();

  if (trimmedPath.length === 0) {
    return {
      valid: false,
      error: 'Directory path cannot be empty',
    };
  }

  // Resolve to absolute path
  const absolutePath = isAbsolute(trimmedPath) ? trimmedPath : resolve(process.cwd(), trimmedPath);

  // Check if directory exists
  if (!existsSync(absolutePath)) {
    return {
      valid: false,
      error: `Directory not found: ${absolutePath}`,
    };
  }

  // Check if it's actually a directory
  const stats = statSync(absolutePath);
  if (!stats.isDirectory()) {
    return {
      valid: false,
      error: `Path is not a directory: ${absolutePath}`,
    };
  }

  return {
    valid: true,
    normalizedValue: absolutePath,
  };
}

/**
 * Supported document file extensions for analysis.
 */
export const SUPPORTED_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.tiff',
  '.tif',
  '.bmp',
  '.heif',
  '.docx',
  '.xlsx',
  '.pptx',
  '.html',
] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/**
 * Validates that a file has a supported extension for document analysis.
 * @param filePath - The file path to check
 * @returns Validation result
 */
export function validateSupportedFileType(filePath: string): ValidationResult {
  const extension = filePath.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';

  if (!SUPPORTED_EXTENSIONS.includes(extension as SupportedExtension)) {
    return {
      valid: false,
      error: `Unsupported file type: ${extension || '(no extension)'}\nSupported types: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    };
  }

  return {
    valid: true,
    normalizedValue: extension,
  };
}

/**
 * Validates an Azure profile name.
 * Profile names must be alphanumeric with hyphens/underscores, 1-64 chars.
 * @param name - The profile name to validate
 * @returns Validation result
 */
export function validateProfileName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return {
      valid: false,
      error: 'Profile name is required',
    };
  }

  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return {
      valid: false,
      error: 'Profile name cannot be empty',
    };
  }

  if (trimmedName.length > 64) {
    return {
      valid: false,
      error: 'Profile name must be 64 characters or less',
    };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
    return {
      valid: false,
      error: 'Profile name can only contain letters, numbers, hyphens, and underscores',
    };
  }

  return {
    valid: true,
    normalizedValue: trimmedName,
  };
}
