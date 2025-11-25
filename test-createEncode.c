#include <stdio.h>
#include <stdlib.h>
#include "../jabcode/src/jabcode/include/jabcode.h"

int main() {
    printf("Testing createEncode directly...\n");
    fflush(stdout);
    
    printf("Calling createEncode(8, 1)...\n");
    fflush(stdout);
    
    jab_encode* enc = createEncode(8, 1);
    
    printf("createEncode returned: %p\n", (void*)enc);
    fflush(stdout);
    
    if (enc) {
        printf("Success! Color: %d, Symbol: %d\n", enc->color_number, enc->symbol_number);
        destroyEncode(enc);
        return 0;
    } else {
        printf("Failed!\n");
        return 1;
    }
}

