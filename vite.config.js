import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  define: {
    __ARTIFACT__: JSON.stringify(mode === 'artifact'),
  },
  server: { host: true, port: 5173 },
  // keep the bundle ASCII-only: esbuild would otherwise fold \u escapes (e.g.
  // the combining-marks regex) into raw bytes, which break without a charset.
  esbuild: { charset: 'ascii' },
  build: {
    target: 'es2022',
    outDir: mode === 'artifact' ? 'dist-artifact' : 'dist',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 20000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
}));
