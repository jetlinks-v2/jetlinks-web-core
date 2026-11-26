import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
const repository = fileURLToPath(new URL('../..', import.meta.url))
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: join(tmpdir(), 'jetlinks-public-ui-vite'),
  plugins: [vue(), tailwindcss()],
  build: { outDir: join(tmpdir(), 'jetlinks-public-ui-build'), emptyOutDir: true },
  server: { host: '127.0.0.1', port: 9521, strictPort: true, fs: { allow: [repository, realpathSync(join(repository, 'node_modules'))] } },
})
