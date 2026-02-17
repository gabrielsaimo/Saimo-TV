import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/Saimo-TV/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunks - bibliotecas externas
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('hls.js')) {
              return 'vendor-hls';
            }
            // Outras bibliotecas em um chunk separado
            return 'vendor';
          }
          // Players em chunk separado
          if (id.includes('/components/VideoPlayer') || id.includes('/components/MoviePlayer')) {
            return 'player';
          }
          // Catálogo em chunk separado
          if (id.includes('/components/MovieCatalog') || id.includes('/components/MovieCard')) {
            return 'catalog';
          }
          // TV em chunk separado
          if (id.includes('/components/Sidebar') || id.includes('/components/ChannelCard') ||
            id.includes('/components/ProgramGuide') || id.includes('/components/ProgramInfo')) {
            return 'tv';
          }
        },
      },
    },
    // Aumenta um pouco o limite para evitar warnings desnecessários
    chunkSizeWarningLimit: 600,
  },
}))
