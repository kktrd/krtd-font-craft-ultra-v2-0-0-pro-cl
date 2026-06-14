import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',          // esbuild is built-in — no extra install
    target: 'es2020',
    esbuildOptions: {
      drop: ['console', 'debugger'],
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
  server: { port: 3000 },
});
