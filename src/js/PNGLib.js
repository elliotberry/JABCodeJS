/**
 * A library for generating PNG images client-side.
 * 
 * @version 1.0
 * @author Robert Eisele <robert@xarg.org>
 * @copyright Copyright (c) 2010, Robert Eisele
 * @link http://www.xarg.org/2010/03/generate-client-side-png-files-using-javascript/
 * @license http://www.opensource.org/licenses/bsd-license.php BSD License
 * 
 * Modernized to ES6 class syntax
 */

/**
 * Helper function to write multiple strings to a buffer at a given offset.
 * 
 * @param {string[]} buffer - The buffer array
 * @param {number} offs - Starting offset
 * @param {...string} args - Strings to write
 * @private
 */
function write(buffer, offs, ...args) {
    for (let i = 0; i < args.length; i++) {
        const str = args[i];
        for (let j = 0; j < str.length; j++) {
            buffer[offs++] = str.charAt(j);
        }
    }
}

/**
 * Converts a 16-bit word to two bytes (big-endian).
 * 
 * @param {number} w - 16-bit word
 * @returns {string} Two-character string
 * @private
 */
function byte2(w) {
    return String.fromCharCode((w >> 8) & 255, w & 255);
}

/**
 * Converts a 32-bit word to four bytes (big-endian).
 * 
 * @param {number} w - 32-bit word
 * @returns {string} Four-character string
 * @private
 */
function byte4(w) {
    return String.fromCharCode(
        (w >> 24) & 255,
        (w >> 16) & 255,
        (w >> 8) & 255,
        w & 255
    );
}

/**
 * Converts a 16-bit word to two bytes (little-endian).
 * 
 * @param {number} w - 16-bit word
 * @returns {string} Two-character string
 * @private
 */
function byte2lsb(w) {
    return String.fromCharCode(w & 255, (w >> 8) & 255);
}

/**
 * PNG library for generating PNG images programmatically.
 * 
 * @class PNGLib
 */
