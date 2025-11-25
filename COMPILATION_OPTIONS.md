# Better Compilation Options for Node.js

## Current Setup Analysis

The current build uses **Emscripten with `WASM=0`**, which means:
- ❌ Compiles to asm.js/JavaScript (not WebAssembly)
- ❌ Larger bundle size (~295KB)
- ❌ Slower performance than native or WASM
- ✅ Works in browsers and Node.js (universal)

## Recommended Options for Node.js

### Option 1: Enable WebAssembly (Easiest - Recommended First Step)

**Pros:**
- ✅ Much faster than current JavaScript output
- ✅ Smaller binary size
- ✅ Better performance (near-native speed)
- ✅ Still works in browsers and Node.js
- ✅ Minimal code changes needed

**Cons:**
- ⚠️ Requires WASM support (Node.js 8+ has it)
- ⚠️ Slightly more complex loading (async)

**Implementation:**
```makefile
# Change WASM=0 to WASM=1
$(EMCC) -Oz $(SRCS) ./include/libjabcode.a -o $(NAME) \
  -s EXPORTED_FUNCTIONS=["_free","_malloc"] \
  -s EXPORTED_RUNTIME_METHODS=["cwrap","ccall"] \
  -s WASM=1 \                    # Enable WASM
  -s SINGLE_FILE=0 \             # WASM needs separate .wasm file
  -s FILESYSTEM=0 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="createModule"
```

**Performance Gain:** ~2-5x faster than current setup

---

### Option 2: Native Node.js Addon with N-API (Best Performance for Node.js)

**Pros:**
- ✅ **Fastest performance** (native machine code)
- ✅ Smallest binary size
- ✅ Direct memory access
- ✅ No WASM overhead
- ✅ Can use Node.js streams, buffers directly

**Cons:**
- ❌ Node.js only (no browser support)
- ❌ Requires compilation per platform (needs node-gyp)
- ❌ More complex build setup
- ❌ Platform-specific binaries

**Implementation Approach:**

1. **Create N-API wrapper** (`src/native/jabcode_addon.c`):
```c
#include <node_api.h>
#include "../../include/jabcode.h"

// N-API wrapper functions
napi_value EncodeImage(napi_env env, napi_callback_info info) {
    // Extract arguments from JavaScript
    // Call JABCode C functions
    // Return result to JavaScript
}

napi_value DecodeImage(napi_env env, napi_callback_info info) {
    // Similar wrapper for decode
}

NAPI_MODULE_INIT() {
    napi_value exports;
    napi_create_object(env, &exports);
    
    napi_property_descriptor desc[] = {
        {"encode", NULL, EncodeImage, NULL, NULL, NULL, napi_default, NULL},
        {"decode", NULL, DecodeImage, NULL, NULL, NULL, napi_default, NULL}
    };
    napi_define_properties(env, exports, 2, desc);
    return exports;
}
```

2. **Create `binding.gyp`**:
```json
{
  "targets": [
    {
      "target_name": "jabcode_native",
      "sources": [
        "src/native/jabcode_addon.c",
        "src/C/jabcode_interface.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include"
      ],
      "libraries": ["<(module_root_dir)/include/libjabcode.a"],
      "cflags": ["-O3"],
      "conditions": [
        ["OS=='mac'", {"libraries": []}],
        ["OS=='win'", {"libraries": []}]
      ]
    }
  ]
}
```

3. **Update package.json**:
```json
{
  "main": "dist/node-native.js",
  "gypfile": true,
  "scripts": {
    "install": "node-gyp rebuild",
    "build:native": "node-gyp build"
  }
}
```

**Performance Gain:** ~5-10x faster than WASM, ~10-20x faster than current JS

---

### Option 3: Hybrid Approach (Best of Both Worlds)

**Strategy:** Build both native addon (Node.js) and WASM (browser)

**Pros:**
- ✅ Native performance in Node.js
- ✅ Browser compatibility via WASM
- ✅ Single codebase
- ✅ Automatic fallback

**Cons:**
- ⚠️ More complex build system
- ⚠️ Two build outputs to maintain

**Implementation:**

1. **Create dual build system**:
   - `Makefile.node` - Native addon build
   - `Makefile.wasm` - WASM build for browser
   - `package.json` scripts handle both

2. **JavaScript wrapper detects environment**:
```javascript
let jabcode;
if (typeof window === 'undefined' && typeof process !== 'undefined') {
    // Node.js - use native addon
    jabcode = require('./build/Release/jabcode_native.node');
} else {
    // Browser - use WASM
    jabcode = await import('./jabcode.wasm');
}
```

---

## Performance Comparison

| Method | Node.js Speed | Browser Support | Bundle Size | Build Complexity |
|--------|--------------|-----------------|-------------|------------------|
| **Current (asm.js)** | 1x (baseline) | ✅ Yes | ~295KB | Low |
| **WASM (Option 1)** | ~2-5x faster | ✅ Yes | ~150KB | Low |
| **Native Addon (Option 2)** | ~10-20x faster | ❌ No | ~50KB | Medium |
| **Hybrid (Option 3)** | ~10-20x (Node)<br>~2-5x (Browser) | ✅ Yes | Varies | High |

---

## Recommendation

### For Immediate Improvement:
**Start with Option 1 (Enable WASM)** - Minimal changes, significant performance gain

### For Maximum Node.js Performance:
**Implement Option 2 (Native Addon)** - Best performance, but Node.js-only

### For Production Library:
**Implement Option 3 (Hybrid)** - Best user experience, supports all environments

---

## Migration Path

1. **Phase 1:** Enable WASM (1-2 hours)
   - Update Makefile
   - Update JavaScript loader
   - Test in Node.js and browser

2. **Phase 2:** Add Native Addon (1-2 days)
   - Create N-API wrapper
   - Set up node-gyp build
   - Create environment detection

3. **Phase 3:** Optimize (ongoing)
   - Profile and optimize hot paths
   - Add TypeScript definitions
   - Improve error handling

---

## Additional Considerations

### TypeScript Support
All options can generate TypeScript definitions using tools like:
- `tsc --declaration` for JavaScript
- `node-addon-api` generates types for native addons
- `wasm-bindgen` for WASM (if using Rust toolchain)

### Memory Management
- **WASM:** Uses Emscripten's heap, good for most cases
- **Native:** Direct access to Node.js buffers, more efficient
- **Current:** JavaScript heap, least efficient

### Threading
- **WASM:** Can use Web Workers (browser) or Worker Threads (Node.js)
- **Native:** Can use Node.js Worker Threads directly
- **Current:** Single-threaded JavaScript

---

## Tools & Resources

- **Emscripten:** https://emscripten.org/
- **N-API Documentation:** https://nodejs.org/api/n-api.html
- **node-addon-api:** https://github.com/nodejs/node-addon-api
- **node-gyp:** https://github.com/nodejs/node-gyp
- **WebAssembly:** https://webassembly.org/

