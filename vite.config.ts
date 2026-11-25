import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({ mode }) => ({
  base: mode === 'native-demo' ? '/' : process.env.VITE_BASE_PATH || '/',
  plugins: [react(), VitePWA({
    disable: mode === 'native-demo',
    registerType: 'prompt', includeAssets: ['favicon.svg', 'icons/*.png', 'licenses/*.txt', 'licenses/*.json'],
    manifest: { name: 'PROS · Personal RPG Operating System', short_name: 'PROS', description: 'Grow your skills. Restore your world.', theme_color: '#0b1115', background_color: '#0b1115', display: 'standalone', start_url: './', scope: './', orientation: 'any', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] },
    workbox: { globIgnores: ['**/local-ai-*.js','**/local-ai-*.css'], globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'], navigateFallback: 'index.html', maximumFileSizeToCacheInBytes: 4_000_000, runtimeCaching: [{ urlPattern: /\/assets\/local-ai-[^/]+\.(?:js|css)$/, handler:'CacheFirst', options:{cacheName:'pros-local-ai-runtime-v1',cacheableResponse:{statuses:[200]},expiration:{maxEntries:8,maxAgeSeconds:31536000}} }, { urlPattern: /\/audio\/ambience\/.*\.wav$/, handler: 'CacheFirst', options: { cacheName: 'pros-ambience-v1', rangeRequests: true, cacheableResponse: { statuses: [200], headers: { 'X-PROS-Offline': 'saved' } }, expiration: { maxEntries: 2 } } }, { urlPattern: /\/audio\/.*\.mp3$/, handler: 'CacheFirst', options: { cacheName: 'pros-soundtracks-v1', rangeRequests: true, cacheableResponse: { statuses: [200], headers: { 'X-PROS-Offline': 'saved' } }, expiration: { maxEntries: 3 } } }] },
  })],
  server: { watch: { ignored: ['**/native/**'] } },
  build: { chunkSizeWarningLimit: 700 },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 20000 },
}));
