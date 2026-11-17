import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt', includeAssets: ['favicon.svg', 'icons/*.png', 'licenses/*.txt', 'licenses/*.json'],
    manifest: { name: 'PROS · Your personal RPG', short_name: 'PROS', description: 'Grow your skills. Restore your world.', theme_color: '#0b1115', background_color: '#0b1115', display: 'standalone', start_url: '/', scope: '/', orientation: 'any', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'], navigateFallback: '/index.html', maximumFileSizeToCacheInBytes: 4_000_000, runtimeCaching: [{ urlPattern: /\/audio\/ambience\/.*\.wav$/, handler: 'CacheFirst', options: { cacheName: 'pros-ambience-v1', rangeRequests: true, cacheableResponse: { statuses: [200], headers: { 'X-PROS-Offline': 'saved' } }, expiration: { maxEntries: 2 } } }, { urlPattern: /\/audio\/.*\.mp3$/, handler: 'CacheFirst', options: { cacheName: 'pros-soundtracks-v1', rangeRequests: true, cacheableResponse: { statuses: [200], headers: { 'X-PROS-Offline': 'saved' } }, expiration: { maxEntries: 3 } } }] },
  })],
  build: { chunkSizeWarningLimit: 700 },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 20000 },
});
