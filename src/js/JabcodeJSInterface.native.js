// Support both ES modules and CommonJS
import ImageProcessorModule from './ImageProcessor.js';
import PNGLibModule from './PNGLib.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ImageProcessor = ImageProcessorModule.default || ImageProcessorModule;
const PNGLib = PNGLibModule.default || PNGLibModule;

// Create require function for ES modules
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Native Node.js addon interface for JABCode encoding and decoding operations.
 * Uses native C++ addon for maximum performance in Node.js.
 * 
 * @class JabcodeJSInterface
 */
class JabcodeJSInterface {
    /**
     * @type {ImageProcessor|null}
     * @private
     */
    processor = null;

    /**
     * @type {Object|null}
     * @private
     */
    native = null;

    /**
     * Initializes the native addon module.
     * 
     * @returns {Object} The native addon module
     * @private
     */
    initNative() {
        if (!this.native) {
            try {
                // Try to load the native addon from build directory
                const addonPath = join(__dirname, '../../build/Release/jabcode_native.node');
                this.native = require(addonPath);
            } catch (error) {
                // If native addon is not available, try alternative paths
                try {
                    const altPath = join(__dirname, '../../../build/Release/jabcode_native.node');
                    this.native = require(altPath);
                } catch (err) {
                    try {
                        // Try relative to current file
                        const relPath = join(__dirname, '../build/Release/jabcode_native.node');
                        this.native = require(relPath);
                    } catch (e) {
                        throw new Error(`Native addon not found. Please run 'npm run build:native' or 'npm install'. Error: ${error.message}`);
                    }
                }
            }
        }
        return this.native;
    }

    /**
     * Gets or creates the ImageProcessor instance.
     * 
     * @returns {ImageProcessor} The ImageProcessor instance
     * @private
     */
    getProcessor() {
        if (!this.processor) {
            this.processor = new ImageProcessor();
        }
        return this.processor;
    }

    /**
     * Encodes a message into a JABCode image.
     * 
     * @param {string} msg - The message to encode
     * @param {number|null} [symbol_num=null] - Optional symbol number (uses default if null)
     * @param {number|null} [color_num=null] - Optional color number (uses default if null)
     * @returns {string} Base64-encoded PNG data URI
     * @throws {Error} If encoding fails or native module is not initialized
     */
    encode_message(msg, symbol_num = null, color_num = null) {
        if (typeof msg !== 'string') {
            throw new Error('Message must be a string');
        }

        const native = this.initNative();

        try {
            // Get default values if not provided
            if (symbol_num === null) {
                symbol_num = native.getDefaultSymbolNumber();
            }
            if (color_num === null) {
                color_num = native.getDefaultColorNumber();
            }

            // Encode the message using native addon
            const buffer = native.encodeImage(msg, symbol_num, color_num);

            if (!buffer || buffer.length === 0) {
                throw new Error('Encoding failed: returned empty buffer');
            }

            // Extract image metadata from the buffer
            // Buffer format: [length(4), arg_length(4), width(4), height(4), depth(4), ...pixel_data]
            const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            const length = view.getInt32(0, true); // little-endian
            const arg_length = view.getInt32(4, true);
            const width = view.getInt32(8, true);
            const height = view.getInt32(12, true);
            const depth = view.getInt32(16, true);

            if (width <= 0 || height <= 0) {
                throw new Error('Invalid image dimensions returned from encoder');
            }

            // PNGLib is already loaded

            // Create PNG from pixel data
            const lib = new PNGLib(width, height, depth);
            const pixelDataOffset = 20; // Offset for metadata (5 ints = 20 bytes)

            for (let i = 0; i < width; i++) {
                for (let j = 0; j < height; j++) {
                    const pixIndex = (j * width + i) * 4 + pixelDataOffset;
                    lib.buffer[lib.index(i, j)] = lib.color(
                        buffer[pixIndex],
                        buffer[pixIndex + 1],
                        buffer[pixIndex + 2],
                        buffer[pixIndex + 3]
                    );
                }
            }

            return `data:image/png;base64,${lib.getBase64()}`;
        } catch (error) {
            throw new Error(`Encoding failed: ${error.message}`);
        }
    }

    /**
     * Decodes a JABCode image to extract the message.
     * 
     * @param {string|ArrayBuffer|Buffer} img - Image as base64 data URI, ArrayBuffer, or Buffer
     * @returns {Promise<string>} Promise that resolves to the decoded message
     * @throws {Error} If decoding fails or native module is not initialized
     */
    decode_message(img) {
        const native = this.initNative();

        return this.getProcessor()
            .getByteBufferFromImage(img)
            .then((buffer) => {
                if (!buffer || buffer.byteLength === 0) {
                    throw new Error('Invalid image buffer');
                }

                // Convert to Node.js Buffer if needed
                let nodeBuffer;
                if (Buffer.isBuffer(buffer)) {
                    nodeBuffer = buffer;
                } else if (buffer instanceof ArrayBuffer) {
                    nodeBuffer = Buffer.from(buffer);
                } else if (buffer instanceof Uint8Array) {
                    nodeBuffer = Buffer.from(buffer);
                } else {
                    throw new Error('Unsupported buffer type');
                }

                // Decode using native addon
                const resultBuffer = native.decodeImage(nodeBuffer);

                if (!resultBuffer || resultBuffer.length === 0) {
                    throw new Error('Decoding failed: returned empty buffer');
                }

                // Extract the decoded message
                // Buffer format: [length(4), arg_length(4), ...message_data]
                const view = new DataView(resultBuffer.buffer, resultBuffer.byteOffset, resultBuffer.byteLength);
                const msgLength = view.getInt32(0, true); // little-endian

                if (msgLength <= 0 || msgLength > 1000000) { // Sanity check
                    throw new Error('Invalid message length returned from decoder');
                }

                const msg = [];
                const messageOffset = 8; // Offset for length metadata (2 ints = 8 bytes)
                for (let i = 0; i < msgLength; i++) {
                    msg.push(resultBuffer[messageOffset + i]);
                }

                return String.fromCharCode(...msg);
            })
            .catch((error) => {
                throw new Error(`Decoding failed: ${error.message}`);
            });
    }
}

export default JabcodeJSInterface;
