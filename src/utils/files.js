// File Processing Utilities
// =========================

/**
 * Maximum file size in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Supported image MIME types
 */
export const SUPPORTED_IMAGE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
];

/**
 * Supported PDF MIME type
 */
export const SUPPORTED_PDF_TYPE = 'application/pdf';

/**
 * Convert a File to a Base64 data URL
 * @param {File} file - The file to convert
 * @returns {Promise<string>} - Base64 data URL (e.g., "data:image/jpeg;base64,...")
 * @throws {Error} - If file is too large or type is unsupported
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            reject(new Error(`File "${file.name}" exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`));
            return;
        }

        // Validate file type
        const isImage = SUPPORTED_IMAGE_TYPES.includes(file.type);
        const isPdf = file.type === SUPPORTED_PDF_TYPE;
        
        if (!isImage && !isPdf) {
            reject(new Error(`Unsupported file type: ${file.type}. Supported: images (PNG, JPEG, WebP, GIF) and PDF.`));
            return;
        }

        const reader = new FileReader();
        
        reader.onload = () => {
            resolve(reader.result);
        };
        
        reader.onerror = () => {
            reject(new Error(`Failed to read file: ${file.name}`));
        };
        
        reader.readAsDataURL(file);
    });
}

/**
 * Check if a file is an image
 * @param {File} file 
 * @returns {boolean}
 */
export function isImageFile(file) {
    return SUPPORTED_IMAGE_TYPES.includes(file.type);
}

/**
 * Check if a file is a PDF
 * @param {File} file 
 * @returns {boolean}
 */
export function isPdfFile(file) {
    return file.type === SUPPORTED_PDF_TYPE;
}

/**
 * Get file type category
 * @param {File|Object} file - File object or attachment object with type property
 * @returns {'image'|'pdf'|'unknown'}
 */
export function getFileType(file) {
    const mimeType = file.type || file.mimeType;
    if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) return 'image';
    if (mimeType === SUPPORTED_PDF_TYPE) return 'pdf';
    return 'unknown';
}

/**
 * Format file size for display
 * @param {number} bytes 
 * @returns {string}
 */
export function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Create a thumbnail preview URL for an image
 * @param {string} base64DataUrl - The base64 data URL
 * @returns {string} - The same URL (for consistency)
 */
export function createImagePreview(base64DataUrl) {
    return base64DataUrl;
}

