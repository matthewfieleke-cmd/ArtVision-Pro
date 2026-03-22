import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** GitHub project Pages: set VITE_BASE=/YourRepoName/ at build time. User/org root site: leave unset or use /. */
function appBase(): string {
  const raw = process.env.VITE_BASE;
  if (raw === undefined || raw === '' || raw === '/') return '/';
  const lead = raw.startsWith('/') ? raw : `/${raw}`;
  return lead.endsWith('/') ? lead : `${lead}/`;
}

export default defineConfig({
  base: appBase(),
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ArtVision Pro',
        short_name: 'ArtVision',
        description: 'Professional painting critique based on master benchmarks',
        theme_color: '#312e81',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        // Relative to manifest URL so install + launch work under GitHub Pages project paths (/repo/).
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
});
