/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts';

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { '~': resolve(import.meta.dirname, 'src') },
  },
  plugins: [preact(), crx({ manifest })],
  // Integration builds carry the instrumentation, releases must not. A constant
  // (not a setting) so esbuild folds `__KT_METRICS__ ? live : NOOP` and the live
  // sink never reaches a shipped bundle. scripts/check-strip.ts enforces it.
  define: {
    __KT_METRICS__: JSON.stringify(process.env.KT_METRICS === '1'),
    __KT_DEV__: JSON.stringify(process.env.KT_DEV === '1'),
    __KT_BUILD__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: 'es2022',
    minify: mode === 'production' ? 'esbuild' : false,
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5174 },
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.*', 'src/**/index.ts'],
    },
  },
}));