class PNGLib {
    /**
     * Creates a new PNGLib instance.
     * 
     * @param {number} width - Image width in pixels
     * @param {number} height - Image height in pixels
     * @param {number} depth - Color depth (palette size)
     */
    constructor(width, height, depth) {
        this.width = width;
        this.height = height;
        this.depth = depth;

        // Pixel data and row filter identifier size
        this.pix_size = height * (width + 1);

        // Deflate header, pix_size, block headers, adler32 checksum
        this.data_size = 2 + this.pix_size + 5 * Math.floor((0xfffe + this.pix_size) / 0xffff) + 4;

        // Offsets and sizes of PNG chunks
        this.ihdr_offs = 0; // IHDR offset and size
        this.ihdr_size = 4 + 4 + 13 + 4;
        this.plte_offs = this.ihdr_offs + this.ihdr_size; // PLTE offset and size
        this.plte_size = 4 + 4 + 3 * depth + 4;
        this.trns_offs = this.plte_offs + this.plte_size; // tRNS offset and size
        this.trns_size = 4 + 4 + depth + 4;
        this.idat_offs = this.trns_offs + this.trns_size; // IDAT offset and size
        this.idat_size = 4 + 4 + this.data_size + 4;
        this.iend_offs = this.idat_offs + this.idat_size; // IEND offset and size
        this.iend_size = 4 + 4 + 4;
        this.buffer_size = this.iend_offs + this.iend_size; // Total PNG size

        this.buffer = [];
        this.palette = {};
        this.pindex = 0;

        // Initialize CRC32 lookup table
        const _crc32 = [];
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                if (c & 1) {
                    c = -306674912 ^ ((c >> 1) & 0x7fffffff);
                } else {
                    c = (c >> 1) & 0x7fffffff;
                }
            }
            _crc32[i] = c;
        }
        this._crc32 = _crc32;

        // Initialize buffer with zero bytes
        for (let i = 0; i < this.buffer_size; i++) {
            this.buffer[i] = '\x00';
        }

        // Initialize non-zero elements
        write(this.buffer, this.ihdr_offs, byte4(this.ihdr_size - 12), 'IHDR', byte4(width), byte4(height), '\x08\x03');
        write(this.buffer, this.plte_offs, byte4(this.plte_size - 12), 'PLTE');
        write(this.buffer, this.trns_offs, byte4(this.trns_size - 12), 'tRNS');
        write(this.buffer, this.idat_offs, byte4(this.idat_size - 12), 'IDAT');
        write(this.buffer, this.iend_offs, byte4(this.iend_size - 12), 'IEND');

        // Initialize deflate header
        let header = ((8 + (7 << 4)) << 8) | (3 << 6);
        header += 31 - (header % 31);

        write(this.buffer, this.idat_offs + 8, byte2(header));

        // Initialize deflate block headers
        for (let i = 0; (i << 16) - 1 < this.pix_size; i++) {
            let size, bits;
            if (i + 0xffff < this.pix_size) {
                size = 0xffff;
                bits = '\x00';
            } else {
                size = this.pix_size - (i << 16) - i;
                bits = '\x01';
            }
            write(this.buffer, this.idat_offs + 8 + 2 + (i << 16) + (i << 2), bits, byte2lsb(size), byte2lsb(~size));
        }
    }

    /**
     * Computes the index into the PNG buffer for a given pixel coordinate.
     * 
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Buffer index
     */
    index(x, y) {
        const i = y * (this.width + 1) + x + 1;
        const j = this.idat_offs + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i;
        return j;
    }

    /**
     * Converts RGBA color values and builds up the palette.
     * 
     * @param {number} red - Red component (0-255)
     * @param {number} green - Green component (0-255)
     * @param {number} blue - Blue component (0-255)
     * @param {number} alpha - Alpha component (0-255), defaults to 255
     * @returns {string} Palette index character
     */
    color(red, green, blue, alpha = 255) {
        alpha = alpha >= 0 ? alpha : 255;
        const color = (((((alpha << 8) | red) << 8) | green) << 8) | blue;

        if (typeof this.palette[color] === 'undefined') {
            if (this.pindex === this.depth) {
                return '\x00';
            }

            const ndx = this.plte_offs + 8 + 3 * this.pindex;

            this.buffer[ndx + 0] = String.fromCharCode(red);
            this.buffer[ndx + 1] = String.fromCharCode(green);
            this.buffer[ndx + 2] = String.fromCharCode(blue);
            this.buffer[this.trns_offs + 8 + this.pindex] = String.fromCharCode(alpha);

            this.palette[color] = String.fromCharCode(this.pindex++);
        }
        return this.palette[color];
    }

    /**
     * Computes CRC32 checksum for a PNG chunk.
     * 
     * @param {number} offs - Chunk offset
     * @param {number} size - Chunk size
     * @private
     */
    crc32(offs, size) {
        let crc = -1;
        for (let i = 4; i < size - 4; i += 1) {
            crc = this._crc32[(crc ^ this.buffer[offs + i].charCodeAt(0)) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
        }
        write(this.buffer, offs + size - 4, byte4(crc ^ -1));
    }

    /**
     * Outputs a PNG string, Base64 encoded.
     * 
     * @returns {string} Base64-encoded PNG string
     */
    getBase64() {
        const s = this.getDump();

        // If the current environment supports the Base64 encoding function,
        // use it as it will be done in native code
        if (typeof btoa !== 'undefined' && btoa !== null) {
            return btoa(s);
        }

        // Fallback base64 encoding
        const ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let c1, c2, c3, e1, e2, e3, e4;
        const l = s.length;
        let i = 0;
        let r = '';

        do {
            c1 = s.charCodeAt(i);
            e1 = c1 >> 2;
            c2 = s.charCodeAt(i + 1);
            e2 = ((c1 & 3) << 4) | (c2 >> 4);
            c3 = s.charCodeAt(i + 2);
            if (l < i + 2) {
                e3 = 64;
            } else {
                e3 = ((c2 & 0xf) << 2) | (c3 >> 6);
            }
            if (l < i + 3) {
                e4 = 64;
            } else {
                e4 = c3 & 0x3f;
            }
            r += ch.charAt(e1) + ch.charAt(e2) + ch.charAt(e3) + ch.charAt(e4);
        } while ((i += 3) < l);

        return r;
    }

    /**
     * Outputs a PNG string (binary format).
     * 
     * @returns {string} PNG binary string
     */
    getDump() {
        // Compute adler32 of output pixels + row filter bytes
        const BASE = 65521; // Largest prime smaller than 65536
        const NMAX = 5552; // NMAX is the largest n such that 255n(n+1)/2 + (n+1)(BASE-1) <= 2^32-1
        let s1 = 1;
        let s2 = 0;
        let n = NMAX;

        for (let y = 0; y < this.height; y++) {
            for (let x = -1; x < this.width; x++) {
                s1 += this.buffer[this.index(x, y)].charCodeAt(0);
                s2 += s1;
                if ((n -= 1) === 0) {
                    s1 %= BASE;
                    s2 %= BASE;
                    n = NMAX;
                }
            }
        }
        s1 %= BASE;
        s2 %= BASE;
        write(this.buffer, this.idat_offs + this.idat_size - 8, byte4((s2 << 16) | s1));

        // Compute crc32 of the PNG chunks
        this.crc32(this.ihdr_offs, this.ihdr_size);
        this.crc32(this.plte_offs, this.plte_size);
        this.crc32(this.trns_offs, this.trns_size);
        this.crc32(this.idat_offs, this.idat_size);
        this.crc32(this.iend_offs, this.iend_size);

        // Convert PNG to string
        return '\x89PNG\r\n\x1A\n' + this.buffer.join('');
    }
}

export default PNGLib;
