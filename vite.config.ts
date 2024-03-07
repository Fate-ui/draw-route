import path from 'path'
import { defineConfig } from 'vite'
import { createVitePlugins } from './config/vitePlugin'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const base = mode === 'development' ? '/' : '/draw-route'
  return {
    base,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    plugins: createVitePlugins(),
    server: {
      host: '0.0.0.0',
      hmr: true,
      open: false,
      proxy: {
        '/api': {
          target: 'http://192.168.101.13:5000/',
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(new RegExp('^/api'), '')
        }
      }
    }
  }
})
