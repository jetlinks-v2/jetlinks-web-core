import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import { createRenderer, defineComponent, h, nextTick, ref } from 'vue'

const require = createRequire(import.meta.url)
const directory = fileURLToPath(new URL('.', import.meta.url))
const menuFile = fileURLToPath(new URL('../../../layout/components/ProjectSecondaryMenu.vue', import.meta.url))
const bundle = await build({
  entryPoints: [menuFile], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue'],
  plugins: [{ name: 'menu-test-boundaries', setup(builder) {
    builder.onResolve({ filter: /^@jetlinks-web-core\/(locales|utils\/menuBadge)$/ }, ({ path }) => ({ path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path.endsWith('locales')
      ? 'export default {global:{t:key=>key}}'
      : 'export const COMING_SOON_MENU_BADGE_TYPE="comingSoon";export const DEFAULT_COMING_SOON_MENU_BADGE_I18N_KEY="comingSoon"' }))
    builder.onLoad({ filter: /\.vue$/ }, ({ path }) => {
      const { descriptor, errors } = parse(readFileSync(path, 'utf8'), { filename: path })
      assert.deepEqual(errors, [])
      return { contents: compileScript(descriptor, { id: path, inlineTemplate: true }).content, loader: 'ts' }
    })
  }}],
})
const mod = new Module(directory + 'menu-fixture.cjs')
mod.filename = directory + 'menu-fixture.cjs'
mod.paths = require.resolve.paths('vue')
mod._compile(bundle.outputFiles[0].text, mod.filename)
const MenuComponent = mod.exports.default

function node(type, text = '') { return { type, text, props: {}, children: [], parent: null } }
const renderer = createRenderer({
  createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (target, text) => { target.text = text }, setElementText: (target, text) => { target.text = text; target.children = [] },
  patchProp: (target, key, _old, value) => { target.props[key] = value },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target)
    target.parent = parent
  },
  remove(target) { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null },
  parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] || null,
})
const Menu = defineComponent({
  props: ['openKeys', 'selectedKeys'], emits: ['update:openKeys', 'click'],
  setup(props, { emit, slots }) { return () => h('menu-boundary', {
    openKeys: [...props.openKeys], selectedKeys: props.selectedKeys,
    open: keys => emit('update:openKeys', keys), click: key => emit('click', { key }),
  }, slots.default?.()) },
})
const Tabs = defineComponent({
  props: ['activeKey'], emits: ['change'],
  setup(props, { emit, slots }) { return () => h('tabs-boundary', { activeKey: props.activeKey, change: key => emit('change', key) }, slots.default?.()) },
})
const Slot = defineComponent({ setup(_props, { slots }) { return () => h('slot-boundary', slots.default?.()) } })
function find(target, type) {
  if (target.type === type) return target
  for (const child of target.children) { const match = find(child, type); if (match) return match }
}

test('分组菜单首次展开、手动收起后保持，重进和新分组恢复默认展开', async t => {
  const grouped = ref(true)
  const selectedKey = ref('basic')
  const items = ref([
    { key: 'account', label: '个人中心', children: [{ key: 'basic', label: '基本信息' }, { key: 'disabled', disabled: true }] },
    { key: 'messages', label: '消息', children: [{ key: 'notifications', label: '通知设置' }] },
  ])
  const selected = []
  const root = node('root')
  const app = renderer.createApp({ setup: () => () => h(MenuComponent, { grouped: grouped.value, items: items.value, selectedKey: selectedKey.value, onSelect: key => selected.push(key) }) })
  app.component('a-menu', Menu).component('a-sub-menu', Slot).component('a-menu-item', Slot)
    .component('a-tabs', Tabs).component('a-tab-pane', Slot).component('AIcon', Slot)
  app.mount(root)
  t.after(() => app.unmount())
  await nextTick()
  assert.deepEqual(find(root, 'menu-boundary').props.openKeys, ['account', 'messages'])
  selectedKey.value = 'notifications'
  await nextTick()
  assert.deepEqual(find(root, 'menu-boundary').props.selectedKeys, ['notifications'])
  find(root, 'menu-boundary').props.open(['messages'])
  await nextTick()
  items.value = items.value.map(item => ({ ...item, label: item.label + ' updated' }))
  await nextTick()
  assert.deepEqual(find(root, 'menu-boundary').props.openKeys, ['messages'])
  find(root, 'menu-boundary').props.click('basic')
  find(root, 'menu-boundary').props.click('disabled')
  assert.deepEqual(selected, ['basic'])
  items.value = [{ ...items.value[1] }, { key: 'new', children: [] }]
  await nextTick()
  assert.deepEqual(find(root, 'menu-boundary').props.openKeys, ['messages', 'new'])
  items.value = [{ key: 'account', children: [] }, ...items.value]
  await nextTick()
  assert.deepEqual(find(root, 'menu-boundary').props.openKeys, ['messages', 'new', 'account'])
  grouped.value = false
  items.value = [{ key: 'flat', label: '平铺' }, { key: 'off', disabled: true }]
  await nextTick()
  find(root, 'tabs-boundary').props.change('flat')
  find(root, 'tabs-boundary').props.change('off')
  assert.deepEqual(selected, ['basic', 'flat'])
  grouped.value = true
  items.value = [{ key: 'account', children: [] }, { key: 'messages', children: [] }]
  await nextTick()
  assert.deepEqual(find(root, 'menu-boundary').props.openKeys, ['account', 'messages'])
})
