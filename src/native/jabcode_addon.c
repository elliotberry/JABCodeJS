#include <node_api.h>
#include <stdlib.h>
#include <string.h>
#include "../../include/jabcode.h"
#define STB_IMAGE_IMPLEMENTATION
#include "../../include/stb_image.h"

// Helper function to format array data (similar to Emscripten version)
static unsigned char* format_array(unsigned char* arr, int array_length, char bytes_per_array_elem,
    unsigned char* args, int arg_length, char bytes_per_arg_elem) {
    static unsigned char* formatted_array = NULL;
    
    if (formatted_array) {
        free(formatted_array);
    }
    
    formatted_array = (unsigned char*)malloc(array_length * bytes_per_array_elem
            + arg_length * bytes_per_arg_elem + 8);
    
    unsigned char *arr_length_bytes = (unsigned char*)(&array_length);
    unsigned char *arg_length_bytes = (unsigned char*)(&arg_length);
    
    for (int i = 0; i < 4; i++) {
        formatted_array[i] = arr_length_bytes[i];
        formatted_array[i + 4] = arg_length_bytes[i];
    }
    
    array_length *= bytes_per_array_elem;
    arg_length *= bytes_per_arg_elem;
    
    for (int i = 0; i < arg_length; i++) {
        formatted_array[i + 8] = args[i];
    }
    
    for (int i = 0; i < array_length; i++) {
        formatted_array[i + arg_length + 8] = arr[i];
    }
    
    return formatted_array;
}

// Helper function to create a Node.js Buffer from C data
static napi_value create_buffer(napi_env env, unsigned char* data, size_t length) {
    void* buffer_data;
    napi_value buffer;
    
    napi_create_buffer(env, length, &buffer_data, &buffer);
    memcpy(buffer_data, data, length);
    
    return buffer;
}

// Get default symbol number
static napi_value GetDefaultSymbolNumber(napi_env env, napi_callback_info info) {
    napi_value result;
    napi_create_int32(env, MAX_SYMBOL_NUMBER, &result);
    return result;
}

// Get default color number
static napi_value GetDefaultColorNumber(napi_env env, napi_callback_info info) {
    napi_value result;
    napi_create_int32(env, MAX_COLOR_NUMBER, &result);
    return result;
}

// Encode image function
static napi_value EncodeImage(napi_env env, napi_callback_info info) {
    size_t argc = 3;
    napi_value args[3];
    napi_value result;
    
    // Get arguments
    if (napi_get_cb_info(env, info, &argc, args, NULL, NULL) != napi_ok) {
        napi_throw_error(env, NULL, "Failed to get callback info");
        return NULL;
    }
    
    if (argc < 1) {
        napi_throw_error(env, NULL, "Expected at least 1 argument");
        return NULL;
    }
    
    // Extract message string
    size_t str_len;
    if (napi_get_value_string_utf8(env, args[0], NULL, 0, &str_len) != napi_ok) {
        napi_throw_error(env, NULL, "Failed to get string length");
        return NULL;
    }
    
    char* data_string = (char*)malloc(str_len + 1);
    if (!data_string) {
        napi_throw_error(env, NULL, "Memory allocation failed");
        return NULL;
    }
    
    if (napi_get_value_string_utf8(env, args[0], data_string, str_len + 1, &str_len) != napi_ok) {
        free(data_string);
        napi_throw_error(env, NULL, "Failed to get string value");
        return NULL;
    }
    
    // Get symbol and color numbers (with defaults)
    int32_t symbol_num = MAX_SYMBOL_NUMBER;
    int32_t color_num = MAX_COLOR_NUMBER;
    
    if (argc >= 2 && args[1] != NULL) {
        napi_get_value_int32(env, args[1], &symbol_num);
    }
    
    if (argc >= 3 && args[2] != NULL) {
        napi_get_value_int32(env, args[2], &color_num);
    }
    
    // Encode the image
    jab_int32 length = strlen(data_string);
    jab_data* data = (jab_data*)malloc(sizeof(jab_data) + length * sizeof(char));
    if (!data) {
        free(data_string);
        napi_throw_error(env, NULL, "Memory allocation for input data failed");
        return NULL;
    }
    
    data->length = length;
    memcpy(data->data, data_string, length);
    
    jab_encode* enc = createEncode(color_num, symbol_num);
    if (!enc) {
        free(data_string);
        free(data);
        napi_throw_error(env, NULL, "Failed to create encode structure");
        return NULL;
    }
    
    if (generateJABCode(enc, data) != JAB_SUCCESS) {
        destroyEncode(enc);
        free(data_string);
        free(data);
        napi_throw_error(env, NULL, "Failed to generate JABCode");
        return NULL;
    }
    
    jab_bitmap* bitmap = enc->bitmap;
    length = (bitmap->height) * (bitmap->width) * (bitmap->bits_per_pixel / 8);
    int args_array[3] = {bitmap->width, bitmap->height, enc->color_number};
    unsigned char* image_data = format_array(bitmap->pixel, length, 1, 
                                             (unsigned char*)args_array, 3, sizeof(int));
    
    // Calculate total size: 8 bytes for metadata + args (12 bytes) + pixel data
    size_t total_size = 8 + 12 + length;
    
    // Create buffer with the formatted data
    result = create_buffer(env, image_data, total_size);
    
    // Cleanup
    destroyEncode(enc);
    free(data_string);
    free(data);
    // Note: formatted_array is static and will be freed on next call or module unload
    
    return result;
}

