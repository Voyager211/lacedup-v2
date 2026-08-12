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

const proxied = ['/api', '/uploads', '/images'];

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
    /**
     * Vite's default is 500kB, which the vendor chunk alone exceeds - React,
     * Redux Toolkit, RTK Query, React Router, Radix, axios, zod and
     * react-hook-form come to ~516kB minified (~166kB gzipped) before a single
     * page exists. Raised just past that baseline so the warning still fires
     * on a real regression instead of being ignored on every build.
     */
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        /**
         * Vendor code in its own chunk.
         *
         * It does not reduce what a first-time visitor downloads, but during a
         * migration that rewrites 49 pages the app chunk changes constantly
         * while these libraries barely move - so returning visitors re-fetch
         * only the part that actually changed.
         */
        manualChunks: (id: string) =>
          id.includes('node_modules') ? 'vendor' : undefined
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
