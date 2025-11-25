#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../jabcode/src/jabcode/include/jabcode.h"

int main() {
    printf("Testing JABCode library...\n");
    
    // Create encode structure
    jab_encode* enc = createEncode(8, 1);
    if (!enc) {
        printf("Failed to create encode structure\n");
        return 1;
    }
    printf("✓ Encode structure created\n");
    
    // Create test data
    const char* test_msg = "Hello";
    jab_int32 length = strlen(test_msg);
    jab_data* data = (jab_data*)malloc(sizeof(jab_data) + length * sizeof(char));
    if (!data) {
        printf("Failed to allocate data\n");
        destroyEncode(enc);
        return 1;
    }
    data->length = length;
    memcpy(data->data, test_msg, length);
    printf("✓ Test data created\n");
    
    // Generate JABCode
    printf("Generating JABCode...\n");
    fflush(stdout);
    jab_int32 result = generateJABCode(enc, data);
    printf("Generate result: %d\n", result);
    fflush(stdout);
    
    if (result != 0) {
        printf("Failed to generate JABCode: %d\n", result);
        destroyEncode(enc);
        free(data);
        return 1;
    }
    
    printf("✓ JABCode generated successfully\n");
    printf("  Bitmap size: %dx%d\n", enc->bitmap->width, enc->bitmap->height);
    
    // Cleanup
    destroyEncode(enc);
    free(data);
    
    printf("✓ All tests passed!\n");
    return 0;
}

