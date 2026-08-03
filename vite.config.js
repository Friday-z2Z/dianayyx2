import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
    base: '/dianayyx2/',  // GitHub Pages 子路径
  plugins: [vue()],
  server: {
    host: '0.0.0.0',  // 允许局域网 IP 访问
    port: 5173,
  },
})
