import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { transformSync } from 'esbuild'
import { createRenderer, defineComponent, h, onUnmounted } from 'vue'
import { createPinia, defineStore } from 'pinia'
import { createI18n, useI18n } from 'vue-i18n'

const source = readFileSync(new URL('../src/views/relogin/index.ts', import.meta.url), 'utf8')
const { code } = transformSync(source, { loader: 'ts', format: 'cjs' })
const useSession = defineStore('relogin-test', { state: () => ({ username: 'test' }) })
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, patchProp() {}, insert() {}, remove() {},
  parentNode: () => null, nextSibling: () => null,
})

const fixture = t => {
  const pinia = createPinia()
  const session = useSession(pinia)
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { title: 'Relogin' } } })
  let settle, reject, unmounts = 0, opens = 0
  const pending = new Promise((resolve, fail) => { settle = resolve; reject = fail })
  const containers = new Set()
  const previousDocument = globalThis.document
  globalThis.document = {
    createElement: () => ({ remove() { containers.delete(this) } }),
    body: { appendChild: container => containers.add(container) },
  }
  t.after(() => {
    settle(null)
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  })
  const Dialog = defineComponent({
    setup(_props, { expose }) {
      assert.equal(containers.size, 1)
      assert.equal(useSession(), session)
      const { t } = useI18n()
      assert.equal(t('title'), 'Relogin')
      onUnmounted(() => { unmounts++ })
      expose({ open: () => { opens++; return pending } })
      return () => h('div', t('title'))
    },
  })
  const dependencies = {
    vue: { createApp: component => renderer.createApp(component) },
    '@jetlinks-web-core/store/pinia': pinia,
    '@jetlinks-web-core/locales': i18n,
    './index.vue': Dialog,
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => {
    assert.ok(Object.hasOwn(dependencies, name), name)
    return dependencies[name]
  }, module, module.exports)
  return { open: module.exports.openRelogin, settle, reject, containers,
    get unmounts() { return unmounts }, get opens() { return opens } }
}

for (const [name, result] of [['success', true], ['cancel', null]]) {
  test(`relogin ${name} preserves its result and releases the Vue app and container`, async t => {
    const f = fixture(t)
    const pending = f.open()
    assert.equal(f.opens, 1)
    assert.equal(f.containers.size, 1)
    assert.equal(f.unmounts, 0)
    f.settle(result)
    assert.equal(await pending, result)
    assert.equal(f.unmounts, 1)
    assert.equal(f.containers.size, 0)
  })
}

test('relogin failure propagates the original error and releases the Vue app and container', async t => {
  const f = fixture(t)
  const pending = f.open()
  const error = new Error('Login failed')
  f.reject(error)
  await assert.rejects(pending, reason => reason === error)
  assert.equal(f.unmounts, 1)
  assert.equal(f.containers.size, 0)
})
