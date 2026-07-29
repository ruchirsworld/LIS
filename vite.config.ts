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
        name: 'Laavin Internal System (LIS 1.8)',
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
      },
    }),
  ],
  server: {
    // listen on all network interfaces so phones on the same Wi-Fi can reach it
    host: true,
  },
})
