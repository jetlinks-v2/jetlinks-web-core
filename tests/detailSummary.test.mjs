import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const { renderToString } = require('vue/server-renderer')
const root = resolve(import.meta.dirname, '../src/components')
function load(file) {
  const source = readFileSync(file, 'utf8')
  const content = file.endsWith('.vue')
    ? compileScript(parse(source, { filename: file }).descriptor, { id: file, inlineTemplate: true }).content
    : source
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(content, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue') return vue
    if (id === 'vue-router') return { useRouter: () => ({ back() {} }) }
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id.startsWith('.')) return load(resolve(dirname(file), `${id}.ts`))
    return require(id)
  }, module, module.exports)
  return module.exports
}
const Header = load(resolve(root, 'DetailHeader/index.vue')).default
const Meta = load(resolve(root, 'DetailMetaItem/index.vue')).default
const { detailMetaIcons } = load(resolve(root, 'DetailMetaItem/semantics.ts'))
async function render(component, props, slots) {
  const app = vue.createSSRApp({ render: () => vue.h(component, props, slots) })
  app.component('a-tooltip', { props: ['title'], setup: (_, { slots }) => () => slots.default?.() })
  app.component('a-button', { setup: (_, { slots }) => () => vue.h('button', slots.default?.()) })
  app.component('AIcon', { props: ['type'], setup: props => () => vue.h('svg', { 'data-icon': props.type }) })
  return renderToString(app)
}

test('default header keeps its original slots and excludes summary-only regions', async () => {
  const html = await render(Header, { title: 'Existing title', showBack: true }, {
    icon: () => 'SUMMARY_ICON', meta: () => 'SUMMARY_META', extra: () => 'SUMMARY_EXTRA',
    description: () => 'Existing description', info: () => 'Existing information', actions: () => 'Existing actions',
  })
  assert.match(html, /Existing title/)
  assert.match(html, /cloud-detail-header__back/)
  assert.ok(html.indexOf('Existing description') < html.indexOf('Existing information'))
  assert.match(html, /Existing actions/)
  assert.doesNotMatch(html, /SUMMARY_|cloud-detail-header--summary/)
})

test('summary keeps title controls and separates identity, metadata, description and tags', async () => {
  const html = await render(Header, { title: 'Full object title', variant: 'summary' }, {
    leading: () => 'BACK', icon: () => 'IMAGE', title: () => vue.h('input', { value: 'Editable title' }),
    titleExtra: () => 'STATUS', meta: () => 'METADATA', description: () => 'DESCRIPTION',
    extra: () => 'TAGS', actions: () => 'ACTIONS',
  })
  assert.match(html, /cloud-detail-header--summary/)
  assert.match(html, /title="Full object title"/)
  assert.match(html, /value="Editable title"/)
  const positions = ['BACK', 'IMAGE', 'STATUS', 'METADATA', 'DESCRIPTION', 'TAGS', 'ACTIONS'].map(text => html.indexOf(text))
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])))
})

test('metadata keeps long string IDs, zero and accessible field names without guessing labels', async () => {
  const html = await render(Meta, { kind: 'id', label: '应用 ID', value: '2120761352835448832' })
  assert.match(html, /data-icon="NumberOutlined"/)
  assert.match(html, /应用 ID/)
  assert.match(html, /2120761352835448832/)
  const zero = await render(Meta, { kind: 'count', label: 'Devices', value: 0 })
  assert.match(zero.replace(/<!--[\s\S]*?-->/g, ''), />0<\/span>/)
  const slotted = await render(Meta, { kind: 'product', label: 'Product' }, { default: () => vue.h('a', { href: '/product/1' }, 'Linked product') })
  assert.match(slotted, /href="\/product\/1"/)
})

test('all timestamp and duration labels use the same real icon', async () => {
  for (const label of ['创建时间', '最后上报', '在线时长']) {
    const html = await render(Meta, { kind: 'time', label, value: 'value' })
    assert.match(html, /data-icon="ClockCircleOutlined"/)
    assert.ok(html.includes(label))
  }
  const icons = require('@ant-design/icons-vue')
  for (const icon of Object.values(detailMetaIcons)) assert.ok(icons[icon], `${icon} must exist in the installed library`)
})
