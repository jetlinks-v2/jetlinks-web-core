import assert from 'node:assert/strict'
import test from 'node:test'
import { createRenderer, defineComponent, h, nextTick, onMounted, reactive, ref } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'

const flush = async () => { await nextTick(); await nextTick() }
const walk = (node, predicate) => [node, ...node.children.flatMap(child => walk(child, predicate))].filter(predicate)

// Only DOM and the Ant rendering boundary are replaced; component state and handlers run unchanged.
function createTestRenderer() {
  const document = { activeElement: undefined }
  const node = (type, text = '') => ({
    type, text, children: [], parent: undefined, props: {}, style: {}, ownerDocument: document,
    focus() { document.activeElement = this },
    contains(target) { return walk(this, child => child === target).length > 0 },
    setPointerCapture(id) { this.captured = id },
    hasPointerCapture(id) { return this.captured === id },
    releasePointerCapture(id) { this.captured = undefined; this.props.onLostpointercapture?.({ pointerId: id }) },
  })
  const root = node('root')
  const renderer = createRenderer({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) {
      if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
      child.parent = parent
      const at = anchor ? parent.children.indexOf(anchor) : -1
      at < 0 ? parent.children.push(child) : parent.children.splice(at, 0, child)
    },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = undefined },
    setText: (node, text) => { node.text = text }, setElementText: (node, text) => { node.text = text; node.children = [] },
    patchProp: (node, key, _old, value) => { node.props[key] = value },
    parentNode: node => node.parent, nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1],
  })
  const Button = defineComponent({ inheritAttrs: false, setup: (_props, { attrs, slots }) => () => h('button', attrs, slots.default?.()) })
  const register = app => {
    app.component('a-button', Button)
    app.component('AIcon', defineComponent({ setup: () => () => h('i') }))
    app.component('a-popover', defineComponent({ setup: (_props, { slots }) => () => h('div', [slots.default?.(), slots.content?.()]) }))
    return app
  }
  return { renderer, root, document, register }
}

function mountColumns(mode = 'default', extra = {}, accept = true) {
  const Columns = createDashboardLoader({ 'vue-i18n': { useI18n: () => ({ t: key => key }) } })('components/EqualHeightColumns/index.vue').default
  const props = reactive(extra), requests = [], changes = [], draft = ref('待处理对象'), currentMode = ref(mode)
  let mounts = 0
  const Left = defineComponent({ setup() { onMounted(() => mounts++); return () => h('input', { 'aria-label': 'left', value: draft.value }) } })
  const state = createTestRenderer()
  const slots = () => ({
    left: () => h(Left), right: () => h('input', { 'aria-label': 'right' }),
    ...(currentMode.value === 'left' || currentMode.value === 'both' ? { 'left-header': () => '对象' } : {}),
    ...(currentMode.value === 'toolbar' || currentMode.value === 'both' ? { 'right-header': () => h('input', { 'aria-label': 'search' }) } : {}),
  })
  const app = state.register(state.renderer.createApp({ setup: () => () => h(Columns, {
    ...props,
    'onUpdate:collapsed': value => { requests.push(value); if (accept && props.collapsed !== undefined) props.collapsed = value },
    onCollapseChange: value => changes.push(value),
  }, slots()) }))
  app.mount(state.root)
  return { ...state, app, props, requests, changes, draft, mode: currentMode, mounts: () => mounts,
    buttons: () => walk(state.root, node => node.type === 'button'),
    field: label => walk(state.root, node => node.props['aria-label'] === label)[0],
    body: () => { const id = walk(state.root, node => node.type === 'button')[0]?.props['aria-controls']; return walk(state.root, node => node.props.id === id)[0] },
  }
}

test('dynamic toolbar/default/left/both slots preserve content and update the unique entry without empty headers', async () => {
  const state = mountColumns('toolbar')
  const left = state.field('left'), right = state.field('right'), body = state.body()
  const hasClass = (node, name) => String(node.props.class ?? '').split(' ').includes(name)
  try {
    state.draft.value = '切换布局仍保留的草稿'
    for (const mode of ['default', 'left', 'both', 'toolbar', 'default']) {
      state.mode.value = mode; await flush()
      assert.equal(state.buttons().length, 1)
      assert.equal(state.body(), body)
      assert.equal(state.field('left'), left); assert.equal(state.field('right'), right)
      assert.equal(left.props.value, '切换布局仍保留的草稿'); assert.equal(state.mounts(), 1)
      assert.equal(walk(state.root, node => hasClass(node, 'equal-height-columns__toolbar')).length, ['toolbar', 'both'].includes(mode) ? 1 : 0)
      assert.equal(walk(state.root, node => hasClass(node, 'equal-height-columns__header')).length, ['left', 'both'].includes(mode) ? 1 : 0)
      assert.equal(walk(state.root, node => hasClass(node, 'equal-height-columns__control-rail')).length, mode === 'default' ? 1 : 0)
      state.buttons()[0].props.onClick(); await flush()
      const style = state.root.children[0].props.style
      assert.equal(style['--equal-height-columns-left-width'], mode === 'left' ? 'var(--equal-height-columns-header-rail)' : '0px')
      state.buttons()[0].props.onClick(); await flush()
    }
  } finally { state.app.unmount() }
})

