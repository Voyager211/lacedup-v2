/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The Express backend during development. Everything the API and the static
 * uploads live behind is proxied there so the browser sees one origin - which
 * matters because auth is carried in httpOnly cookies, and a cross-origin
 * setup would need CORS plus SameSite=None on every one of them.
 */
const BACKEND = 'http://localhost:3000';

/**
 * `/google` is here because OAuth is a full browser navigation, not a fetch -
 * the browser has to leave for Google and come back to the backend's callback.
 * In production both live on one origin; proxying it keeps dev the same.
 */
const proxied = ['/api', '/uploads', '/images', '/google'];

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: { '@': path.resolve(here, 'src') }
  },

  server: {
    port: 5173,
    proxy: Object.fromEntries(
      proxied.map((route) => [route, { target: BACKEND, changeOrigin: true }])
    )
  },

  build: {
    // Vite's default 500kB warning is left in place: with the split below, the
    // largest chunk is comfortably under it, so the warning stays meaningful
    // rather than being something to raise every time a library is added.
    rollupOptions: {
      output: {
        /**
         * Vendor code split by how often it changes and who needs it.
         *
         * None of this reduces a first-time visit, but during a migration that
         * rewrites 49 pages the app chunk changes constantly while these
         * libraries barely move - so returning visitors re-fetch only what
         * actually changed. Splitting the form stack out separately also keeps
         * each chunk under the size budget rather than growing one monolith
         * until the warning has to be raised again.
         */
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) return undefined;

          if (/[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) {
            return 'react-vendor';
          }

          if (/[\\/]node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/.test(id)) {
            return 'form-vendor';
          }

          return 'vendor';
        }
      }
    }
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts']
    }
  }
});
