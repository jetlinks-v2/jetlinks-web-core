import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defineComponent, effectScope, h, nextTick, reactive } from 'vue'
import { Tree } from 'ant-design-vue'
import { createModuleLoader } from './helpers/moduleRuntime.mjs'
import { createComponentLoader, createComponentRenderer, textContent, walk } from './helpers/componentRuntime.mjs'

const load = createModuleLoader()
const { navigationTreeModel } = load('components/NavigationTree/model.ts')
const { useNavigationTree } = load('components/NavigationTree/useNavigationTree.ts')
const data = () => [{ key: 0, title: 'All', children: [{ key: 'park', title: 'Park', children: [{ key: 'shop', title: 'Shop', children: [{ key: 'line', title: 'Welding' }] }] }] }]
function tree(overrides = {}) {
  const props = reactive({ treeData: data(), searchNodeKey: 0, ...overrides })
  const scope = effectScope(), updates = [], searches = []
  const state = scope.run(() => useNavigationTree(props, keys => updates.push(keys), value => searches.push(value)))
  return { props, state, updates, searches, stop: () => scope.stop() }
}

test('field mappings and numeric zero keys preserve ancestors without changing source data', () => {
  const nodes = [{ id: 0, label: 'All', nodes: [{ id: 1, label: 'Parent', nodes: [{ id: 2, label: 'Target', custom: 7 }] }] }]
  const before = structuredClone(nodes), model = navigationTreeModel({ key: 'id', title: 'label', children: 'nodes' })
  assert.deepEqual(model.initialKeys(nodes, 2, 0), [0, 1])
  assert.deepEqual(model.initialKeys(nodes, 1, 0), [0])
  assert.deepEqual(model.ancestors(nodes, 2), [0, 1])
  const result = model.filter(nodes, ' TARGET ', 0)
  assert.equal(result.matched, true)
  assert.equal(result.nodes[0].nodes[0].nodes[0].custom, 7)
  assert.deepEqual(model.filter(nodes, 'missing', 0), { nodes: [{ ...nodes[0], nodes: [] }], matched: false })
  assert.deepEqual(nodes, before)
})

test('two business levels initialize once, with explicit expansion taking precedence', t => {
  for (const [props, expected] of [[{}, [0, 'park']], [{ defaultExpandedKeys: [] }, []], [{ expandedKeys: [] }, []], [{ defaultExpandAll: true }, [0, 'park', 'shop']], [{ defaultExpandDepth: 1 }, [0]], [{ defaultSelectedKeys: ['line'] }, [0, 'park', 'shop']]]) {
    const view = tree(props); t.after(view.stop)
    assert.deepEqual(view.state.expandedKeys.value, expected)
  }
  const plain = tree({ searchNodeKey: undefined }); t.after(plain.stop)
  assert.deepEqual(plain.state.expandedKeys.value, [0], 'without a synthetic root, only the first branch expands')
})

test('selection reveals deep and asynchronously arriving paths without reopening on counts or locale refresh', async t => {
  const view = tree({ selectedKeys: ['line'] }); t.after(view.stop)
  assert.deepEqual(view.state.expandedKeys.value, [0, 'park', 'shop'])
  view.state.setExpandedKeys([0])
  view.props.treeData = data().map(node => ({ ...node, title: 'すべて', count: 99 }))
  await nextTick()
  assert.deepEqual(view.state.expandedKeys.value, [0])
  const late = tree({ treeData: [], selectedKeys: ['line'] }); t.after(late.stop)
  late.props.treeData.push(...data()); await nextTick()
  assert.deepEqual(late.state.expandedKeys.value, [0, 'park', 'shop'])
  const partial = tree({ treeData: [{ key: 0, children: [{ key: 'park', children: [] }] }], selectedKeys: ['line'] }); t.after(partial.stop)
  partial.props.treeData[0].children[0].children.push(...data()[0].children[0].children)
  await nextTick()
  assert.deepEqual(partial.state.expandedKeys.value, [0, 'park', 'shop'])
})