// Decode image function
static napi_value DecodeImage(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    napi_value result;
    
    // Get arguments
    if (napi_get_cb_info(env, info, &argc, args, NULL, NULL) != napi_ok) {
        napi_throw_error(env, NULL, "Failed to get callback info");
        return NULL;
    }
    
    if (argc < 1) {
        napi_throw_error(env, NULL, "Expected 1 argument");
        return NULL;
    }
    
    // Get buffer from argument
    bool is_buffer;
    if (napi_is_buffer(env, args[0], &is_buffer) != napi_ok || !is_buffer) {
        napi_throw_error(env, NULL, "Expected Buffer as argument");
        return NULL;
    }
    
    unsigned char* buffer_data;
    size_t buffer_length;
    if (napi_get_buffer_info(env, args[0], (void**)&buffer_data, &buffer_length) != napi_ok) {
        napi_throw_error(env, NULL, "Failed to get buffer info");
        return NULL;
    }
    
    // Decode image using stb_image
    int width, height, channels;
    stbi_uc* img = stbi_load_from_memory(buffer_data, buffer_length, &width, &height, &channels, 4);
    
    if (!img) {
        napi_throw_error(env, NULL, "Failed to load image from memory");
        return NULL;
    }
    
    int length = height * width * 4;
    jab_bitmap* bitmap = (jab_bitmap*)malloc(sizeof(jab_bitmap) + length * sizeof(char));
    if (!bitmap) {
        stbi_image_free(img);
        napi_throw_error(env, NULL, "Memory allocation for bitmap failed");
        return NULL;
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
    jab_int32 mode;
    jab_int32 status;
    jab_decoded_symbol symbols[MAX_SYMBOL_NUMBER];
    jab_data* data = decodeJABCodeEx(bitmap, mode, &status, symbols, MAX_SYMBOL_NUMBER);
    
    // Cleanup
    stbi_image_free(img);
    free(bitmap);
    
    if (!data) {
        napi_throw_error(env, NULL, "Failed to decode JABCode");
        return NULL;
    }
    
    // Format result
    unsigned char* result_data = format_array((unsigned char*)data->data, data->length, 1, NULL, 0, 0);
    size_t result_size = 8 + data->length; // 8 bytes for length metadata
    
    // Create result buffer
    result = create_buffer(env, result_data, result_size);
    
    // Cleanup
    free(data);
    
    return result;
}

// Module initialization
static napi_value Init(napi_env env, napi_value exports) {
    napi_property_descriptor descriptors[] = {
        {
            "getDefaultSymbolNumber",
            NULL,
            GetDefaultSymbolNumber,
            NULL,
            NULL,
            NULL,
            napi_default,
            NULL
        },
        {
            "getDefaultColorNumber",
            NULL,
            GetDefaultColorNumber,
            NULL,
            NULL,
            NULL,
            napi_default,
            NULL
        },
        {
            "encodeImage",
            NULL,
            EncodeImage,
            NULL,
            NULL,
            NULL,
            napi_default,
            NULL
        },
        {
            "decodeImage",
            NULL,
            DecodeImage,
            NULL,
            NULL,
            NULL,
            napi_default,
            NULL
        }
    };
    
    napi_define_properties(env, exports, 4, descriptors);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)

