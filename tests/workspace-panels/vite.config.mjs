import { fileURLToPath } from 'node:url'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const root = fileURLToPath(new URL('.', import.meta.url))
const repository = fileURLToPath(new URL('../..', import.meta.url))
export default defineConfig({
  root,
  cacheDir: join(tmpdir(), 'jetlinks-workspace-panels-vite'),
  plugins: [vue(), tailwindcss()],
  esbuild: { tsconfigRaw: JSON.stringify({ compilerOptions: { target: 'ES2022', useDefineForClassFields: true } }) },
  build: { outDir: join(tmpdir(), 'jetlinks-workspace-panels-build'), emptyOutDir: true },
  server: { host: '127.0.0.1', port: 9498, strictPort: true, fs: { allow: [repository, realpathSync(join(repository, 'node_modules'))] } },
})
