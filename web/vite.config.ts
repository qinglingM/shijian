import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    host: true,
    proxy: {
      '/proxy/amap': {
        target: 'https://store.is.autonavi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/amap/, ''),
      },
    },
  },
})
