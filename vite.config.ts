import { defineConfig } from 'vite';

// Base path for GitHub Pages is configurable via env var so users can publish
// the app under any repo name (e.g. https://user.github.io/<repo>/).
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  // CanvasKit ships a sizable .wasm file; serve it as a static asset.
  assetsInclude: ['**/*.wasm'],
  server: {
    port: 5173,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
});
