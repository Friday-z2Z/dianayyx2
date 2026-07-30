import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
    base: '/dianayyx2/',  // GitHub Pages 子路径
  plugins: [vue()],
  server: {
    proxy: {
      '/api/weather': {
        target: 'http://t.weather.itboy.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/weather/, '/api/weather'),
      },
      '/api/eastmoney': {
        target: 'https://push2delay.eastmoney.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/eastmoney/, ''),
      },
      '/api/akshare': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        timeout: 60000,
      },
    },
  },
})
