import terser from '@rollup/plugin-terser';

export default [
  // ESM build
  {
    input: 'src/WindowSync.js',
    output: {
      file: 'dist/window-sync.esm.js',
      format: 'es'
    }
  },
  // UMD build
  {
    input: 'src/WindowSync.js',
    output: {
      file: 'dist/window-sync.js',
      format: 'umd',
      name: 'WindowSync'
    }
  },
  // Minified UMD build
  {
    input: 'src/WindowSync.js',
    output: {
      file: 'dist/window-sync.min.js',
      format: 'umd',
      name: 'WindowSync'
    },
    plugins: [terser()]
  }
];
