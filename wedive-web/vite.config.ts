import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// import { VitePWA } from 'vite-plugin-pwa';
// import { viteStaticCopy } from 'vite-plugin-static-copy';
// import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    fs: {
      // モノレポ構成でルートの node_modules にアクセスするために必要
      allow: ['..'],
    },
  },
  // @ts-ignore
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url && req.url.includes('.wasm')) {
        res.setHeader('Content-Type', 'application/wasm');
      }
      next();
    });
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  resolve: {
    alias: {
      '@sqlite-wasm': path.resolve(__dirname, '../node_modules/@sqlite.org/sqlite-wasm'),
    },
  },
  build: {
  },
});
