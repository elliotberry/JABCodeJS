import createModule from './jabcodeJSLib.js';
import ImageProcessor from './ImageProcessor.js';
import PNGLib from './PNGLib.js';

/**
 * Main interface for JABCode encoding and decoding operations.
 * WebAssembly-enabled version with async module loading.
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
     * @type {Promise|null}
     * @private
     */
    modulePromise = null;

    /**
     * @type {Object|null}
     * @private
     */
    emscript = null;

    /**
     * Initializes the Emscripten module (async for WASM).
     * 
     * @returns {Promise<Object>} Promise that resolves to the Emscripten module
     * @private
     */
    async initModule() {
        if (this.emscript) {
            return this.emscript;
        }

        if (!this.modulePromise) {
            this.modulePromise = createModule({
                // WASM loading options
                locateFile: (path) => {
                    // For Node.js, use __dirname
                    if (typeof __dirname !== 'undefined') {
                        return require('path').join(__dirname, path);
                    }
                    // For browser, use relative path
                    return path;
                },
                // Memory options
                wasmMemory: undefined, // Let Emscripten manage
            });
        }

        this.emscript = await this.modulePromise;
        return this.emscript;
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
     * @returns {Promise<string>} Promise that resolves to base64-encoded PNG data URI
     * @throws {Error} If encoding fails or Emscripten module is not initialized
     */
    async encode_message(msg, symbol_num = null, color_num = null) {
        if (typeof msg !== 'string') {
            throw new Error('Message must be a string');
        }

        const emscript = await this.initModule();

        if (!emscript || typeof emscript.ccall !== 'function') {
            throw new Error('Emscripten module not initialized');
        }

        try {
            // Get default values if not provided
            if (symbol_num === null) {
                const getSymbolNum = emscript._getDefaultSymbolNumber || emscript.getDefaultSymbolNumber;
                symbol_num = getSymbolNum ? getSymbolNum() : 1;
            }
            if (color_num === null) {
                const getColorNum = emscript._getDefaultColorNumber || emscript.getDefaultColorNumber;
                color_num = getColorNum ? getColorNum() : 1;
            }

            // Encode the message
            const ptr = emscript.ccall('encode_image', 'array', ['string', 'int', 'int'],
                [msg, symbol_num, color_num]);

            if (!ptr || ptr === 0) {
                throw new Error('Encoding failed: returned null pointer');
            }

            // Extract image metadata from the returned array
            const length = emscript.HEAP32[ptr / 4];
            const arg_length = emscript.HEAP32[ptr / 4 + 1];
            const width = emscript.HEAP32[ptr / 4 + 2];
            const height = emscript.HEAP32[ptr / 4 + 3];
            const depth = emscript.HEAP32[ptr / 4 + 4];

            if (width <= 0 || height <= 0) {
                emscript._free(ptr);
                throw new Error('Invalid image dimensions returned from encoder');
            }

            // Create PNG from pixel data
            const lib = new PNGLib(width, height, depth);
            const pixelDataOffset = 20; // Offset for metadata (5 ints = 20 bytes)

            for (let i = 0; i < width; i++) {
                for (let j = 0; j < height; j++) {
                    const pixIndex = (j * width + i) * 4 + pixelDataOffset + ptr;
                    lib.buffer[lib.index(i, j)] = lib.color(
                        emscript.HEAPU8[pixIndex],
                        emscript.HEAPU8[pixIndex + 1],
                        emscript.HEAPU8[pixIndex + 2],
                        emscript.HEAPU8[pixIndex + 3]
                    );
                }
            }

            // Free the allocated memory
            emscript._free(ptr);

            return `data:image/png;base64,${lib.getBase64()}`;
        } catch (error) {
            // Ensure memory is freed even on error
            if (error.ptr) {
                emscript._free?.(error.ptr);
            }
            throw new Error(`Encoding failed: ${error.message}`);
        }
    }

    /**
     * Decodes a JABCode image to extract the message.
     * 
     * @param {string|ArrayBuffer|Blob} img - Image as base64 data URI, ArrayBuffer, or Blob
     * @returns {Promise<string>} Promise that resolves to the decoded message
     * @throws {Error} If decoding fails or Emscripten module is not initialized
     */
    async decode_message(img) {
        const emscript = await this.initModule();

        if (!emscript || typeof emscript.ccall !== 'function') {
            throw new Error('Emscripten module not initialized');
        }

        return this.getProcessor()
            .getByteBufferFromImage(img)
            .then((buffer) => {
                if (!buffer || buffer.byteLength === 0) {
                    throw new Error('Invalid image buffer');
                }

                const length = buffer.byteLength;
                let ptr = null;
                let resultPtr = null;

                try {
                    // Allocate memory and copy image data
                    ptr = emscript._malloc(length);
                    if (!ptr || ptr === 0) {
                        throw new Error('Memory allocation failed');
                    }

                    // Copy buffer to Emscripten heap
                    const heapView = new Uint8Array(emscript.HEAPU8.buffer, ptr, length);
                    if (buffer instanceof ArrayBuffer) {
                        heapView.set(new Uint8Array(buffer));
                    } else if (buffer instanceof Uint8Array || buffer instanceof Uint16Array) {
                        heapView.set(buffer);
                    } else {
                        throw new Error('Unsupported buffer type');
                    }

                    // Decode the image
                    resultPtr = emscript.ccall('decode_image', 'int', ['int', 'int'],
                        [ptr, length]);

                    if (!resultPtr || resultPtr === 0) {
                        throw new Error('Decoding failed: returned null pointer');
                    }

                    // Extract the decoded message
                    const msgLength = emscript.HEAP32[resultPtr / 4];
                    if (msgLength <= 0 || msgLength > 1000000) { // Sanity check
                        throw new Error('Invalid message length returned from decoder');
                    }

                    const msg = [];
                    const messageOffset = 8; // Offset for length metadata (2 ints = 8 bytes)
                    for (let i = 0; i < msgLength; i++) {
                        msg.push(emscript.HEAPU8[resultPtr + messageOffset + i]);
                    }

                    return String.fromCharCode(...msg);
                } finally {
                    // Always free allocated memory
                    if (ptr && ptr !== 0) {
                        emscript._free(ptr);
                    }
                    if (resultPtr && resultPtr !== 0) {
                        emscript._free(resultPtr);
                    }
                }
            })
            .catch((error) => {
                throw new Error(`Decoding failed: ${error.message}`);
            });
    }
}

export default JabcodeJSInterface;

