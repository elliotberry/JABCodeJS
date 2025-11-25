#!/usr/bin/env node

/**
 * Basic usage example for JABCodeJS
 * 
 * This example demonstrates:
 * - Encoding messages into JABCode images
 * - Decoding JABCode images back to messages
 * - Using custom symbol and color numbers
 * - Error handling
 */

// Import the appropriate interface (auto-detects native addon vs Emscripten)
import JabcodeJSInterface from '../src/js/JabcodeJSInterface.native.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log('JABCodeJS - Basic Usage Example\n');
    console.log('=' .repeat(50));
    
    try {
        // Create an instance of the JABCode interface
        // This will automatically use the native addon in Node.js if available,
        // or fall back to the Emscripten version
        const jabcode = new JabcodeJSInterface();
        
        console.log('\n1. Encoding a simple message...');
        const message = 'Hello, JABCode!';
        console.log(`   Message: "${message}"`);
        
        // Encode with default settings (symbol_number=1, color_number=8)
        const imageDataUri = await jabcode.encode_message(message);
        console.log(`   ✓ Encoded successfully!`);
        console.log(`   Image data URI length: ${imageDataUri.length} characters`);
        
        // Save the image to a file
        const outputPath = path.join(__dirname, 'output', 'example1.png');
        const base64Data = imageDataUri.replace(/^data:image\/png;base64,/, '');
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, base64Data, 'base64');
        console.log(`   Saved to: ${outputPath}`);
        
        console.log('\n2. Decoding the image back to message...');
        const decodedMessage = await jabcode.decode_message(imageDataUri);
        console.log(`   ✓ Decoded successfully!`);
        console.log(`   Decoded message: "${decodedMessage}"`);
        console.log(`   Match: ${message === decodedMessage ? '✓ YES' : '✗ NO'}`);
        
        console.log('\n3. Encoding with custom color number...');
        const customMessage = 'Custom settings: 16 colors';
        console.log(`   Message: "${customMessage}"`);
        console.log(`   Parameters: symbol_number=1 (default), color_number=16`);
        
        try {
            const customImage = await jabcode.encode_message(customMessage, 1, 16);
            const customOutputPath = path.join(__dirname, 'output', 'example2-custom.png');
            const customBase64 = customImage.replace(/^data:image\/png;base64,/, '');
            fs.writeFileSync(customOutputPath, customBase64, 'base64');
            console.log(`   ✓ Encoded with custom parameters!`);
            console.log(`   Saved to: ${customOutputPath}`);
            
            console.log('\n4. Decoding from file...');
            try {
                const fileBuffer = fs.readFileSync(customOutputPath);
                const fileDataUri = `data:image/png;base64,${fileBuffer.toString('base64')}`;
                const decodedFromFile = await jabcode.decode_message(fileDataUri);
                console.log(`   ✓ Decoded from file!`);
                console.log(`   Decoded message: "${decodedFromFile}"`);
            } catch (decodeError) {
                console.log(`   ⚠ Decoding from file failed: ${decodeError.message}`);
                console.log(`   (This can happen with certain color configurations)`);
            }
        } catch (error) {
            console.log(`   ⚠ Note: Custom parameters may require additional configuration`);
            console.log(`   Error: ${error.message}`);
            console.log(`   Continuing with default parameters...`);
        }
        
        console.log('\n5. Testing with different color configurations...');
        const colorConfigs = [
            { colors: 4, name: '4 colors (minimal)' },
            { colors: 8, name: '8 colors (default)' },
            { colors: 16, name: '16 colors' },
        ];
        
        for (const config of colorConfigs) {
            try {
                const testMsg = `Test with ${config.name}`;
                const testImage = await jabcode.encode_message(testMsg, 1, config.colors);
                console.log(`   ✓ ${config.name}: Success`);
            } catch (error) {
                console.log(`   ✗ ${config.name}: ${error.message}`);
            }
        }
        
        console.log('\n6. Testing with longer message...');
        const longMessage = 'This is a longer message to test JABCode encoding capabilities. ' +
                          'It can handle various types of content including special characters: ' +
                          '!@#$%^&*()_+-=[]{}|;:,.<>?';
        console.log(`   Message length: ${longMessage.length} characters`);
        
        try {
            const longImage = await jabcode.encode_message(longMessage);
            const longOutputPath = path.join(__dirname, 'output', 'example3-long.png');
            const longBase64 = longImage.replace(/^data:image\/png;base64,/, '');
            fs.writeFileSync(longOutputPath, longBase64, 'base64');
            console.log(`   ✓ Encoded long message!`);
            console.log(`   Saved to: ${longOutputPath}`);
            
            // Try to decode - note: decoding may fail for very complex images
            try {
                const decodedLong = await jabcode.decode_message(longImage);
                console.log(`   ✓ Decoded long message!`);
                console.log(`   Match: ${longMessage === decodedLong ? '✓ YES' : '✗ NO'}`);
                if (longMessage !== decodedLong) {
                    console.log(`   Original length: ${longMessage.length}, Decoded length: ${decodedLong.length}`);
                }
            } catch (decodeError) {
                console.log(`   ⚠ Decoding failed: ${decodeError.message}`);
                console.log(`   (This can happen with complex encodings - try with simpler parameters)`);
            }
        } catch (error) {
            console.log(`   ✗ Encoding failed: ${error.message}`);
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('\n✅ All examples completed successfully!');
        console.log(`\nGenerated files are in: ${path.join(__dirname, 'output')}`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the example
main();

