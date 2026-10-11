import { defineConfig } from 'vite';

// /voicebox/* -> the Voicebox app on this computer (own voice model), same-origin
// from the dev server so it needs no CORS setup and also works from phones on
// the LAN. When the app is closed it answers 204 quietly (browser voices).
function voiceboxBridge() {
  const handle = async (req, res, next) => {
    if (!req.url.startsWith('/voicebox/')) return next();
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const r = await fetch('http://127.0.0.1:17493' + req.url.slice('/voicebox'.length), {
        method: req.method,
        headers: req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {},
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      });
      res.statusCode = r.status;
      const type = r.headers.get('content-type');
      if (type) res.setHeader('Content-Type', type);
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch {
      res.statusCode = 204;
      res.end();
    }
  };
  return { name: 'voicebox-bridge', configureServer: (s) => { s.middlewares.use(handle); }, configurePreviewServer: (s) => { s.middlewares.use(handle); } };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [voiceboxBridge()],
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
