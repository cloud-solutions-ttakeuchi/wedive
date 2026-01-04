import { defineConfig, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'fs';
import path from 'path';

// SQLite WASM のパスを動的に解決（モノレポの Hoisting に対応）
const getSqliteWasmPath = () => {
  const paths = [
    '../node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm',
    'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm'
  ];
  for (const p of paths) {
    if (fs.existsSync(path.resolve(process.cwd(), p))) {
      return normalizePath(p);
    }
  }
  return normalizePath(paths[0]); // Fallback
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: getSqliteWasmPath(),
          dest: '', // ルート（dist/直下）に配置
        }
      ]
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'sqlite3.wasm'],
      workbox: {
        // 2.2MB の JS ファイルを許容するための 3MB 設定
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Wedive',
        short_name: 'Wedive',
        description: 'Wedive Web App v2', // Update description to force SW update
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // @ts-ignore
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url && req.url.endsWith('.wasm')) {
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
});
