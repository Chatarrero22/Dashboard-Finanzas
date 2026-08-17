import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En produccion el server de Node sirve estos archivos ya compilados,
// asi que /api es el mismo origen y no hace falta configurar nada.
// En desarrollo (npm run dev) redirigimos /api al backend.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
