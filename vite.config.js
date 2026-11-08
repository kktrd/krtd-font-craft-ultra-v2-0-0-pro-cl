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
  // Valid Vite option (the old `build.esbuildOptions` was silently ignored).
  // Only 'debugger' is dropped, deliberately NOT 'console': the console calls here are
  // legitimate production diagnostics (ErrorBoundary, service-worker, storage warnings)
  // or the intentional console branding.
  esbuild: { drop: ['debugger'] },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',          // esbuild is built-in — no extra install
    target: 'es2020',
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
