import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { DisplayOverride } from 'vite-plugin-pwa';

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
      includeAssets: ['PWAicon.png'],
      manifest: {
        name: 'ArtVision Pro',
        short_name: 'ArtVision Pro',
        description: 'Professional painting critique and feedback tool. Upload your artwork, choose a style and medium, and receive structured feedback across eight criteria benchmarked against the masters.',
        theme_color: '#7c3aed',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        lang: 'en-US',
        categories: ['education', 'productivity', 'utilities'] as unknown as string[],
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'] as DisplayOverride[],
        edge_side_panel: { preferred_width: 400 },
        handle_links: 'preferred',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,jpg,jpeg,webmanifest}'],
        /** Bottom-nav asset (~2.3MB); load on demand instead of precaching Workbox’s 2 MiB default limit. */
        globIgnores: ['**/critique.png'],
      },
    }),
  ],
});
