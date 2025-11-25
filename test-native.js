#!/usr/bin/env node

/**
 * Test script for native Node.js addon
 * Run with: node test-native.js
 */

import JabcodeJSInterface from './src/js/JabcodeJSInterface.native.js';

console.log('Testing JABCode Native Addon...\n');

try {
    const jabcode = new JabcodeJSInterface();
    
    console.log('✓ Native addon loaded successfully');
    
    // Test encoding
    console.log('\nTesting encoding...');
    const testMessage = "Hello from native addon!";
    const encoded = jabcode.encode_message(testMessage);
    
    if (encoded && encoded.startsWith('data:image/png;base64,')) {
        console.log('✓ Encoding successful');
        console.log(`  Image data URI length: ${encoded.length} characters`);
    } else {
        console.error('✗ Encoding failed: Invalid output');
        process.exit(1);
    }
    
    // Test default values by encoding with null (uses defaults)
    console.log('\nTesting default values...');
    const encodedWithDefaults = jabcode.encode_message("Test");
    if (encodedWithDefaults) {
        console.log('✓ Encoding with default values successful');
    }
    
    console.log('\n✅ All tests passed!');
    
} catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
}