test('search expansion is temporary, keeps the root available, and never writes selection or expansion preferences', async t => {
  const view = tree({ expandedKeys: [0], selectedKeys: ['park'] }); t.after(view.stop)
  view.props.searchValue = 'Welding'; await nextTick()
  assert.equal(view.state.searching.value, true)
  assert.deepEqual(view.state.expandedKeys.value, [0, 'park', 'shop'])
  const count = view.updates.length
  view.state.setExpandedKeys([])
  assert.equal(view.updates.length, count)
  view.props.searchValue = 'missing'; await nextTick()
  assert.equal(view.state.filtered.value.nodes[0].key, 0)
  assert.equal(view.state.filtered.value.matched, false)
  view.props.searchValue = ''; await nextTick()
  assert.deepEqual(view.state.expandedKeys.value, [0])
  assert.deepEqual(view.props.selectedKeys, ['park'])
})

test('root identity resets defaults and search while the host can persist controlled expansion', async t => {
  const view = tree(); t.after(view.stop)
  view.state.setExpandedKeys([])
  view.state.searchValue.value = 'Park'
  view.props.searchNodeKey = 'another'
  view.props.treeData = [{ ...data()[0], key: 'another' }]
  await nextTick()
  assert.equal(view.state.searchValue.value, '')
  assert.deepEqual(view.state.expandedKeys.value, ['another', 'park'])
})

test('permanent search clears on Escape and then allows the drawer to handle it', t => {
  const view = tree(); t.after(view.stop)
  view.state.searchValue.value = 'Park'
  const event = { key: 'Escape', prevented: 0, stopped: 0, preventDefault() { this.prevented++ }, stopPropagation() { this.stopped++ } }
  view.state.onSearchKeydown(event)
  assert.equal(view.state.searchValue.value, '')
  view.state.onSearchKeydown(event)
  assert.equal(event.stopped, 1)
  event.key = 'ArrowLeft'; view.state.onSearchKeydown(event)
  assert.equal(event.stopped, 1, 'editing keys remain native outside the tree')
  assert.equal(event.prevented, 1)
})

