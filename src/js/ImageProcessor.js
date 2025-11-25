/**
 * Processes image data from various formats (base64, ArrayBuffer, Blob) into byte buffers.
 * 
 * @class ImageProcessor
 */
class ImageProcessor {
    /**
     * Base64 character lookup table for fast decoding.
     * @type {number[]|null}
     * @static
     * @private
     */
    static values = null;

    /**
     * Initializes the base64 lookup table.
     * 
     * @static
     * @private
     */
    static populateLookups() {
        ImageProcessor.values = [];
        const keys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        for (let i = 0; i < 65; i++) {
            ImageProcessor.values[keys.charCodeAt(i)] = i;
        }
    }

    /**
     * Converts an image from various formats to a byte buffer.
     * 
     * @param {string|ArrayBuffer|Blob} img - Image as base64 data URI, ArrayBuffer, or Blob
     * @returns {Promise<Uint8Array>} Promise that resolves to the image byte buffer
     * @throws {Error} If the image format is unsupported or conversion fails
     */
    getByteBufferFromImage(img) {
        if (typeof img === 'string') {
            return Promise.resolve(this.base64StringToUint8Array(img));
        }

        if (img instanceof ArrayBuffer) {
            return Promise.resolve(new Uint8Array(img));
        }

        if (img && typeof img.arrayBuffer === 'function') {
            return img.arrayBuffer().then(buffer => new Uint8Array(buffer));
        }

        return Promise.reject(new Error('Unsupported image format. Expected base64 string, ArrayBuffer, or Blob'));
    }

    /**
     * Converts a base64 data URI to a Uint8Array.
     * 
     * @param {string} txt - Base64 string (with or without data URI prefix)
     * @returns {Uint8Array} Decoded byte array
     * @throws {Error} If base64 decoding fails
     * @private
     */
    base64StringToUint8Array(txt) {
        if (typeof txt !== 'string') {
            throw new Error('Input must be a string');
        }

        // Extract base64 data if it's a data URI
        let dataStart = txt.indexOf('base64,');
        if (dataStart > -1) {
            txt = txt.substring(dataStart + 'base64,'.length);
        }

        // Ensure lookup table is initialized
        if (!ImageProcessor.values) {
            ImageProcessor.populateLookups();
        }

        const result = [];
        let v1, v2, v3, v4;

        // Process base64 string in chunks of 4 characters
        for (let i = 0, len = txt.length; i < len; i += 4) {
            // Map four chars to values
            v1 = ImageProcessor.values[txt.charCodeAt(i)] ?? 0;
            v2 = ImageProcessor.values[txt.charCodeAt(i + 1)] ?? 0;
            v3 = ImageProcessor.values[txt.charCodeAt(i + 2)] ?? 64;
            v4 = ImageProcessor.values[txt.charCodeAt(i + 3)] ?? 64;

            // Split and merge bits, then map and push to output
            result.push(
                (v1 << 2) | (v2 >> 4),
                ((v2 & 15) << 4) | (v3 >> 2),
                ((v3 & 3) << 6) | v4
            );
        }

        // Trim result if the last values are padding ('=')
        if (v4 === 64) {
            result.splice(v3 === 64 ? -2 : -1);
        }

        return new Uint8Array(result);
    }
}

// Initialize lookup table on module load
ImageProcessor.populateLookups();

export default ImageProcessor;
