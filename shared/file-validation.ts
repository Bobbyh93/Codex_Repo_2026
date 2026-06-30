/**
 * File validation utilities with magic bytes detection and comprehensive validation
 */

export interface FileValidationResult {
  isValid: boolean;
  detectedType?: string;
  errors: string[];
  warnings: string[];
  size: number;
  actualMimeType?: string;
}

export interface FileValidationConfig {
  maxSizeBytes: number;
  allowedTypes: string[];
  strictMagicBytes: boolean;
}

// Magic bytes for supported file types
const MAGIC_BYTES: Record<string, Array<{ signature: number[]; offset: number }>> = {
  pdf: [
    { signature: [0x25, 0x50, 0x44, 0x46], offset: 0 }, // %PDF
  ],
  docx: [
    { signature: [0x50, 0x4B, 0x03, 0x04], offset: 0 }, // ZIP header (DOCX is ZIP-based)
    { signature: [0x50, 0x4B, 0x05, 0x06], offset: 0 }, // ZIP central directory
    { signature: [0x50, 0x4B, 0x07, 0x08], offset: 0 }, // ZIP data descriptor
  ],
  pptx: [
    { signature: [0x50, 0x4B, 0x03, 0x04], offset: 0 }, // ZIP header (PPTX is ZIP-based)
    { signature: [0x50, 0x4B, 0x05, 0x06], offset: 0 }, // ZIP central directory  
    { signature: [0x50, 0x4B, 0x07, 0x08], offset: 0 }, // ZIP data descriptor
  ],
  zip: [
    { signature: [0x50, 0x4B, 0x03, 0x04], offset: 0 },
    { signature: [0x50, 0x4B, 0x05, 0x06], offset: 0 },
    { signature: [0x50, 0x4B, 0x07, 0x08], offset: 0 },
  ],
  tar: [
    { signature: [0x75, 0x73, 0x74, 0x61, 0x72], offset: 257 }, // ustar
  ],
  txt: [
    // Text files don't have magic bytes, we'll check for valid UTF-8/ASCII
  ],
};

// Supported MIME types
const SUPPORTED_MIME_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip", // Fallback since DOCX is ZIP-based
  ],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip", // Fallback since PPTX is ZIP-based
  ],
  zip: [
    "application/zip",
    "application/x-zip-compressed",
    "multipart/x-zip",
  ],
  tar: [
    "application/x-tar",
    "application/tar",
  ],
  txt: [
    "text/plain",
    "text/txt",
    "text/markdown",
    "application/json",
    "application/x-ndjson",
    "text/csv",
    "application/txt",
  ],
};

// File extensions
const SUPPORTED_EXTENSIONS: Record<string, string[]> = {
  pdf: [".pdf"],
  docx: [".docx"],
  pptx: [".pptx"],
  zip: [".zip"],
  tar: [".tar"],
  txt: [".txt", ".md", ".json", ".jsonl", ".csv"],
};

/**
 * Default validation configuration
 */
export const DEFAULT_FILE_VALIDATION_CONFIG: FileValidationConfig = {
  maxSizeBytes: 100 * 1024 * 1024, // 100MB
  allowedTypes: ["pdf", "docx", "pptx", "txt", "zip", "tar"],
  strictMagicBytes: true,
};

/**
 * Check if bytes match a magic signature
 */
function checkMagicBytes(buffer: ArrayBuffer | Uint8Array, signatures: Array<{ signature: number[]; offset: number }>): boolean {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  
  return signatures.some(({ signature, offset }) => {
    if (bytes.length < offset + signature.length) {
      return false;
    }
    
    return signature.every((byte, index) => bytes[offset + index] === byte);
  });
}

/**
 * Detect file type using magic bytes
 */