test('public wrapper forwards native events, fields and slots, with metadata beside the name', async t => {
  const previousElement = globalThis.Element
  let dragContent = { dataset: { nodeDraggable: 'false' }, getBoundingClientRect: () => ({ left: 120, top: 40, width: 160, height: 28 }) }
  class DragTarget { closest() { return { querySelector: () => dragContent } } }
  globalThis.Element = DragTarget
  t.after(() => { if (previousElement) globalThis.Element = previousElement; else delete globalThis.Element })
  let inner
  const original = defineComponent({ props: Tree.props, inheritAttrs: false, setup(props, context) {
    inner = { props, ...context }
    return () => h('tree-root', context.attrs, props.treeData.flatMap(node => context.slots.title?.(node) ?? []))
  } })
  const pass = { setup: (_, { slots }) => () => h('span', slots.default?.()) }
  const menus = []
  const dropdown = defineComponent({ props: ['trigger'], setup: (props, { slots }) => () => { menus.push(props.trigger); return h('menu-host', slots.default?.()) } })
  const NavigationTree = createComponentLoader({
    'ant-design-vue': { Tree: original, Tooltip: pass, Dropdown: dropdown, Input: pass, Empty: pass },
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
  })('components/NavigationTree/index.vue').default
  const received = [], state = reactive({ expandedKeys: [0], searchValue: '', selectedKeys: [0], 'aria-label': 'Directory' })
  const { renderer, root } = createComponentRenderer()
  const app = renderer.createApp({ setup: () => () => h(NavigationTree, {
    ...state, searchable: true, draggable: true, treeData: data(), searchNodeKey: 0, class: 'caller-class', style: { height: '300px' },
    onSelect: (...args) => received.push(['select', ...args]),
    onDrop: info => received.push(['drop', info]),
    'onUpdate:expandedKeys': keys => received.push(['expanded', keys]),
    onExpand: (...args) => received.push(['expand', ...args]),
  }, { title: node => node.title, 'node-meta': () => h('badge', '7'), 'node-suffix': () => h('button', 'Menu'), 'node-menu': () => h('node-menu'), 'root-menu': () => h('root-menu'), icon: () => h('icon') }) })
  app.mount(root); t.after(() => app.unmount())
  const viewport = root.children[0]
  assert.match(viewport.props.class, /caller-class/)
  assert.equal(viewport.props.style.height, '300px')
  assert.equal(inner.attrs.class, undefined)
  assert.equal(inner.attrs['aria-label'], 'Directory')
  assert.equal(inner.props.virtual, false)
  assert.equal(inner.props.prefixCls, 'navigation-tree-native', 'use native Tree geometry without global ant-tree overrides')
  assert.equal(inner.props.draggable, true)
  assert.equal(inner.props.onDragend, undefined, 'visual hint cleanup does not register an unnecessary native callback')
  assert.ok(menus.length >= 2)
  assert.ok(menus.every(trigger => JSON.stringify(trigger) === '["contextmenu"]'))
  state['aria-label'] = 'Renamed directory'; await nextTick()
  assert.equal(inner.attrs['aria-label'], 'Renamed directory')
  assert.deepEqual(inner.props.selectedKeys, [0])
  assert.deepEqual(Object.keys(inner.slots).sort(), ['icon', 'title'])
  assert.ok(walk(root, node => node.props.class === 'navigation-tree__main').some(node => textContent(node).includes('All7')))
  received.length = 0
  const dragImages = []
  const dragEvent = { target: new DragTarget(), clientX: 160, clientY: 54, defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, stopPropagation() {}, dataTransfer: { setDragImage: (...args) => dragImages.push(args) } }
  viewport.props.onDragstartCapture(dragEvent)
  assert.equal(dragEvent.defaultPrevented, true, 'root drag is cancelled before the native tree changes state, while it stays a drop target')
  dragContent.dataset.nodeDraggable = 'true'; dragEvent.defaultPrevented = false
  viewport.props.onDragstartCapture(dragEvent)
  assert.equal(dragEvent.defaultPrevented, false)
  const info = { expanded: false, node: { key: 0 }, event: dragEvent }
  inner.emit('select', ['park'], info)
  inner.emit('expand', [], info)
  assert.deepEqual(received, [['select', ['park'], info], ['expanded', []], ['expand', [], info]])
  received.length = 0
  inner.emit('drop', info)
  assert.deepEqual(received, [['drop', info]])
  received.length = 0
  inner.emit('dragenter', { expandedKeys: [0, 'park'] })
  assert.deepEqual(received, [['expanded', [0, 'park']]], 'drag hover persists native expansion')
  inner.emit('dragstart', info); await nextTick()
  assert.deepEqual(dragImages, [[dragContent, 40, 14]], 'the native drag image excludes the ancestor indent and whole-row outline')
  assert.ok(walk(root, node => node.type === 'external-shell').every(node => node.props.suppressed === true), 'dragging suppresses name hints')
  viewport.props.onDragendCapture(); await nextTick()
  assert.ok(walk(root, node => node.type === 'external-shell').every(node => node.props.suppressed === false))
  state.searchValue = 'Welding'; await nextTick()
  assert.equal(inner.props.draggable, false)
  received.length = 0
  inner.emit('expand', [], info)
  inner.emit('drop', info)
  assert.deepEqual(received, [])
})

test('name hints appear only for clipped text, delay 600ms, and yield to active interactions', async t => {
  let tooltip
  const Tooltip = defineComponent({ props: ['open', 'mouseEnterDelay', 'mouseLeaveDelay'], setup(props, { slots }) { tooltip = props; return () => h('tooltip', slots.default?.()) } })
  const Label = createComponentLoader({ 'ant-design-vue': { Tooltip } })('components/NavigationTree/NavigationTreeLabel.vue').default
  const state = reactive({ suppressed: false })
  const { renderer, root } = createComponentRenderer()
  const app = renderer.createApp({ setup: () => () => h(Label, state, { default: () => 'A directory name' }) })
  app.mount(root); t.after(() => app.unmount())
  const label = walk(root, node => node.props.class === 'navigation-tree__label')[0]
  label.clientWidth = 100; label.scrollWidth = 100
  label.props.onMouseenter(); await nextTick()
  assert.equal(tooltip.open, false)
  label.scrollWidth = 200
  label.props.onMouseenter(); await nextTick()
  assert.equal(tooltip.open, undefined, 'native hover timing owns an overflowing label')
  assert.equal(tooltip.mouseEnterDelay, 0.6)
  assert.equal(tooltip.mouseLeaveDelay, 0)
  state.suppressed = true; await nextTick()
  assert.equal(tooltip.open, false)
  state.suppressed = false; await nextTick()
  assert.equal(tooltip.open, undefined)
})
