import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The dev server is not started by Vite directly: server.ts boots Express +
// Primus (WebSocket) and mounts Vite in middleware mode on the same port. This
// config only drives `vite build` (client bundle -> dist/) and supplies the
// shared options (React plugin, `@` alias) used in middleware mode.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
  },
});
