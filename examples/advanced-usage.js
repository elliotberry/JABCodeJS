#!/usr/bin/env node

/**
 * Advanced usage example for JABCodeJS
 * 
 * This example demonstrates:
 * - Batch encoding/decoding
 * - Performance comparison
 * - Error handling strategies
 * - Working with different data types
 */

// Import the appropriate interface (auto-detects native addon vs Emscripten)
import JabcodeJSInterface from '../src/js/JabcodeJSInterface.native.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function batchEncode(messages, jabcode) {
    console.log(`\nBatch encoding ${messages.length} messages...`);
    const start = Date.now();
    const results = [];
    
    for (let i = 0; i < messages.length; i++) {
        try {
            const image = await jabcode.encode_message(messages[i]);
            results.push({ success: true, index: i, image });
        } catch (error) {
            results.push({ success: false, index: i, error: error.message });
        }
    }
    
    const elapsed = Date.now() - start;
    const successCount = results.filter(r => r.success).length;
    
    console.log(`   ✓ Completed in ${elapsed}ms`);
    console.log(`   Success: ${successCount}/${messages.length}`);
    console.log(`   Average: ${(elapsed / messages.length).toFixed(2)}ms per message`);
    
    return results;
}

async function batchDecode(images, jabcode) {
    console.log(`\nBatch decoding ${images.length} images...`);
    const start = Date.now();
    const results = [];
    
    for (let i = 0; i < images.length; i++) {
        try {
            const message = await jabcode.decode_message(images[i]);
            results.push({ success: true, index: i, message });
        } catch (error) {
            results.push({ success: false, index: i, error: error.message });
        }
    }
    
    const elapsed = Date.now() - start;
    const successCount = results.filter(r => r.success).length;
    
    console.log(`   ✓ Completed in ${elapsed}ms`);
    console.log(`   Success: ${successCount}/${images.length}`);
    console.log(`   Average: ${(elapsed / images.length).toFixed(2)}ms per image`);
    
    return results;
}

async function main() {
    console.log('JABCodeJS - Advanced Usage Example\n');
    console.log('='.repeat(50));
    
    try {
        const jabcode = new JabcodeJSInterface();
        
        console.log('\n1. Performance Testing');
        console.log('-'.repeat(50));
        
        // Test different message sizes
        const testMessages = [
            'Short',
            'Medium length message for testing',
            'This is a much longer message that will test the encoding performance with more data to encode into the JABCode format',
            'A'.repeat(100),
            'A'.repeat(500),
        ];
        
        console.log('\nEncoding performance test:');
        for (const msg of testMessages) {
            const start = Date.now();
            await jabcode.encode_message(msg);
            const elapsed = Date.now() - start;
            console.log(`   ${msg.length} chars: ${elapsed}ms`);
        }
        
        console.log('\n2. Batch Operations');
        console.log('-'.repeat(50));
        
        const batchMessages = [
            'Message 1',
            'Message 2',
            'Message 3',
            'Message 4',
            'Message 5',
        ];
        
        const encodedResults = await batchEncode(batchMessages, jabcode);
        const successfulImages = encodedResults
            .filter(r => r.success)
            .map(r => r.image);
        
        if (successfulImages.length > 0) {
            await batchDecode(successfulImages, jabcode);
        }
        
        console.log('\n3. Error Handling');
        console.log('-'.repeat(50));
        
        // Test invalid input
        console.log('\nTesting error handling...');
        
        try {
            await jabcode.encode_message(null);
        } catch (error) {
            console.log(`   ✓ Caught error for null input: ${error.message}`);
        }
        
        try {
            await jabcode.decode_message('invalid-image-data');
        } catch (error) {
            console.log(`   ✓ Caught error for invalid image: ${error.message}`);
        }
        
        console.log('\n4. Different Symbol/Color Configurations');
        console.log('-'.repeat(50));
        
        const configs = [
            { symbols: 1, colors: 4, name: 'Minimal (1 symbol, 4 colors)' },
            { symbols: 1, colors: 8, name: 'Default (1 symbol, 8 colors)' },
            { symbols: 1, colors: 16, name: 'High color (1 symbol, 16 colors)' },
            { symbols: 2, colors: 8, name: 'Multi-symbol (2 symbols, 8 colors)' },
        ];
        
        const testMessage = 'Configuration test';
        
        for (const config of configs) {
            try {
                const start = Date.now();
                const image = await jabcode.encode_message(
                    testMessage,
                    config.symbols,
                    config.colors
                );
                const elapsed = Date.now() - start;
                
                const outputPath = path.join(
                    __dirname,
                    'output',
                    `config-${config.symbols}s-${config.colors}c.png`
                );
                const base64 = image.replace(/^data:image\/png;base64,/, '');
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });
                fs.writeFileSync(outputPath, base64, 'base64');
                
                console.log(`   ✓ ${config.name}: ${elapsed}ms`);
            } catch (error) {
                console.log(`   ✗ ${config.name}: ${error.message}`);
            }
        }
        
        console.log('\n5. Round-trip Verification');
        console.log('-'.repeat(50));
        
        const verificationMessages = [
            'Simple text',
            'Text with numbers: 1234567890',
            'Text with symbols: !@#$%^&*()',
            'Text with spaces: Hello World',
            'Unicode: 🌟⭐✨',
        ];
        
        let passed = 0;
        let failed = 0;
        
        for (const msg of verificationMessages) {
            try {
                const encoded = await jabcode.encode_message(msg);
                const decoded = await jabcode.decode_message(encoded);
                
                if (msg === decoded) {
                    passed++;
                    console.log(`   ✓ "${msg}" -> round-trip successful`);
                } else {
                    failed++;
                    console.log(`   ✗ "${msg}" -> mismatch`);
                    console.log(`     Encoded: "${msg}"`);
                    console.log(`     Decoded: "${decoded}"`);
                }
            } catch (error) {
                failed++;
                console.log(`   ✗ "${msg}" -> error: ${error.message}`);
            }
        }
        
        console.log(`\n   Round-trip results: ${passed} passed, ${failed} failed`);
        
        console.log('\n' + '='.repeat(50));
        console.log('\n✅ Advanced examples completed!');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();

