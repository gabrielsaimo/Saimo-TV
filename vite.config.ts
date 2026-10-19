import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { onRequest } from './functions/api/proxy'
import { onRequestGet as onResolveVod } from './functions/api/resolve-vod'

/**
 * Serve `/api/proxy` e `/api/resolve-vod` no servidor de desenvolvimento com a
 * mesma função que roda em produção.
 *
 * Sem isto o desenvolvimento tocaria por um caminho que o visitante nunca usa —
 * era assim que uma correção de CDN passava no `bun run dev` e falhava no ar.
 */
function proxyDev(): Plugin {
  return {
    name: 'saimo-proxy-dev',
    configureServer(server) {
      server.middlewares.use('/api/resolve-vod', async (req, res) => {
        const url = `http://${req.headers.host ?? 'localhost'}${req.originalUrl ?? req.url ?? ''}`
        try {
          const response = await onResolveVod({
            request: new Request(url, { method: req.method ?? 'GET' }),
          })
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(await response.text())
        } catch (error) {
          res.statusCode = 500
          res.end(String(error))
        }
      })
      server.middlewares.use('/api/proxy', async (req, res) => {
        const url = `http://${req.headers.host ?? 'localhost'}${req.originalUrl ?? req.url ?? ''}`
        const headers = new Headers()
        if (req.headers.range) headers.set('range', String(req.headers.range))

        try {
          const response = await onRequest({
            request: new Request(url, { method: req.method ?? 'GET', headers }),
          })
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          if (!response.body) {
            res.end()
            return
          }
          const reader = response.body.getReader()
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(value)
          }
          res.end()
        } catch (error) {
          res.statusCode = 500
          res.end(String(error))
        }
      })
    },
  }
}

// https://vite.dev/config/
// Pacote das TVs Samsung/LG (`vite build --mode tv`): um arquivo comum (IIFE, sem
// módulos ES, que o webOS bloqueia quando a página vem de file://) mais o CSS, para o
// carregador de tv/ injetar como <script>/<link> clássicos.
const configTv = defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'iife' },
  define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.VITE_TV': '"1"' },
  build: {
    outDir: 'dist-tv',
    target: 'chrome68',
    cssTarget: 'chrome61',
    minify: 'oxc',
    lib: { entry: 'src/entrada-tv.ts', name: 'SaimoTV', formats: ['iife'], fileName: () => 'saimo.js', cssFileName: 'saimo' },
    chunkSizeWarningLimit: 4000,
    copyPublicDir: false,
  },
})

export default defineConfig(({ mode }) => mode === 'tv' ? configTv : {
  base: '/',
  plugins: [react(), proxyDev()],
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
            // Shaka só desce para quem abre um canal DASH; junto do resto do
            // vendor ele viraria 700 KB no primeiro acesso de todo mundo.
            if (id.includes('shaka-player')) {
              return 'vendor-shaka';
            }
            // Outras bibliotecas em um chunk separado
            return 'vendor';
          }
          // Players em chunk separado
          if (id.includes('/components/VideoPlayer') || id.includes('/components/MoviePlayer')) {
            return 'player';
          }
          // Catálogo em chunk separado
          if (id.includes('/components/MovieCatalog') || id.includes('/components/VodCatalog') ||
            id.includes('/components/MovieCard')) {
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
})