for (const mode of ['default', 'toolbar', 'left', 'both']) {
  test(`${mode}: unique disclosure retains its instance, input and control relation`, async () => {
    const state = mountColumns(mode)
    try {
      const button = state.buttons()[0], field = state.field('left'), body = state.body()
      assert.equal(state.buttons().length, 1)
      assert.ok(body)
      assert.equal(button.props['aria-expanded'], true)
      state.draft.value = '保留的草稿'; await flush()
      button.props.onClick(); await flush()
      assert.equal(button.props['aria-expanded'], false)
      assert.equal(state.field('left'), field)
      assert.equal(mode === 'default' ? body.props.inert : body.style.display === 'none', true)
      button.props.onClick(); await flush()
      assert.equal(state.buttons()[0], button)
      assert.equal(field.props.value, '保留的草稿')
      assert.equal(state.mounts(), 1)
      assert.deepEqual(state.requests, [true, false]); assert.deepEqual(state.changes, [true, false])
    } finally { state.app.unmount() }
  })
}

test('explicit false is controlled; rejected requests do not collapse or echo external changes', async () => {
  const state = mountColumns('toolbar', { collapsed: false }, false)
  try {
    state.buttons()[0].props.onClick(); await flush()
    assert.equal(state.buttons()[0].props['aria-expanded'], true)
    assert.deepEqual(state.requests, [true]); assert.deepEqual(state.changes, [true])
    state.props.collapsed = true; await flush()
    assert.equal(state.buttons()[0].props['aria-expanded'], false)
    state.props.collapsed = false; await flush()
    assert.equal(state.buttons()[0].props['aria-expanded'], true)
    assert.deepEqual(state.requests, [true]); assert.deepEqual(state.changes, [true])
  } finally { state.app.unmount() }
})

test('columns forward updated accessible names and titles without caching useAttrs', async () => {
  const state = mountColumns('default', { 'aria-label': '初始工作区', title: '初始标题' })
  try {
    state.props['aria-label'] = '当前工作区'; state.props.title = '当前标题'; await flush()
    assert.equal(state.root.children[0].props['aria-label'], '当前工作区')
    assert.equal(state.root.children[0].props.title, '当前标题')
  } finally { state.app.unmount() }
})

test('controlled acceptance, structural visibility and disabled collapse retain the host preference', async () => {
  const state = mountColumns('default', { collapsed: false })
  try {
    state.buttons()[0].props.onClick(); await flush()
    assert.equal(state.props.collapsed, true)
    state.props.collapsible = false; await flush()
    assert.equal(state.buttons().length, 0)
    assert.equal(state.field('left').parent.props.inert, undefined)
    assert.equal(state.props.collapsed, true)
    state.props.collapsible = true; await flush()
    assert.equal(state.buttons()[0].props['aria-expanded'], false)
    state.props.showLeft = false; await flush()
    assert.equal(state.buttons().length, 0); assert.equal(state.field('left'), undefined)
    assert.ok(state.field('right'))
    state.props.showLeft = true; await flush()
    assert.equal(state.buttons()[0].props['aria-expanded'], false)
    assert.equal(state.mounts(), 2, 'showLeft is an unmount switch, unlike collapse')
    assert.deepEqual(state.changes, [true]); assert.deepEqual(state.requests, [true])
  } finally { state.app.unmount() }
})

test('collapse relocates only focus inside the hidden pane, never an unrelated main input', async () => {
  for (const mode of ['default', 'toolbar', 'left']) {
    const state = mountColumns(mode, { collapsed: false })
    try {
      state.field('left').focus()
      state.props.collapsed = true; await flush()
      assert.equal(state.document.activeElement, state.buttons()[0])
      state.props.collapsed = false; await flush()
      state.field('right').focus()
      state.props.collapsed = true; await flush()
      assert.equal(state.document.activeElement, state.field('right'))
    } finally { state.app.unmount() }
  }
})

function mountResize() {
  const width = ref(1000)
  const Handle = createDashboardLoader({
    '@vueuse/core': { useElementSize: () => ({ width }) },
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
  })('components/PanelResizeHandle/index.vue').default
  const props = reactive({ modelValue: 360, 'aria-label': '属性面板宽度', 'aria-controls': 'properties', title: '调整属性', class: 'host-handle', style: { opacity: 0.9 } }), changes = [], state = createTestRenderer()
  const app = state.register(state.renderer.createApp({ setup: () => () => h(Handle, {
    ...props,
    'onUpdate:modelValue': value => { changes.push(value); props.modelValue = value },
  }) }))
  app.mount(state.root)
  const separator = walk(state.root, node => node.props.role === 'separator')[0]
  const button = key => walk(state.root, node => node.type === 'button' && node.children.some(child => child.text === `components.PanelResizeHandle.${key}`))[0]
  const press = key => [].concat(separator.props.onKeydown).forEach(handler => handler({ key, preventDefault() {} }))
  const pointer = (x, id = 1) => ({ button: 0, clientX: x, pointerId: id, currentTarget: separator, preventDefault() {} })
  return { ...state, app, props, changes, width, separator, button, press, pointer }
}

