import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('..', import.meta.url)),
  optimizeDeps: { entries: ['tests/tableActions/main.ts'] },
  plugins: [vue(), {
    name: 'table-actions-fixture',
    configureServer(server) {
      server.middlewares.use('/', async (request, response, next) => {
        if (request.url !== '/') return next()
        const html = await server.transformIndexHtml('/', '<!doctype html><html><head><meta charset="utf-8"><title>TableActions tests</title></head><body><main id="app"></main><script type="module" src="/tests/tableActions/main.ts"></script></body></html>')
        response.setHeader('Content-Type', 'text/html')
        response.end(html)
      })
    },
  }],
  server: { host: '127.0.0.1', port: 5187, strictPort: true },
})
await server.listen()
server.printUrls()
