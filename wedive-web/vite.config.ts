import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          // path.resolve(__dirname, ...) を使って絶対パスを作る
          // normalizePath で Windows/Linux 両方のパス区切りに対応させる
          src: normalizePath(
            path.resolve(__dirname, '../node_modules/@sqlite.org/sqlite-wasm/jswasm/sqlite3.wasm')
          ),
          dest: './', // dist 直下に配置
        },
      ],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'sqlite3.wasm'],
      manifest: {
        name: 'WeDive',
        short_name: 'WeDive',
        description: 'Connect with divers, explore the ocean.',
        theme_color: '#082f49',
        background_color: '#082f49',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
      },
    })
  ],
  assetsInclude: ['**/*.wasm'],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5001/dive-dex-app-dev/asia-northeast1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
