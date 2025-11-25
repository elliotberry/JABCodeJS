/**
 * Main entry point for JABCodeJS.
 * Exports the appropriate implementation based on environment.
 */

// For Node.js with native addon support
if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node) {
    // Try native first, then fallback
    try {
        module.exports = require('./JabcodeJSInterface.native.js');
    } catch (error) {
        // Fallback to WASM or JS
        try {
            module.exports = require('./JabcodeJSInterface.wasm.js');
        } catch (wasmError) {
            module.exports = require('./JabcodeJSInterface.js');
        }
    }
} else {
    // Browser - use ES modules
    // This will be handled by the bundler
    export { default } from './JabcodeJSInterface.js';
}

