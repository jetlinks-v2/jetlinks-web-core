import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { transformSync } from 'esbuild'

// Run the actual pure resolver; Vite's resource glob and locale singleton are covered by the build.
const source = readFileSync(new URL('../src/utils/menuLocale.ts', import.meta.url), 'utf8')
  .split('\nconst baseMenus =')[0].replace(/^import .*\n/gm, '')
const compiled = transformSync(source, { loader: 'ts', format: 'cjs' }).code
const module = { exports: {} }
new Function('module', 'exports', compiled)(module, module.exports)
const { createMenuLocaleResolver, retainMenuSourceLabels, getMenuSourceTexts } = module.exports
const menu = {
  code: 'device/Product', name: '产品列表', describe: '管理产品',
  i18nMessages: { name: { ja: '製品一覧' }, describe: { ja: '製品を管理' } },
}

test('Japanese resolves existing default menus and breadcrumbs without requiring server data writes', () => {
  const resolve = createMenuLocaleResolver([[{ code: 'resources', name: '资源', children: [menu] }]], () => 'ja')
  assert.equal(resolve({ code: menu.code, name: menu.name, i18nName: menu.name }), '製品一覧')
  assert.equal(resolve({ ...menu, i18nMessages: undefined }, 'describe'), '製品を管理')
})

test('explicit translations win, including regional and flat button messages', () => {
  const resolve = createMenuLocaleResolver([[menu]], () => 'ja-JP')
  assert.equal(resolve({ ...menu, i18nMessages: { name: { ja_JP: '独自の製品名' } } }), '独自の製品名')
  assert.equal(resolve({ name: '查看', i18nMessages: { ja: '表示' } }), '表示')
  assert.equal(resolve({ code: menu.code, name: menu.name, i18nName: 'サーバーの表示名' }), 'サーバーの表示名')
})

test('custom menu names, descriptions and unknown menus are preserved', () => {
  const resolve = createMenuLocaleResolver([[menu]], () => 'ja')
  assert.equal(resolve({ code: menu.code, name: '客户的产品' }), '客户的产品')
  assert.equal(resolve({ code: menu.code, name: menu.name, describe: '客户的说明' }, 'describe'), '客户的说明')
  assert.equal(resolve({ code: 'customer/menu', name: menu.name }), menu.name)
})

test('Chinese and English retain server localization and the original fallback', () => {
  let language = 'zh'
  const resolve = createMenuLocaleResolver([[menu]], () => language)
  assert.equal(resolve(menu), menu.name)
  language = 'en'
  assert.equal(resolve({ ...menu, i18nName: 'Product List' }), 'Product List')
  assert.equal(resolve({ code: menu.code, name: menu.name }), menu.name)
})

test('conflicting default definitions do not select an arbitrary translation', () => {
  const resolve = createMenuLocaleResolver([[menu], [{ ...menu, i18nMessages: { name: { ja: '異なる名前' } } }]], () => 'ja_JP')
  assert.equal(resolve({ code: menu.code, name: menu.name }), menu.name)
})

test('a Japanese menu tree supplies its visible Japanese labels for machine translation', () => {
  const resolve = createMenuLocaleResolver([[menu]], () => 'ja')
  const parent = { code: 'link', name: '运维中心', i18nName: '運用保守センター' }
  const child = {
    ...menu,
    i18nName: '製品一覧',
    i18nDescribe: '製品を管理',
    i18nMessages: { name: { zh_CN: '产品目录' }, describe: { 'zh-CN': '管理产品资料' } },
  }
  const native = [{
    name: 'link', path: '/infrastructure',
    meta: retainMenuSourceLabels({ title: resolve(parent), id: '1' }, parent),
    children: [{
      name: child.code, path: '/products',
      meta: retainMenuSourceLabels({ title: resolve(child), desc: resolve(child, 'describe'), disabled: true }, child),
    }],
  }]
  assert.deepEqual([...getMenuSourceTexts(native, 'ja')], ['運用保守センター', '製品一覧', '製品を管理'])
  assert.equal(getMenuSourceTexts(native, 'zh').size, 0)
  assert.equal(native[0].children[0].meta.disabled, true)
  assert.equal(native[0].children[0].name, child.code)
  assert.equal(native[0].children[0].path, '/products')
  assert.equal(native[0].meta.title, '運用保守センター')
  assert.equal(native[0].children[0].meta.title, '製品一覧')
})

test('untranslated menu labels are only known sources for the Chinese interface', () => {
  const menu = { path: '/custom', meta: retainMenuSourceLabels({ title: '接入组件' }, { name: '接入组件' }) }
  assert.equal(getMenuSourceTexts([menu], 'ja').size, 0)
  assert.deepEqual([...getMenuSourceTexts([menu], 'zh')], ['接入组件'])
})
