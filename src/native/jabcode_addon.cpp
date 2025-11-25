#include <napi.h>
#include <stdlib.h>
#include <string.h>

// Ensure C linkage for JABCode library functions
extern "C" {
    #include "../../include/jabcode.h"
    #define STB_IMAGE_IMPLEMENTATION
    #include "../../include/stb_image.h"
}

// Helper function to format array data (similar to Emscripten version)
// Returns a newly allocated buffer that caller must free
static unsigned char* format_array(unsigned char* arr, int array_length, char bytes_per_array_elem,
    unsigned char* args, int arg_length, char bytes_per_arg_elem) {
    // Allocate new buffer (caller is responsible for freeing)
    unsigned char* formatted_array = (unsigned char*)malloc(array_length * bytes_per_array_elem
            + arg_length * bytes_per_arg_elem + 8);
    
    if (!formatted_array) {
        return NULL;
    }
    
    unsigned char *arr_length_bytes = (unsigned char*)(&array_length);
    unsigned char *arg_length_bytes = (unsigned char*)(&arg_length);
    
    for (int i = 0; i < 4; i++) {
        formatted_array[i] = arr_length_bytes[i];
        formatted_array[i + 4] = arg_length_bytes[i];
    }
    
    array_length *= bytes_per_array_elem;
    arg_length *= bytes_per_arg_elem;
    
    if (args && arg_length > 0) {
        for (int i = 0; i < arg_length; i++) {
            formatted_array[i + 8] = args[i];
        }
    }
    
    for (int i = 0; i < array_length; i++) {
        formatted_array[i + arg_length + 8] = arr[i];
    }
    
    return formatted_array;
}

// Get default symbol number
Napi::Value GetDefaultSymbolNumber(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, DEFAULT_SYMBOL_NUMBER);
}

// Get default color number
Napi::Value GetDefaultColorNumber(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, DEFAULT_COLOR_NUMBER);
}

