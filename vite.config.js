import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Root .env se variables load karo (process.env nahi, loadEnv use karo)
  const env = loadEnv(mode, process.cwd(), '')

  const FRONTEND_PORT  = parseInt(env.FRONTEND_PORT)  || 5173
  const BACKEND_PORT   = parseInt(env.BACKEND_PORT)   || 5000

  const proxyTarget = `http://localhost:${BACKEND_PORT}`

  return {
    plugins: [react()],
    server: {
      open: true,
      host: true,
      port: FRONTEND_PORT,
      proxy: {
        // API calls
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        // Uploaded files (grievance attachments, etc.)
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
        }
      }
    }
  }
})
