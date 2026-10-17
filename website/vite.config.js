import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: the website talks to its OWN backend (website-backend, port 5001).
// In production set VITE_API_URL to the website-backend origin instead.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:5001', changeOrigin: true },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
    allowedHosts: true,
  },
})
