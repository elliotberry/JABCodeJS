/**
 * Auto-detecting interface that uses native addon in Node.js and WASM/JS in browser.
 * This is the recommended entry point for most use cases.
 */

let JabcodeJSInterface;

// Detect environment and load appropriate implementation
if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node) {
    // Node.js environment - try to use native addon
    try {
        JabcodeJSInterface = (await import('./JabcodeJSInterface.native.js')).default;
        console.log('[JABCode] Using native addon for maximum performance');
    } catch (error) {
        // Fallback to WASM if native addon is not available
        console.warn('[JABCode] Native addon not available, falling back to WASM:', error.message);
        try {
            JabcodeJSInterface = (await import('./JabcodeJSInterface.wasm.js')).default;
            console.log('[JABCode] Using WASM implementation');
        } catch (wasmError) {
            // Final fallback to JavaScript
            console.warn('[JABCode] WASM not available, falling back to JavaScript:', wasmError.message);
            JabcodeJSInterface = (await import('./JabcodeJSInterface.js')).default;
            console.log('[JABCode] Using JavaScript implementation');
        }
    }
} else {
    // Browser environment - use WASM or JavaScript
    try {
        JabcodeJSInterface = (await import('./JabcodeJSInterface.wasm.js')).default;
        console.log('[JABCode] Using WASM implementation');
    } catch (error) {
        // Fallback to JavaScript
        console.warn('[JABCode] WASM not available, falling back to JavaScript:', error.message);
        JabcodeJSInterface = (await import('./JabcodeJSInterface.js')).default;
        console.log('[JABCode] Using JavaScript implementation');
    }
}

export default JabcodeJSInterface;

