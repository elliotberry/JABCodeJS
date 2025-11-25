{
  "targets": [
    {
      "target_name": "jabcode_native",
      "sources": [
        "src/native/jabcode_addon.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include",
        "<!@(node -p \"require('node-addon-api').include_dir\")"
      ],
      "libraries": [
        "<(module_root_dir)/include/libjabcode.a"
      ],
      "cflags": [
        "-O3",
        "-Wall",
        "-Wextra"
      ],
      "cflags_cc": [
        "-O3",
        "-Wall",
        "-Wextra"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS"
      ],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.9"
          }
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }],
        ["OS=='linux'", {
          "cflags": [
            "-fPIC"
          ]
        }]
      ]
    }
  ]
}

