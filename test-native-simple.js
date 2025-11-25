#!/usr/bin/env node

/**
 * Simple test script for native Node.js addon
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

console.log('Loading native addon...');

try {
    const native = require('./build/Release/jabcode_native.node');
    console.log('✓ Native addon loaded');
    console.log('Functions:', Object.keys(native));
    
    console.log('\nTesting getDefaultSymbolNumber...');
    const symbolNum = native.getDefaultSymbolNumber();
    console.log('✓ Default symbol number:', symbolNum);
    
    console.log('\nTesting getDefaultColorNumber...');
    const colorNum = native.getDefaultColorNumber();
    console.log('✓ Default color number:', colorNum);
    
    console.log('\nTesting encodeImage...');
    const buffer = native.encodeImage("Hello", symbolNum, colorNum);
    console.log('✓ Encoding successful');
    console.log('  Buffer length:', buffer.length);
    console.log('  First 20 bytes:', Array.from(buffer.slice(0, 20)));
    
    console.log('\n✅ All tests passed!');
    
} catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
}