test('resize click controls and keyboard share bounds; semantic attrs remain on the separator', async () => {
  const state = mountResize()
  try {
    const { separator } = state
    assert.equal(separator.props['aria-label'], '属性面板宽度')
    assert.equal(separator.props['aria-controls'], 'properties'); assert.equal(separator.props.title, '调整属性')
    assert.equal(walk(separator, node => node.type === 'button').length, 0)
    assert.ok(state.root.children[0].props.class.includes('host-handle'))
    assert.equal(state.root.children[0].props.style.opacity, 0.9)
    state.props['aria-label'] = '更新后的属性宽度'; state.props.title = '更新后的标题'; await flush()
    assert.equal(separator.props['aria-label'], '更新后的属性宽度'); assert.equal(separator.props.title, '更新后的标题')
    assert.equal(walk(state.root, node => node.type === 'button' && node.props['aria-controls']?.startsWith('panel-resize-'))[0].props['aria-label'], '更新后的属性宽度')
    state.button('grow').props.onClick(); await flush(); assert.equal(state.props.modelValue, 376)
    state.button('shrink').props.onClick(); await flush(); assert.equal(state.props.modelValue, 360)
    state.press('End'); await flush(); assert.equal(state.props.modelValue, 640); assert.equal(state.button('grow').props.disabled, true)
    state.press('Home'); await flush(); assert.equal(state.props.modelValue, 320); assert.equal(state.button('shrink').props.disabled, true)
    state.button('reset').props.onClick(); await flush(); assert.equal(state.props.modelValue, 360)
    state.press('ArrowLeft'); await flush(); assert.equal(state.props.modelValue, 376)
    state.press('ArrowRight'); await flush(); assert.equal(state.props.modelValue, 360)
    state.props.modelValue = 900; await flush(); assert.equal(state.props.modelValue, 640)
    state.width.value = 700; await flush(); assert.equal(state.props.modelValue, 340)
    assert.equal(separator.props['aria-valuemax'], 340); assert.equal(separator.props['aria-valuenow'], 340)
  } finally { state.app.unmount() }
})

test('drag commit, Escape, pointer cancel and unexpected capture loss have distinct completion paths', async () => {
  const state = mountResize(), { separator, pointer } = state
  let unmounted = false
  try {
    separator.props.onPointerdown(pointer(500)); separator.props.onPointermove(pointer(400)); await flush()
    assert.equal(state.props.modelValue, 460); assert.equal(separator.captured, 1)
    separator.props.onPointerup(pointer(400)); await flush()
    assert.equal(state.props.modelValue, 460); assert.equal(separator.captured, undefined)
    separator.props.onPointerdown(pointer(500)); separator.props.onPointermove(pointer(450)); await flush()
    state.press('Escape'); await flush(); assert.equal(state.props.modelValue, 460)
    separator.props.onPointerdown(pointer(500)); separator.props.onPointermove(pointer(450)); await flush()
    separator.props.onPointercancel(pointer(450)); await flush(); assert.equal(state.props.modelValue, 460)
    separator.props.onPointerdown(pointer(500)); separator.props.onPointermove(pointer(450)); await flush()
    separator.props.onLostpointercapture(pointer(450)); await flush(); assert.equal(state.props.modelValue, 460)
    separator.props.onPointerdown(pointer(500)); separator.props.onPointerdown(pointer(100, 2))
    separator.props.onPointerup(pointer(100, 2)); assert.equal(separator.captured, 1)
    separator.props.onPointermove(pointer(400)); await flush(); assert.equal(state.props.modelValue, 560)
    separator.props.onDblclick(); await flush(); assert.equal(state.props.modelValue, 360)
    separator.props.onPointerdown(pointer(500)); state.app.unmount(); unmounted = true
    assert.equal(separator.captured, undefined)
  } finally { if (!unmounted) state.app.unmount() }
})

test('Escape closes the resize action popover and restores its trigger focus', async () => {
  const state = mountResize()
  try {
    const popover = walk(state.root, node => typeof node.props['onUpdate:open'] === 'function')[0]
    const trigger = walk(state.root, node => node.type === 'button' && node.props['aria-controls']?.startsWith('panel-resize-'))[0]
    const group = walk(state.root, node => node.props.role === 'group')[0]
    popover.props['onUpdate:open'](true); await flush()
    assert.equal(trigger.props['aria-expanded'], true)
    state.button('reset').focus()
    group.props.onKeydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} }); await flush()
    assert.equal(trigger.props['aria-expanded'], false)
    assert.equal(state.document.activeElement, trigger)
  } finally { state.app.unmount() }
})
