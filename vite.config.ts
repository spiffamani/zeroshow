import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  define: { global: 'globalThis' },
  resolve: { alias: { process: 'process/browser', events: 'events/', buffer: 'buffer', util: 'util', stream: 'stream-browserify' } },
  plugins: [react(), wasm(), viteStaticCopy({ targets: [{ src: 'managed/*', dest: 'managed' }] })],
  assetsInclude: ['**/*.wasm'],
  build: { target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  server: { fs: { allow: [root] } },
});
