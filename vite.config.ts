import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';

export default defineConfig(({ mode }) => {
  if (mode === 'production' && (!process.env.VITE_LEGAL_OPERATOR || !process.env.VITE_LEGAL_EMAIL)) {
    console.warn(
      '\n\u26a0  VITE_LEGAL_OPERATOR / VITE_LEGAL_EMAIL are not set: /privacy and /terms will show an "operator not configured" notice to visitors.\n'
    );
  }
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
