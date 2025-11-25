import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    entry: './src/js/JabcodeJSInterface.js',
    output: {
        filename: 'jabcodeJSLib.min.js',
        path: path.resolve(__dirname, 'dist'),
        library: {
            name: 'JabcodeJSInterface',
            type: 'umd',
            export: 'default'
        },
        globalObject: 'this'
    },
    resolve: {
        fallback: {
            path: 'path-browserify',
            fs: false
        }
    },
    mode: 'production',
    optimization: {
        minimize: true
    }
};
