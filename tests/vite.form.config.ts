import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

/** 独立示例使用真实主题和SFC编译，不加载业务模块、登录或联邦远端。 */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  cacheDir: '../node_modules/.vite-form',
  plugins: [vue(), tailwindcss()],
  resolve: { dedupe: ['vue', 'vue-i18n'] },
  server: { host: '127.0.0.1', port: 8767, strictPort: true },
  build: { outDir: '../dist/form-preview', emptyOutDir: true, rollupOptions: { input: fileURLToPath(new URL('./form-workspace-preview.html', import.meta.url)) } },
})
