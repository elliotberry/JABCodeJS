# JABCodeJS Examples

This directory contains example scripts demonstrating how to use the JABCodeJS library.

## Examples

### 1. Basic Usage (`basic-usage.js`)

A simple example showing the core functionality:
- Encoding messages into JABCode images
- Decoding images back to messages
- Using default and custom parameters
- Saving images to files

**Run:**
```bash
node examples/basic-usage.js
```

**Output:**
- `output/example1.png` - Basic encoding example
- `output/example2-custom.png` - Custom parameters example
- `output/example3-long.png` - Long message example

### 2. Advanced Usage (`advanced-usage.js`)

Advanced features and performance testing:
- Batch encoding/decoding
- Performance benchmarks
- Error handling
- Different symbol/color configurations
- Round-trip verification

**Run:**
```bash
node examples/advanced-usage.js
```

**Output:**
- Multiple configuration examples in `output/` directory
- Performance metrics in console

### 3. Browser Example (`browser-example.html`)

A web-based example for browser usage:
- Interactive encoding/decoding
- UI for testing different parameters
- Demonstrates browser integration

**Usage:**
1. Build the package: `npm run build`
2. Serve the directory: `npm run serve`
3. Open `examples/browser-example.html` in your browser

## Quick Start

### Node.js (Native Addon)

```javascript
import JabcodeJSInterface from './src/js/index.js';

const jabcode = new JabcodeJSInterface();

// Encode a message
const imageDataUri = await jabcode.encode_message('Hello, World!');

// Decode an image
const decodedMessage = await jabcode.decode_message(imageDataUri);
console.log(decodedMessage); // "Hello, World!"
```

### Browser (Emscripten)

```html
<script type="module">
  import JabcodeJSInterface from './dist/jabcodeJSLib.min.js';
  
  const jabcode = new JabcodeJSInterface();
  
  // Encode
  const image = await jabcode.encode_message('Hello, World!');
  
  // Display in img tag
  document.getElementById('myImage').src = image;
</script>
```

## API Reference

### `encode_message(msg, symbol_num?, color_num?)`

Encodes a message into a JABCode image.

**Parameters:**
- `msg` (string): The message to encode
- `symbol_num` (number, optional): Number of symbols (1-61, default: 1)
- `color_num` (number, optional): Number of colors (4, 8, 16, 32, 64, 128, or 256, default: 8)

**Returns:** Promise<string> - Base64-encoded PNG image data URI

**Example:**
```javascript
// Default settings
const image1 = await jabcode.encode_message('Hello');

// Custom settings
const image2 = await jabcode.encode_message('Hello', 2, 16);
```

### `decode_message(img)`

Decodes a JABCode image back to a message.

**Parameters:**
- `img` (string|ArrayBuffer|Blob): Image data (base64 string, ArrayBuffer, or Blob)

**Returns:** Promise<string> - The decoded message

**Example:**
```javascript
// From data URI
const message1 = await jabcode.decode_message(imageDataUri);

// From file
const fileBuffer = fs.readFileSync('code.png');
const dataUri = `data:image/png;base64,${fileBuffer.toString('base64')}`;
const message2 = await jabcode.decode_message(dataUri);
```

## Notes

- The native addon provides the best performance in Node.js
- The Emscripten build works in browsers and Node.js (fallback)
- Symbol and color numbers affect encoding capacity and image size
- Larger color numbers allow more data but create larger images
- Multiple symbols can increase capacity but require more processing

## Troubleshooting

### Native addon not found
If you see "Native addon not found", run:
```bash
npm run build:native
```

### Build errors
Make sure you have:
- Node.js 14+ installed
- Python 3.x installed (for node-gyp)
- Build tools (Xcode Command Line Tools on macOS, Visual Studio Build Tools on Windows)

### Browser compatibility
The Emscripten build requires:
- Modern browser with WebAssembly support
- ES6 module support

