import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: 'LIS',
        short_name: 'LIS',
        description: 'Internal billing, clients, projects, vendors & expenses — Laavin InfraScapes',
        theme_color: '#2f6b40',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Runtime data (Supabase REST/Storage calls) should never be served from
        // the service worker cache — only the built app shell (JS/CSS/HTML) is.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        // Excel/PDF export & import (exceljs, xlsx, jspdf + its html2canvas/
        // dompurify/font deps) are lazy-loaded and together add up to ~2MB —
        // most staff never touch them. Don't force every visitor to download
        // that upfront; let the browser fetch them normally on first actual
        // use, then cache them via runtimeCaching below for next time.
        globIgnores: [
          '**/exceljs*.js',
          '**/xlsx-*.js',
          '**/jspdf*.js',
          '**/html2canvas-*.js',
          '**/notoSansLedgerFont-*.js',
          '**/purify.es-*.js',
          '**/index.es-*.js',
        ],
        runtimeCaching: [
          {
            // Content-hashed filenames — safe to cache aggressively and
            // indefinitely; a new build ships a new filename, not new bytes
            // under the old one.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'lazy-chunks',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    // listen on all network interfaces so phones on the same Wi-Fi can reach it
    host: true,
  },
})
