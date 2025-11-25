#!/usr/bin/env node

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

console.log('Loading native addon...');
const native = require('./build/Release/jabcode_native.node');
console.log('✓ Loaded');

console.log('\nTesting createEncode indirectly...');
console.log('Calling getDefaultSymbolNumber...');
const sym = native.getDefaultSymbolNumber();
console.log('✓ Symbol:', sym);

console.log('\nCalling getDefaultColorNumber...');
const col = native.getDefaultColorNumber();
console.log('✓ Color:', col);

console.log('\nCalling encodeImage with minimal params...');
console.log('This may take a moment...');

const start = Date.now();
try {
    const buffer = native.encodeImage('Hi', 1, 8);
    const elapsed = Date.now() - start;
    console.log(`✓ SUCCESS! Completed in ${elapsed}ms`);
    console.log('  Buffer length:', buffer.length);
    console.log('  First 20 bytes:', Array.from(buffer.slice(0, 20)));
} catch (error) {
    const elapsed = Date.now() - start;
    console.error(`✗ FAILED after ${elapsed}ms:`, error.message);
    process.exit(1);
}

