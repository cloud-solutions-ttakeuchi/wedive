import { defineConfig, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          // モノレポのルートにある node_modules から SQLite WASM を取得
          // 相対パスに切り替えたため、__dirname 関連のコードは削除しました
          src: normalizePath('../node_modules/@sqlite.org/sqlite-wasm/jswasm/sqlite3.wasm'),
          dest: './',
        },
      ],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'sqlite3.wasm'],
      workbox: {
        // 前回のビルドで引っかかった 2.2MB の制限を 3MB に拡張
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Wedive',
        short_name: 'Wedive',
        description: 'Wedive Web App',
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
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
});
