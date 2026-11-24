import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import test from 'node:test'
import { build } from 'esbuild'
import { createSSRApp } from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import * as router from 'vue-router'
import { createPinia, defineStore } from 'pinia'
import { createI18n } from 'vue-i18n'
import { Result, Tag } from 'ant-design-vue'

const root = resolve(import.meta.dirname, '..')
const filename = resolve(root, 'src/views/Error/403.vue')
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
const { content } = compileScript(descriptor, { id: 'no-menu-result', inlineTemplate: true })
const { outputFiles } = await build({
  stdin: { contents: content, loader: 'ts', resolveDir: root },
  tsconfig: resolve(root, 'tsconfig.json'), bundle: true, platform: 'node', format: 'cjs', write: false,
  external: ['vue', 'vue-router', 'vue-i18n', 'pinia', '@jetlinks-web-core/store/*'],
})
const require = createRequire(import.meta.url)
const useUserStore = defineStore('user', { state: () => ({ userInfo: {} }) })
const useMenuStore = defineStore('menu', { state: () => ({ hasNoAccessibleMenu: false }) })
const deps = { 'vue-router': router, '@jetlinks-web-core/store/user': { useUserStore }, '@jetlinks-web-core/store/menu': { useMenuStore } }
const mod = { exports: {} }
new Function('require', 'module', 'exports', outputFiles[0].text)(id => deps[id] || require(id), mod, mod.exports)
const messages = Object.fromEntries(['zh', 'en', 'ja'].map(lang => [lang, JSON.parse(readFileSync(resolve(root, `src/locales/lang/${lang}.json`), 'utf8'))]))

async function render(userInfo, { locale = 'zh', reason = 'no-menu', empty = true } = {}) {
  const pinia = createPinia(), app = createSSRApp(mod.exports.default)
  app.use(pinia).use(createI18n({ legacy: false, locale, messages })).use(Result).use(Tag)
  app.provide(router.routeLocationKey, { query: { reason } })
  useUserStore(pinia).userInfo = userInfo
  useMenuStore(pinia).hasNoAccessibleMenu = empty
  return renderToString(app)
}

for (const locale of Object.keys(messages)) {
  test(`renders the built-in 403 illustration, localized identity and no actions (${locale})`, async () => {
    const html = await render({ name: '林悦', username: 'lin.yue', roleList: [{ name: '运维' }, { name: '巡检' }] }, { locale })
    assert.match(html, /ant-result-403/)
    assert.match(html, /<svg/)
    for (const key of ['Error403.noMenus', 'PersonalCenter.nameLabel', 'EditInfo.index.557023-5', 'EditInfo.index.557023-7']) {
      assert.ok(messages[locale][key] && html.includes(messages[locale][key]), key)
    }
    for (const value of ['林悦', 'lin.yue', '运维', '巡检']) assert.ok(html.includes(value))
    assert.doesNotMatch(html, /<button/)
  })
}

test('only a confirmed empty role list means unassigned; missing fields use a dash', async () => {
  assert.match(await render({ roleList: [] }), /未分配角色/)
  for (const info of [{}, { roleList: [{}] }]) {
    const html = await render(info)
    assert.equal(html.match(/—/g)?.length, 3)
    assert.doesNotMatch(html, /未分配角色/)
  }
})

test('neither an unverified URL reason nor an unrelated 403 displays no-menu details', async () => {
  for (const options of [{ empty: false }, { reason: '' }]) {
    const html = await render({ username: 'private-account' }, options)
    assert.match(html, /ant-result-403/)
    assert.doesNotMatch(html, /private-account|分配菜单权限|<dl/)
  }
})
