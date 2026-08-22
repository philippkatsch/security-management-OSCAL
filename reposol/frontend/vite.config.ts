import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = parseInt(env.REPOSOL_PORT || env.PORT || '1001', 10)
  const strictPort = env.REPOSOL_STRICT_PORT !== 'false'
  const apiTarget = env.REPOSOL_API_TARGET || 'http://127.0.0.1:1000'

  return {
    plugins: [react()],
    server: {
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/health': {
          target: apiTarget,
          changeOrigin: true,
        }
      }
    },
    resolve: {
      alias: {
        '@': '/src',
        '@components': '/src/components',
        '@lib': '/src/lib',
        '@hooks': '/src/hooks',
        '@stores': '/src/stores'
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/tests/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.{js,jsx,ts,tsx}'],
        exclude: ['src/tests/**', 'src/main.jsx', 'src/main.tsx'],
      },
    },
  }
})
