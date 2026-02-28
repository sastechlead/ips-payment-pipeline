import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Local dev: proxy /api calls to query-service
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
})