// Encode image function
Napi::Value EncodeImage(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Expected at least 1 argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (!info[0].IsString()) {
        Napi::TypeError::New(env, "First argument must be a string").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Extract message string
    std::string data_string = info[0].As<Napi::String>().Utf8Value();
    
    // Get symbol and color numbers (with defaults)
    // Use DEFAULT values instead of MAX values for reasonable performance
    int32_t symbol_num = DEFAULT_SYMBOL_NUMBER;
    int32_t color_num = DEFAULT_COLOR_NUMBER;
    
    if (info.Length() >= 2 && !info[1].IsNull() && !info[1].IsUndefined()) {
        if (!info[1].IsNumber()) {
            Napi::TypeError::New(env, "Second argument must be a number").ThrowAsJavaScriptException();
            return env.Null();
        }
        symbol_num = info[1].As<Napi::Number>().Int32Value();
    }
    
    if (info.Length() >= 3 && !info[2].IsNull() && !info[2].IsUndefined()) {
        if (!info[2].IsNumber()) {
            Napi::TypeError::New(env, "Third argument must be a number").ThrowAsJavaScriptException();
            return env.Null();
        }
        color_num = info[2].As<Napi::Number>().Int32Value();
    }
    
    // Encode the image
    jab_int32 length = data_string.length();
    
    // Allocate memory for jab_data with flexible array member
    // Need to allocate: sizeof(jab_data) + length bytes for data
    size_t data_size = sizeof(jab_data) + length;
    jab_data* data = (jab_data*)malloc(data_size);
    if (!data) {
        Napi::Error::New(env, "Memory allocation for input data failed").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    data->length = length;
    memcpy(data->data, data_string.c_str(), length);
    
    jab_encode* enc = createEncode(color_num, symbol_num);
    if (!enc) {
        free(data);
        Napi::Error::New(env, "Failed to create encode structure").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // generateJABCode returns 0 on success, non-zero on failure
    jab_int32 result = generateJABCode(enc, data);
    
    if (result != 0) {
        destroyEncode(enc);
        free(data);
        std::string error_msg = "Failed to generate JABCode (error code: " + std::to_string(result) + ")";
        Napi::Error::New(env, error_msg.c_str()).ThrowAsJavaScriptException();
        return env.Null();
    }
    
    jab_bitmap* bitmap = enc->bitmap;
    length = (bitmap->height) * (bitmap->width) * (bitmap->bits_per_pixel / 8);
    int args_array[3] = {bitmap->width, bitmap->height, enc->color_number};
    unsigned char* image_data = format_array(bitmap->pixel, length, 1, 
                                             (unsigned char*)args_array, 3, sizeof(int));
    
    if (!image_data) {
        destroyEncode(enc);
        free(data);
        Napi::Error::New(env, "Memory allocation for formatted array failed").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Calculate total size: 8 bytes for metadata + args (12 bytes) + pixel data
    size_t total_size = 8 + 12 + length;
    
    // Create buffer with the formatted data (Copy ensures data persists after function returns)
    Napi::Buffer<unsigned char> buffer = Napi::Buffer<unsigned char>::Copy(env, image_data, total_size);
    
    // Cleanup - free the formatted array since Buffer::Copy made a copy
    free(image_data);
    destroyEncode(enc);
    free(data);
    
    return buffer;
}

// Decode image function
Napi::Value DecodeImage(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Expected 1 argument").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (!info[0].IsBuffer()) {
        Napi::TypeError::New(env, "First argument must be a Buffer").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Get buffer from argument
    Napi::Buffer<unsigned char> buffer = info[0].As<Napi::Buffer<unsigned char>>();
    unsigned char* buffer_data = buffer.Data();
    size_t buffer_length = buffer.Length();
    
    // Decode image using stb_image
    int width, height, channels;
    stbi_uc* img = stbi_load_from_memory(buffer_data, buffer_length, &width, &height, &channels, 4);
    
    if (!img) {
        Napi::Error::New(env, "Failed to load image from memory").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int length = height * width * 4;
    jab_bitmap* bitmap = (jab_bitmap*)malloc(sizeof(jab_bitmap) + length * sizeof(char));
    if (!bitmap) {
        stbi_image_free(img);
        Napi::Error::New(env, "Memory allocation for bitmap failed").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    bitmap->height = height;
    bitmap->width = width;
    bitmap->bits_per_channel = BITMAP_BITS_PER_CHANNEL;
    bitmap->bits_per_pixel = BITMAP_BITS_PER_PIXEL;
    bitmap->channel_count = BITMAP_CHANNEL_COUNT;
    
    for (int i = 0; i < length; i++) {
        bitmap->pixel[i] = img[i];
    }
    
    // Decode JABCode
    jab_int32 mode = 0;
    jab_int32 status;
    jab_decoded_symbol symbols[MAX_SYMBOL_NUMBER];
    jab_data* data = decodeJABCodeEx(bitmap, mode, &status, symbols, MAX_SYMBOL_NUMBER);
    
    // Cleanup
    stbi_image_free(img);
    free(bitmap);
    
    if (!data) {
        Napi::Error::New(env, "Failed to decode JABCode").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    // Format result
    unsigned char* result_data = format_array((unsigned char*)data->data, data->length, 1, NULL, 0, 0);
    
    if (!result_data) {
        free(data);
        Napi::Error::New(env, "Memory allocation for result array failed").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    size_t result_size = 8 + data->length; // 8 bytes for length metadata
    
    // Create result buffer
    Napi::Buffer<unsigned char> result = Napi::Buffer<unsigned char>::Copy(env, result_data, result_size);
    
    // Cleanup - free the formatted array since Buffer::Copy made a copy
    free(result_data);
    free(data);
    
    return result;
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "getDefaultSymbolNumber"),
                Napi::Function::New(env, GetDefaultSymbolNumber));
    exports.Set(Napi::String::New(env, "getDefaultColorNumber"),
                Napi::Function::New(env, GetDefaultColorNumber));
    exports.Set(Napi::String::New(env, "encodeImage"),
                Napi::Function::New(env, EncodeImage));
    exports.Set(Napi::String::New(env, "decodeImage"),
                Napi::Function::New(env, DecodeImage));
    return exports;
}

NODE_API_MODULE(jabcode_native, Init)