function detectFileTypeByMagicBytes(buffer: ArrayBuffer | Uint8Array): string | null {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  
  // Check PDF first (has unique signature)
  if (checkMagicBytes(bytes, MAGIC_BYTES.pdf)) {
    return "pdf";
  }

  if (checkMagicBytes(bytes, MAGIC_BYTES.tar)) {
    return "tar";
  }
  
  // For ZIP-based formats (DOCX, PPTX), we need additional checks
  if (checkMagicBytes(bytes, MAGIC_BYTES.docx)) {
    // This is a ZIP file, but we need to check the content to determine if it's DOCX or PPTX
    // For now, we'll return 'zip' and let the caller handle the distinction
    return "zip";
  }
  
  // Check if it's a text file by validating UTF-8/ASCII
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(0, 1024));
    // If it decodes successfully and contains printable characters, it's likely text
    if (text && /^[\x09\x0A\x0D\x20-\x7E]*$/.test(text.slice(0, 100))) {
      return "txt";
    }
  } catch {
    // Not valid UTF-8
  }
  
  return null;
}

/**
 * Advanced ZIP content detection for DOCX vs PPTX
 */
async function detectOfficeDocumentType(buffer: ArrayBuffer | Uint8Array): Promise<string | null> {
  try {
    // In a browser environment, we can't easily parse ZIP contents
    // We'll rely on MIME type and extension for distinction
    return "zip";
  } catch {
    return null;
  }
}

/**
 * Validate file extension
 */
function validateExtension(filename: string, expectedType: string): boolean {
  const extension = filename.toLowerCase().match(/\.[^.]*$/)?.[0] || "";
  return SUPPORTED_EXTENSIONS[expectedType]?.includes(extension) || false;
}

/**
 * Validate MIME type
 */
function validateMimeType(mimeType: string, expectedType: string): boolean {
  return SUPPORTED_MIME_TYPES[expectedType]?.includes(mimeType) || false;
}

/**
 * Format file size for human reading
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Comprehensive file validation
 */
