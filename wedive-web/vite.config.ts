import { defineConfig, normalizePath } from 'vite'; // normalizePath を追加
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'node:path'; // node:path をインポート
import { fileURLToPath } from 'node:url'; // モジュール形式での __dirname 互換用

// ESM（type: module）環境で __dirname を再現する
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          // 1. 相対パスとワイルドカードを使い、ルートまたはローカルの node_modules から探し出す
          // 2. 階層のズレを許容する
          src: normalizePath('../node_modules/@sqlite.org/sqlite-wasm/jswasm/sqlite3.wasm'),
          dest: './',
        },
        {
          // 保険：もしパッケージ直下にある場合
          src: normalizePath('node_modules/@sqlite.org/sqlite-wasm/jswasm/sqlite3.wasm'),
          dest: './',
        }
      ],
      // 見つからなくてもビルド自体は止めない設定（デバッグのため、一旦 true にしても良いですが基本 false）
      // failOnNoMatch: false
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'sqlite3.wasm'], // キャッシュ対象に含める
      workbox: {
        // キャッシュサイズの上限を 3MiB に引き上げる（デフォルトは 2MiB）
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // globPatterns などの詳細設定が必要な場合はここに追加
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
