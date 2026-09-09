import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 开发环境下将 /api 请求转发到记账后端
      '/api': 'http://localhost:3001',
    },
  },
})
