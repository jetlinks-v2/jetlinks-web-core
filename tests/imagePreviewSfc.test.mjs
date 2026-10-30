import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { compileScript, parse } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)

test('ImagePreview compiles through the installed setup-name plugin and Vue template compiler', async () => {
  const url = new URL('../src/components/ImagePreview/index.vue', import.meta.url)
  const filename = fileURLToPath(url)
  const source = await readFile(url, 'utf8')
  // 开发插件先匿名预编译；仅传真实路径给 Vue 编译器无法复现此错误。
  const transformed = await require('vite-plugin-vue-setup-extend')().transform.call({}, source, filename)
  const { descriptor, errors } = parse(transformed?.code ?? source, { filename })
  assert.deepEqual(errors, [])
  for (const isProd of [false, true]) {
    const compiled = compileScript(descriptor, { id: 'image-preview', inlineTemplate: true, isProd })
    assert.ok(compiled.content)
  }
})
