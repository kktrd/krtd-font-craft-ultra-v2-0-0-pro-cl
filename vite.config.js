import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';

// ── Single source of truth: package.json's "version" field ─────────────────
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// ── Build-time metadata, auto-populated on every deploy, zero manual steps ─
// Vercel exposes these as plain (non-VITE_-prefixed) env vars during build.
// They are ONLY readable here in vite.config.js (Node build context) — Vite
// only exposes VITE_-prefixed vars to client code by default, so `define`
// is used to bridge these specific values into the client bundle as
// compile-time constants.
const buildSha  = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev';
const buildDate = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__:   JSON.stringify(buildSha),
    __BUILD_DATE__:  JSON.stringify(buildDate),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',          // esbuild is built-in — no extra install
    target: 'es2020',
    esbuildOptions: {
      // NOTE: only 'debugger' is dropped, deliberately NOT 'console'. This
      // codebase's console calls are all legitimate production diagnostics
      // (ErrorBoundary's console.error, service-worker registration
      // warnings, storage-integrity warnings) or an intentional branding
      // feature (printConsoleBranding) — dropping 'console' wholesale would
      // silently strip all of these from the production build, defeating
      // their purpose. There is no actual debug-noise console.log left in
      // this codebase to justify the blanket drop.
      drop: ['debugger'],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          icons:    ['lucide-react'],
        },
      },
    },
  },
  worker: {
    format: 'es', // required: transliteration.worker.js uses ES `import`
  },
  server: { port: 3000 },
});
