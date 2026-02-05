import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'app/renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'app/renderer/dist'),
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'app/renderer/index.html'),
      },
    },
  },
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'app/renderer/src'),
    },
  },
});
