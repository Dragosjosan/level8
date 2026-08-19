import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const proxyTarget =
    loadEnv(mode, process.cwd(), '').VITE_API_PROXY_TARGET ?? 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': proxyTarget,
      },
    },
  }
})
