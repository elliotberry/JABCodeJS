const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/js/JabcodeJSInterface.js',
  output: {
    filename: 'jabcodeJSLib.min.js',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    fallback: {
      path: require.resolve("path-browserify"),
      fs: false
    }
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: { comments: false },
          compress: { drop_console: true },
        },
        extractComments: false,
      }),
    ],
  },
};