import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'

const root = fileURLToPath(new URL('..', import.meta.url))
// 独立编译真实验证页及其依赖，不扫描或重新打包业务模块。
await build({
  root,
  configFile: false,
  plugins: [vue()],
  resolve: { alias: { '@jetlinks-web-core': resolve(root, 'src') } },
  build: {
    outDir: '/private/tmp/relation-selector-verification-build',
    emptyOutDir: true,
    lib: { entry: resolve(root, 'src/views/relation-selector/lab/index.vue'), formats: ['es'], fileName: 'relation-selector-lab' },
    rollupOptions: { external: ['vue', 'vue-i18n', 'ant-design-vue', '@ant-design/icons-vue', '@jetlinks-web/core', '@jetlinks-web/utils', '@jetlinks-web/constants'] },
  },
})