export async function validateFile(
  file: File | { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> },
  config: Partial<FileValidationConfig> = {}
): Promise<FileValidationResult> {
  const validationConfig = { ...DEFAULT_FILE_VALIDATION_CONFIG, ...config };
  const errors: string[] = [];
  const warnings: string[] = [];
  
  let detectedType: string | undefined;
  let actualMimeType = file.type;

  try {
    // 1. Size validation
    if (file.size > validationConfig.maxSizeBytes) {
      errors.push(
        `File size ${formatFileSize(file.size)} exceeds maximum allowed size of ${formatFileSize(validationConfig.maxSizeBytes)}`
      );
    }

    if (file.size === 0) {
      errors.push("File is empty");
    }

    // 2. Get file buffer for magic bytes detection
    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    } catch (error) {
      errors.push("Unable to read file contents");
      return {
        isValid: false,
        errors,
        warnings,
        size: file.size,
        actualMimeType
      };
    }

    // 3. Magic bytes detection
    const magicBytesType = detectFileTypeByMagicBytes(buffer);
    
    if (magicBytesType === "zip") {
      // For ZIP-based files, use extension and MIME type to determine type
      const extension = file.name.toLowerCase().match(/\.[^.]*$/)?.[0] || "";
      if (extension === ".docx") {
        detectedType = "docx";
      } else if (extension === ".pptx") {
        detectedType = "pptx";
      } else if (extension === ".zip") {
        detectedType = "zip";
      } else {
        errors.push("Detected ZIP file but unable to determine if it's a valid DOCX or PPTX document");
      }
    } else if (magicBytesType) {
      detectedType = magicBytesType;
    }

    // 4. Extension validation
    if (detectedType) {
      if (!validateExtension(file.name, detectedType)) {
        if (validationConfig.strictMagicBytes) {
          errors.push(`File extension does not match detected file type (${detectedType})`);
        } else {
          warnings.push(`File extension does not match detected file type (${detectedType})`);
        }
      }
    } else {
      // Try to determine type from extension if magic bytes failed
      const extension = file.name.toLowerCase().match(/\.[^.]*$/)?.[0] || "";
      const typeFromExtension = Object.keys(SUPPORTED_EXTENSIONS).find(type =>
        SUPPORTED_EXTENSIONS[type].includes(extension)
      );
      
      if (typeFromExtension) {
        detectedType = typeFromExtension;
        if (validationConfig.strictMagicBytes) {
          errors.push(`Unable to verify file type from content. File may be corrupted or have a spoofed extension.`);
        } else {
          warnings.push(`Unable to verify file type from content, relying on file extension`);
        }
      } else {
        errors.push(`Unsupported file type. Supported types: ${validationConfig.allowedTypes.join(", ")}`);
      }
    }

    // 5. MIME type validation
    if (detectedType && file.type) {
      if (!validateMimeType(file.type, detectedType)) {
        warnings.push(`MIME type "${file.type}" does not match detected file type (${detectedType})`);
      }
    }

    // 6. Check if detected type is allowed
    if (detectedType && !validationConfig.allowedTypes.includes(detectedType)) {
      errors.push(`File type "${detectedType}" is not allowed. Supported types: ${validationConfig.allowedTypes.join(", ")}`);
    }

    // 7. Additional validation for specific file types
    if (detectedType === "pdf") {
      // Validate PDF structure
      const text = new TextDecoder().decode(buffer.slice(0, 1024));
      if (!text.includes("%PDF-")) {
        errors.push("Invalid PDF file structure");
      }
    }

    if (detectedType === "txt") {
      // Validate text file encoding
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        errors.push("Text file contains invalid UTF-8 encoding");
      }
    }

    return {
      isValid: errors.length === 0,
      detectedType,
      errors,
      warnings,
      size: file.size,
      actualMimeType
    };

  } catch (error) {
    errors.push(`Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    return {
      isValid: false,
      errors,
      warnings,
      size: file.size,
      actualMimeType
    };
  }
}

/**
 * Quick validation for file selection (without reading file contents)
 */
export function quickValidateFile(
  file: File,
  config: Partial<FileValidationConfig> = {}
): FileValidationResult {
  const validationConfig = { ...DEFAULT_FILE_VALIDATION_CONFIG, ...config };
  const errors: string[] = [];
  const warnings: string[] = [];

  // Size validation
  if (file.size > validationConfig.maxSizeBytes) {
    errors.push(
      `File size ${formatFileSize(file.size)} exceeds maximum allowed size of ${formatFileSize(validationConfig.maxSizeBytes)}`
    );
  }

  if (file.size === 0) {
    errors.push("File is empty");
  }

  // Extension validation
  const extension = file.name.toLowerCase().match(/\.[^.]*$/)?.[0] || "";
  const typeFromExtension = Object.keys(SUPPORTED_EXTENSIONS).find(type =>
    SUPPORTED_EXTENSIONS[type].includes(extension)
  );

  if (!typeFromExtension) {
    errors.push(`Unsupported file extension "${extension}". Supported types: ${validationConfig.allowedTypes.join(", ")}`);
  } else if (!validationConfig.allowedTypes.includes(typeFromExtension)) {
    errors.push(`File type "${typeFromExtension}" is not allowed`);
  }

  // MIME type validation
  if (typeFromExtension && file.type && !validateMimeType(file.type, typeFromExtension)) {
    warnings.push(`MIME type "${file.type}" does not match file extension`);
  }

  return {
    isValid: errors.length === 0,
    detectedType: typeFromExtension,
    errors,
    warnings,
    size: file.size,
    actualMimeType: file.type
  };
}

/**
 * Server-side file validation (for Node.js)
 */
export async function validateServerFile(
  file: { originalname: string; size: number; mimetype: string; buffer: Buffer },
  config: Partial<FileValidationConfig> = {}
): Promise<FileValidationResult> {
  // Convert Buffer to ArrayBuffer for compatibility
  const arrayBuffer = file.buffer.buffer.slice(
    file.buffer.byteOffset,
    file.buffer.byteOffset + file.buffer.byteLength
  );

  return validateFile(
    {
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      arrayBuffer: async () => arrayBuffer
    },
    config
  );
}
