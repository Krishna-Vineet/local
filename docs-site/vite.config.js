import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': { target: process.env.DOCS_API_TARGET || 'http://127.0.0.1:5000', changeOrigin: true },
      '/lead-api': {
        target: process.env.DOCS_LEADS_API_TARGET || 'http://127.0.0.1:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lead-api/, '/api'),
      },
    },
  },
  preview: { host: '0.0.0.0', allowedHosts: true },
});
