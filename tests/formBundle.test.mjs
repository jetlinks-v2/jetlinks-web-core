import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'

test('importing FormRenderer alone does not include designer, example or business modules', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const entry = '\0form-renderer-consumer'
  const result = await build({
    configFile: false, root, logLevel: 'error', plugins: [vue(), {
      name: 'form-renderer-consumer',
      resolveId: id => id === 'form-renderer-consumer' ? entry : undefined,
      load: id => id === entry ? `export { FormRenderer } from ${JSON.stringify(`${root}/src/components/Form/index.ts`)}` : undefined,
    }],
    build: { write: false, rollupOptions: { input: 'form-renderer-consumer', preserveEntrySignatures: 'strict', external: ['vue', 'vue-i18n', 'lodash-es', 'dayjs', '@vueuse/core', 'ant-design-vue'] } },
  })
  const results = Array.isArray(result) ? result : [result]
  const modules = results.flatMap(result => result.output.filter(item => item.type === 'chunk').flatMap(chunk => Object.keys(chunk.modules)))
  assert.ok(modules.some(path => path.endsWith('/FormRenderer.vue')))
  assert.equal(modules.some(path => /FormDesigner|FormSettings|examples\/|object-capability|data-capability/.test(path)), false)
})
