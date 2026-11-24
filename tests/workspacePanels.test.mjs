import assert from 'node:assert/strict'
import test from 'node:test'
import { createRenderer, defineComponent, h, markRaw, nextTick, onMounted, reactive, ref } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'

const flush = async () => { await nextTick(); await nextTick() }
const walk = (node, predicate) => [node, ...node.children.flatMap(child => walk(child, predicate))].filter(predicate)
const hasClass = (node, name) => String(node.props.class ?? '').split(' ').includes(name)

// Only DOM and the Ant rendering boundary are replaced; component state and handlers run unchanged.
function createTestRenderer() {
  const document = { activeElement: undefined }
  const node = (type, text = '') => markRaw({
    type, text, children: [], parent: undefined, props: {}, style: {}, ownerDocument: document,
    focus() { document.activeElement = this },
    contains(target) { return walk(this, child => child === target).length > 0 },
    querySelector(selector) {
      assert.equal(selector, 'button:not(:disabled)')
      return walk(this, child => child.type === 'button' && !child.props.disabled)[0]
    },
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
  const paneWidth = ref(240), containerWidth = ref(1000)
  let measures = 0
  const boundaries = {
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@vueuse/core': { useElementSize: () => ({ width: measures++ === 0 ? paneWidth : containerWidth }), useElementVisibility: () => ref(true) },
  }
  const Handle = createDashboardLoader(boundaries)('components/PanelResizeHandle/index.vue').default
  const Columns = createDashboardLoader({ ...boundaries, '../PanelResizeHandle/index.vue': { default: Handle, __esModule: true } })('components/EqualHeightColumns/index.vue').default
  const props = reactive(extra), requests = [], changes = [], resizes = [], draft = ref('待处理对象'), headerDraft = ref('搜索草稿'), currentMode = ref(mode)
  let mounts = 0
  const Left = defineComponent({ setup() { onMounted(() => mounts++); return () => h('input', { 'aria-label': 'left', value: draft.value }) } })
  const state = createTestRenderer()
  const slots = () => ({
    left: () => h(Left), right: () => h('input', { 'aria-label': 'right' }),
    ...(currentMode.value === 'left' || currentMode.value === 'both' ? { 'left-header': () => h('input', { 'aria-label': 'left-search', value: headerDraft.value }) } : {}),
    ...(currentMode.value === 'toolbar' || currentMode.value === 'both' ? { 'right-header': () => h('input', { 'aria-label': 'search' }) } : {}),
  })
  const app = state.register(state.renderer.createApp({ setup: () => () => h(Columns, {
    ...props,
    'onUpdate:collapsed': value => { requests.push(value); if (accept && props.collapsed !== undefined) props.collapsed = value },
    onCollapseChange: value => changes.push(value),
    onResize: value => resizes.push(value),
  }, slots()) }))
  app.mount(state.root)
  return { ...state, app, props, requests, changes, resizes, paneWidth, containerWidth, draft, headerDraft, mode: currentMode, mounts: () => mounts,
    buttons: () => walk(state.root, node => node.type === 'button'),
    field: label => walk(state.root, node => node.props['aria-label'] === label)[0],
    body: () => { const id = walk(state.root, node => node.type === 'button')[0]?.props['aria-controls']?.split(' ')[0]; return walk(state.root, node => node.props.id === id)[0] },
  }
}

test('dynamic toolbar/default/left/both slots preserve content and update the unique entry without empty headers', async () => {
  const state = mountColumns('toolbar')
  const left = state.field('left'), right = state.field('right'), body = state.body()
  try {
    state.draft.value = '切换布局仍保留的草稿'
    for (const mode of ['default', 'left', 'both', 'toolbar', 'default']) {
      state.mode.value = mode; await flush()
      assert.equal(state.buttons().length, 1)
      assert.equal(state.body(), body)
      assert.equal(state.field('left'), left); assert.equal(state.field('right'), right)
      assert.equal(left.props.value, '切换布局仍保留的草稿'); assert.equal(state.mounts(), 1)
      assert.equal(walk(state.root, node => hasClass(node, 'equal-height-columns__toolbar')).length, ['toolbar', 'both'].includes(mode) ? 1 : 0)
      assert.equal(walk(state.root, node => hasClass(node, 'equal-height-columns__header')).length, mode === 'toolbar' ? 0 : 1)
      assert.equal(state.root.children[0].children.filter(node => node.type === 'div').length, 2, 'the layout contains only its two panes')
      const button = state.buttons()[0]
      assert.ok(hasClass(button.parent.parent, ['toolbar', 'both'].includes(mode) ? 'equal-height-columns__pane--right' : 'equal-height-columns__pane--left'), 'a real main toolbar owns the entry even when the left header has search')
      if (mode === 'both') assert.equal(walk(state.root, node => hasClass(node, 'equal-height-columns__header'))[0].contains(button), false)
      state.buttons()[0].props.onClick(); await flush()
      const style = state.root.children[0].props.style
      assert.equal(style['--equal-height-columns-left-width'], ['toolbar', 'both'].includes(mode) ? '0px' : 'var(--equal-height-columns-collapsed-width)')
      state.buttons()[0].props.onClick(); await flush()
    }
  } finally { state.app.unmount() }
})

for (const mode of ['default', 'toolbar', 'left', 'both']) {
  test(`${mode}: unique disclosure retains its instance, input and control relation`, async () => {
    const state = mountColumns(mode)
    try {
      const button = state.buttons()[0], field = state.field('left'), body = state.body(), headerInput = state.field('left-search')
      assert.equal(state.buttons().length, 1)
      assert.ok(body)
      assert.equal(button.props['aria-expanded'], true)
      state.draft.value = '保留的草稿'; await flush()
      button.props.onClick(); await flush()
      assert.equal(button.props['aria-expanded'], false)
      assert.equal(state.field('left'), field)
      assert.equal(body.props.inert, true); assert.equal(body.style.display, 'none')
      if (headerInput) {
        assert.equal(state.field('left-search'), headerInput)
        assert.equal(headerInput.parent.style.display, 'none')
        assert.equal(headerInput.parent.props.inert, true)
        assert.equal(headerInput.parent.props['aria-hidden'], true)
        assert.ok(button.props['aria-controls'].split(' ').includes(headerInput.parent.props.id))
      }
      button.props.onClick(); await flush()
      assert.equal(state.buttons()[0], button)
      assert.equal(field.props.value, '保留的草稿')
      if (headerInput) assert.equal(headerInput.props.value, '搜索草稿')
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
    assert.equal(walk(state.root, node => node.type === 'header').length, 0, 'non-collapsible fallback adds no empty header')
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

test('collapse relocates hidden header/body focus without stealing main or toolbar focus', async () => {
  for (const mode of ['default', 'toolbar', 'left', 'both']) {
    const state = mountColumns(mode, { collapsed: false })
    try {
      for (const label of ['left', 'left-search'].filter(label => state.field(label))) {
        state.props.collapsed = false; await flush()
        state.field(label).focus()
        state.props.collapsed = true; await flush()
        assert.equal(state.document.activeElement, state.buttons()[0], `${mode}: hidden ${label} returns to its entry`)
      }
      for (const label of ['right', 'search'].filter(label => state.field(label))) {
        state.props.collapsed = false; await flush()
        state.field(label).focus()
        state.props.collapsed = true; await flush()
        assert.equal(state.document.activeElement, state.field(label), `${mode}: visible ${label} keeps focus`)
      }
    } finally { state.app.unmount() }
  }
})

function mountResize(extra = {}) {
  const width = ref(1000)
  const Handle = createDashboardLoader({
    '@vueuse/core': { useElementSize: () => ({ width }), useElementVisibility: () => ref(true) },
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
  })('components/PanelResizeHandle/index.vue').default
  const props = reactive({ modelValue: 360, 'aria-label': '属性面板宽度', 'aria-controls': 'properties', title: '调整属性', class: 'host-handle', style: { opacity: 0.9 }, ...extra }), changes = [], drags = [], state = createTestRenderer()
  const app = state.register(state.renderer.createApp({ setup: () => () => h(Handle, {
    ...props,
    'onUpdate:modelValue': value => { changes.push(value); props.modelValue = value },
    onDrag: event => drags.push(event),
  }) }))
  app.mount(state.root)
  const separator = walk(state.root, node => node.props.role === 'separator')[0]
  const button = key => walk(state.root, node => node.type === 'button' && node.children.some(child => child.text === `components.PanelResizeHandle.${key}`))[0]
  const press = key => [].concat(separator.props.onKeydown).forEach(handler => handler({ key, preventDefault() {} }))
  const pointer = (x, id = 1) => ({ button: 0, clientX: x, pointerId: id, currentTarget: separator, preventDefault() {} })
  return { ...state, app, props, changes, drags, width, separator, button, press, pointer }
}

test('drag reports raw directional sizes and exactly one completion after capture release', async t => {
  const state = mountResize({ side: 'right' }); t.after(() => state.app.unmount())
  const { separator, pointer } = state
  separator.props.onPointerdown(pointer(500)); separator.props.onPointermove(pointer(600)); await flush()
  assert.equal(state.props.modelValue, 320)
  separator.props.onPointerup(pointer(600)); await flush()
  assert.deepEqual(state.drags, [
    { phase: 'start', initialSize: 360, requestedSize: 360 },
    { phase: 'move', initialSize: 360, requestedSize: 260 },
    { phase: 'end', initialSize: 360, requestedSize: 260 },
  ])
  assert.equal(separator.captured, undefined)
})

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
    state.width.value = 700.5; await flush(); state.press('End'); await flush()
    assert.equal(state.props.modelValue, 340.5, 'rounding must not cross a fractional container bound')
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

test('click actions ignore a completed drag; keyboard opens the menu and Escape returns to the separator', async () => {
  const state = mountResize()
  try {
    const popover = walk(state.root, node => typeof node.props.onOpenChange === 'function')[0]
    const group = walk(state.root, node => node.props.role === 'dialog')[0]
    const { separator, pointer } = state
    separator.props.onPointerdown(pointer(500)); separator.props.onPointermove(pointer(450)); separator.props.onPointerup(pointer(450))
    popover.props.onOpenChange(true); await flush()
    assert.equal(popover.props.open, false, 'the generated click after dragging must not open the menu')
    separator.props.onPointerdown(pointer(450)); separator.props.onPointerup(pointer(450))
    popover.props.onOpenChange(true); await flush()
    assert.equal(popover.props.open, true, 'a stationary click can open the actions')
    state.press('Escape'); await flush()
    state.press('Enter'); await flush()
    assert.equal(popover.props.open, true)
    assert.equal(state.document.activeElement, state.button('shrink'))
    state.button('reset').focus()
    group.props.onKeydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} }); await flush()
    assert.equal(popover.props.open, false)
    assert.equal(state.document.activeElement, separator)
  } finally { state.app.unmount() }
})

function mountSplitter(extra = {}, accept = true, reducedMotion = false) {
  const paneWidth = ref(240), paneHeight = ref(180), containerWidth = ref(1000), containerHeight = ref(600)
  let measures = 0, mounts = 0
  const boundaries = {
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@vueuse/core': {
      useElementSize: () => {
        const measurement = measures++
        return measurement === 0 ? { width: paneWidth, height: paneHeight }
          : measurement === 1 ? { width: containerWidth, height: containerHeight } : { width: ref(0), height: ref(0) }
      },
      useElementVisibility: () => ref(true),
      useMediaQuery: () => ref(reducedMotion),
    },
  }
  const Handle = createDashboardLoader(boundaries)('components/PanelResizeHandle/index.vue').default
  const Splitter = createDashboardLoader({ ...boundaries, '../PanelResizeHandle/index.vue': { default: Handle, __esModule: true } })('components/Splitter/index.vue').default
  const props = reactive(extra), requests = [], collapses = [], draft = ref('保留的输入')
  const Start = defineComponent({ setup() { onMounted(() => mounts++); return () => h('input', { 'aria-label': 'start', value: draft.value }) } })
  const state = createTestRenderer()
  const app = state.register(state.renderer.createApp({ setup: () => () => h(Splitter, {
    ...props,
    'onUpdate:size': value => { requests.push(value); if (accept && props.size !== undefined) props.size = value },
    'onUpdate:collapsed': value => { collapses.push(value); if (accept && props.collapsed !== undefined) props.collapsed = value },
  }, { start: () => h(Start), end: scope => [h('button', { 'aria-label': 'toggle', onClick: scope.toggle }), h('input', { 'aria-label': 'end' })] }) }))
  app.mount(state.root)
  const separator = () => walk(state.root, node => node.props.role === 'separator')[0]
  const field = label => walk(state.root, node => node.props['aria-label'] === label)[0]
  const startPane = () => walk(state.root, node => hasClass(node, 'splitter__pane--start'))[0]
  startPane().getBoundingClientRect = () => ({ width: paneWidth.value, height: paneHeight.value })
  const pointer = (x, y = 0) => ({ button: 0, clientX: x, clientY: y, pointerId: 1, currentTarget: separator(), preventDefault() {} })
  const press = key => separator().props.onKeydown({ key, preventDefault() {} })
  return { ...state, app, props, requests, collapses, separator, field, startPane, pointer, press, draft, containerWidth, containerHeight, paneWidth, paneHeight, mounts: () => mounts }
}

async function previewCollapse(state) {
  const separator = state.separator(), initial = separator.props['aria-valuenow'], min = separator.props['aria-valuemin']
  separator.props.onPointerdown(state.pointer(initial)); separator.props.onPointermove(state.pointer(min)); await flush()
  separator.props.onPointermove(state.pointer(min / 2 - 1)); await flush()
  return separator
}

test('midpoint collapse intent retains capture without jumping the layout or hiding the content', async t => {
  const state = mountSplitter({ collapseOnDrag: true, min: 160 }); t.after(() => state.app.unmount())
  const separator = await previewCollapse(state), input = state.field('start')
  assert.equal(state.separator(), separator); assert.equal(separator.captured, 1)
  assert.equal(separator.props['aria-valuetext'], 'components.Splitter.releaseToCollapse')
  assert.match(state.root.children[0].props.style.gridTemplateColumns, /160px/)
  assert.equal(state.startPane().props.inert, undefined); assert.equal(state.mounts(), 1); assert.deepEqual(state.collapses, [])
  assert.equal(hasClass(state.root.children[0], 'splitter--motion'), false)
  separator.props.onPointermove(state.pointer(79)); await flush()
  assert.equal(separator.props['aria-valuetext'], 'components.Splitter.releaseToCollapse')
  separator.props.onPointermove(state.pointer(80)); await flush()
  assert.equal(separator.props['aria-valuetext'], 'components.Splitter.releaseToCollapse')
  separator.props.onPointermove(state.pointer(96)); await flush()
  assert.equal(separator.props['aria-valuetext'], undefined); assert.equal(state.startPane().props.inert, undefined)
  separator.props.onPointerup(state.pointer(96)); await flush()
  assert.deepEqual(state.collapses, []); assert.equal(separator.props['aria-valuenow'], 160)
})

test('fast drags across the midpoint still resize to the legal minimum before committing a fold', async t => {
  const state = mountSplitter({ collapseOnDrag: true, min: 160 }); t.after(() => state.app.unmount())
  const separator = state.separator()
  separator.props.onPointerdown(state.pointer(240)); separator.props.onPointermove(state.pointer(79)); await flush()
  assert.equal(separator.props['aria-valuenow'], 160)
  assert.match(state.root.children[0].props.style.gridTemplateColumns, /160px/)
  assert.equal(state.startPane().props.inert, undefined)
  separator.props.onPointerup(state.pointer(79)); await flush()
  assert.deepEqual(state.requests, [160, 240]); assert.deepEqual(state.collapses, [true])
})

test('releasing a preview preserves pre-drag size, content and focus in local and controlled layouts', async t => {
  for (const extra of [{}, { size: 240, collapsed: false }]) {
    const state = mountSplitter({ collapseOnDrag: true, min: 160, ...extra }); t.after(() => state.app.unmount())
    const input = state.field('start'); state.draft.value = '自动折叠保留的草稿'; await flush()
    const separator = await previewCollapse(state)
    separator.props.onPointerup(state.pointer(79)); await flush()
    assert.deepEqual(state.collapses, [true]); assert.equal(state.separator(), separator)
    assert.equal(separator.props['aria-valuenow'], 0)
    assert.equal(separator.captured, undefined); assert.equal(state.document.activeElement, state.field('end').parent)
    state.field('toggle').props.onClick(); await flush()
    assert.equal(state.separator().props['aria-valuenow'], 240)
    assert.equal(state.field('start'), input); assert.equal(input.props.value, '自动折叠保留的草稿'); assert.equal(state.mounts(), 1)
    assert.deepEqual(state.requests, [160, 240]); assert.deepEqual(state.collapses, [true, false])
  }
})

for (const operation of ['Escape', 'onPointercancel', 'onLostpointercapture']) {
  test(`${operation} cancels preview and restores the drag baseline`, async t => {
    const state = mountSplitter({ collapseOnDrag: true, min: 160 }); t.after(() => state.app.unmount())
    const separator = await previewCollapse(state)
    if (operation === 'Escape') state.press('Escape')
    else separator.props[operation](state.pointer(79))
    await flush()
    assert.equal(state.separator(), separator); assert.equal(separator.captured, undefined)
    assert.equal(separator.props['aria-valuetext'], undefined); assert.equal(separator.props['aria-valuenow'], 240)
    assert.deepEqual(state.collapses, []); assert.equal(state.startPane().props.inert, undefined)
  })
}

test('controlled rejection restores actual state after preview; unenabled splitters only clamp size', async t => {
  for (const enabled of [false, true]) {
    const state = mountSplitter({ collapseOnDrag: enabled, min: 160, size: 280, collapsed: false }, false); t.after(() => state.app.unmount())
    const separator = await previewCollapse(state)
    assert.equal(separator.props['aria-valuetext'], enabled ? 'components.Splitter.releaseToCollapse' : undefined)
    separator.props.onPointerup(state.pointer(79)); await flush()
    assert.equal(state.separator(), separator); assert.equal(separator.props['aria-valuenow'], 280)
    assert.equal(state.startPane().props.inert, undefined)
    assert.deepEqual(state.collapses, enabled ? [true] : [])
  }
})

test('vertical collapse follows pointer Y and restores pre-drag height', async t => {
  const state = mountSplitter({ collapseOnDrag: true, orientation: 'vertical', min: 100 }); t.after(() => state.app.unmount())
  const separator = state.separator()
  separator.props.onPointerdown(state.pointer(900, 180)); separator.props.onPointermove(state.pointer(900, 100)); await flush()
  separator.props.onPointermove(state.pointer(900, 49)); await flush()
  assert.match(state.root.children[0].props.style.gridTemplateRows, /100px/)
  separator.props.onPointerup(state.pointer(900, 49)); await flush()
  assert.deepEqual(state.collapses, [true])
  state.field('toggle').props.onClick(); await flush()
  assert.equal(state.separator().props['aria-valuenow'], 180)
})

test('keyboard sizing, constraint changes, disabling, direction changes and unmount do not commit a pending fold', async t => {
  for (const operation of ['Home', 'constraints', 'disable', 'direction', 'unmount']) {
    const state = mountSplitter({ collapseOnDrag: true, min: 160, endMin: 360 })
    let unmounted = false; t.after(() => { if (!unmounted) state.app.unmount() })
    const separator = await previewCollapse(state)
    if (operation === 'Home') state.press('Home')
    else if (operation === 'constraints') state.containerWidth.value = 500
    else if (operation === 'disable') state.props.resizable = false
    else if (operation === 'direction') state.props.orientation = 'vertical'
    else { state.app.unmount(); unmounted = true }
    await flush()
    assert.equal(separator.captured, undefined); assert.deepEqual(state.collapses, [])
    if (!unmounted && state.separator()) assert.equal(state.separator().props['aria-valuetext'], undefined)
  }
})

test('a collapsed edge reveals content without publishing and commits one legal size on release', async t => {
  for (const controlled of [false, true]) {
    const state = mountSplitter({ collapseOnDrag: true, min: 160, ...(controlled ? { size: 240, collapsed: true } : {}) }, true, true)
    t.after(() => state.app.unmount())
    if (!controlled) state.field('toggle').props.onClick()
    state.paneWidth.value = 0; await flush()
    state.requests.length = 0; state.collapses.length = 0
    const separator = state.separator(), input = state.field('start')
    assert.equal(separator.props['aria-valuenow'], 0)
    assert.equal(separator.props['aria-valuemin'], 0)
    assert.equal(separator.props['aria-label'], 'components.Splitter.dragToExpand')
    separator.props.onPointerdown(state.pointer(0)); separator.props.onPointermove(state.pointer(80)); await flush()
    assert.match(state.root.children[0].props.style.gridTemplateColumns, /80px/)
    assert.equal(state.startPane().children[0].props.style.width, '160px')
    assert.equal(state.startPane().props.inert, true)
    assert.equal(separator.captured, 1)
    assert.deepEqual(state.requests, []); assert.deepEqual(state.collapses, [])
    separator.props.onPointerup(state.pointer(80)); await flush()
    assert.deepEqual(state.requests, [160]); assert.deepEqual(state.collapses, [false])
    assert.equal(state.separator(), separator); assert.equal(separator.props['aria-valuenow'], 160)
    assert.equal(state.field('start'), input); assert.equal(state.mounts(), 1)
  }
})

test('reopen cancellation, short drags and lifecycle changes retain the saved expanded size', async t => {
  for (const operation of ['Escape', 'onPointercancel', 'onLostpointercapture', 'short', 'constraints', 'disable', 'direction', 'unmount']) {
    const state = mountSplitter({ collapseOnDrag: true, min: 160, size: 240, collapsed: true, endMin: 360 }, true, true)
    let unmounted = false; t.after(() => { if (!unmounted) state.app.unmount() })
    const separator = state.separator()
    separator.props.onPointerdown(state.pointer(0)); separator.props.onPointermove(state.pointer(40)); await flush()
    if (operation === 'Escape') state.press('Escape')
    else if (operation.startsWith('on')) separator.props[operation](state.pointer(40))
    else if (operation === 'short') separator.props.onPointerup(state.pointer(40))
    else if (operation === 'constraints') state.containerWidth.value = 500
    else if (operation === 'disable') state.props.resizable = false
    else if (operation === 'direction') state.props.orientation = 'vertical'
    else { state.app.unmount(); unmounted = true }
    await flush()
    assert.equal(separator.captured, undefined)
    assert.deepEqual(state.requests, []); assert.deepEqual(state.collapses, [])
    assert.equal(state.props.size, 240); assert.equal(state.props.collapsed, true)
    if (!unmounted) assert.equal(hasClass(state.root.children[0], 'splitter--restoring'), false)
  }
})

test('controlled rejection closes the reopen preview without changing actual collapsed state', async t => {
  const state = mountSplitter({ collapseOnDrag: true, min: 160, size: 240, collapsed: true }, false, true)
  t.after(() => state.app.unmount())
  const separator = state.separator()
  separator.props.onPointerdown(state.pointer(0)); separator.props.onPointermove(state.pointer(180)); await flush()
  separator.props.onPointerup(state.pointer(180)); await flush()
  assert.deepEqual(state.requests, [180]); assert.deepEqual(state.collapses, [false])
  assert.equal(state.props.size, 240); assert.equal(state.props.collapsed, true)
  assert.equal(separator.props['aria-valuenow'], 0)
  assert.match(state.root.children[0].props.style.gridTemplateColumns, /0px/)
})

test('keyboard sizing and reset can reopen a collapsed edge through the same bounds', async t => {
  for (const operation of ['ArrowRight', 'End', 'reset']) {
    const state = mountSplitter({ collapseOnDrag: true, min: 160, max: 360, size: 240, collapsed: true }, true, true)
    t.after(() => state.app.unmount())
    if (operation === 'reset') state.separator().props.onDblclick()
    else state.press(operation)
    await flush()
    const expected = operation === 'End' ? 360 : operation === 'reset' ? 240 : 160
    assert.deepEqual(state.requests, [expected]); assert.deepEqual(state.collapses, [false])
    assert.equal(state.separator().props['aria-valuenow'], expected)
  }
})

test('reopening follows pointer Y and a matching final extent does not wait for a nonexistent transition', async t => {
  const state = mountSplitter({ collapseOnDrag: true, orientation: 'vertical', min: 100, size: 180, collapsed: true })
  t.after(() => state.app.unmount())
  const separator = state.separator()
  separator.props.onPointerdown(state.pointer(900, 0)); separator.props.onPointermove(state.pointer(900, 180)); await flush()
  assert.match(state.root.children[0].props.style.gridTemplateRows, /180px/)
  separator.props.onPointerup(state.pointer(900, 180)); await flush()
  assert.deepEqual(state.requests, [180]); assert.deepEqual(state.collapses, [false])
  assert.equal(hasClass(state.root.children[0], 'splitter--motion'), false)
  assert.equal(separator.props.inert, undefined)
})

test('the gutter has its own budget and yields space to the end pane in a tight container', async t => {
  const state = mountSplitter({ min: 160, endMin: 240 }); t.after(() => state.app.unmount())
  state.containerWidth.value = 390; await flush()
  state.press('End'); await flush()
  assert.equal(state.separator().props['aria-valuenow'], 138)
  assert.match(state.root.children[0].props.style.gridTemplateColumns, /\) 12px minmax/)
  state.containerWidth.value = 245; await flush()
  assert.equal(state.separator().props['aria-valuemax'], 0)
  assert.match(state.root.children[0].props.style.gridTemplateColumns, /\) 5px minmax/)
  state.containerWidth.value = 200; await flush()
  assert.equal(state.separator(), undefined)
  assert.match(state.root.children[0].props.style.gridTemplateColumns, /\) 0px minmax/)
})

test('reopen settling restores focus lost to inert but does not steal a subsequent focus change', async t => {
  for (const moved of [false, true]) {
    const state = mountSplitter({ collapseOnDrag: true, min: 160, size: 240, collapsed: true })
    t.after(() => state.app.unmount())
    const separator = state.separator(), root = state.root.children[0]
    separator.isConnected = true
    state.document.body = {}
    separator.props.onPointerdown(state.pointer(0)); separator.props.onPointermove(state.pointer(120)); await flush()
    state.paneWidth.value = 120
    separator.props.onPointerup(state.pointer(120)); await flush()
    assert.equal(hasClass(root, 'splitter--motion'), true)
    state.document.activeElement = moved ? state.field('end') : state.document.body
    root.props.onTransitionend({ target: root, propertyName: 'grid-template-columns' }); await flush()
    assert.equal(state.document.activeElement, moved ? state.field('end') : separator)
  }
})

test('collapse motion freezes content, completes on the root transition and respects reduced motion', async t => {
  for (const reduced of [false, true]) {
    const state = mountSplitter({}, true, reduced); t.after(() => state.app.unmount())
    const root = state.root.children[0]
    state.field('toggle').props.onClick(); await flush()
    assert.equal(hasClass(root, 'splitter--motion'), !reduced)
    if (!reduced) {
      assert.equal(state.startPane().children[0].props.style.width, '240px')
      root.props.onTransitionend({ target: root, propertyName: 'grid-template-columns' }); await flush()
      assert.equal(hasClass(root, 'splitter--motion'), false)
    }
    state.field('toggle').props.onClick(); await flush()
    if (!reduced) root.props.onTransitionend({ target: root, propertyName: 'grid-template-columns' })
    await flush()
    assert.equal(state.startPane().props.inert, undefined)
  }
})

test('Splitter retains local size, content instances and drafts across collapse and restores its measured initial size', async () => {
  const state = mountSplitter({ min: 160, max: 480, endMin: 360 })
  try {
    const input = state.field('start'), end = state.field('end')
    const separator = state.separator()
    assert.equal(separator.props['aria-controls'], state.startPane().props.id)
    separator.props.onPointerdown(state.pointer(240)); separator.props.onPointermove(state.pointer(320)); separator.props.onPointerup(state.pointer(320)); await flush()
    assert.equal(state.separator().props['aria-valuenow'], 320)
    assert.match(state.root.children[0].props.style.gridTemplateColumns, /320px/)
    state.draft.value = '折叠后仍保留'; input.focus()
    state.field('toggle').props.onClick(); await flush()
    assert.equal(state.separator(), undefined); assert.equal(state.startPane().props.inert, true)
    assert.match(state.root.children[0].props.style.gridTemplateColumns, /0px/)
    assert.equal(state.document.activeElement, end.parent)
    state.field('toggle').props.onClick(); await flush()
    assert.equal(state.field('start'), input); assert.equal(input.props.value, '折叠后仍保留'); assert.equal(state.mounts(), 1)
    assert.equal(state.separator().props['aria-valuenow'], 320)
    state.separator().props.onDblclick(); await flush()
    assert.equal(state.separator().props['aria-valuenow'], 240)
    assert.deepEqual(state.requests, [320, 240]); assert.deepEqual(state.collapses, [true, false])
  } finally { state.app.unmount() }
})

test('vertical Splitter uses pointer Y and up/down keys, and yields its minimum when the host cannot fit both panes', async () => {
  const state = mountSplitter({ orientation: 'vertical', min: 100, max: 400, endMin: 180 })
  try {
    assert.equal(state.separator().props['aria-orientation'], 'horizontal')
    state.separator().props.onPointerdown(state.pointer(200, 180)); state.separator().props.onPointermove(state.pointer(900, 240)); state.separator().props.onPointerup(state.pointer(900, 240)); await flush()
    assert.equal(state.separator().props['aria-valuenow'], 240)
    state.press('ArrowRight'); await flush(); assert.equal(state.separator().props['aria-valuenow'], 240)
    state.press('ArrowDown'); await flush(); assert.equal(state.separator().props['aria-valuenow'], 256)
    state.press('ArrowUp'); await flush(); assert.equal(state.separator().props['aria-valuenow'], 240)
    assert.match(state.root.children[0].props.style.gridTemplateRows, /240px/)
    state.containerHeight.value = 220; await flush()
    assert.equal(state.separator().props['aria-valuenow'], 28); assert.equal(state.separator().props['aria-valuemin'], 28)
    state.separator().focus(); state.props.resizable = false; await flush()
    assert.equal(state.separator(), undefined); assert.equal(state.document.activeElement, state.field('end').parent)
  } finally { state.app.unmount() }
})

test('controlled Splitter requests can be rejected without changing size or collapse and external changes are not echoed', async () => {
  const state = mountSplitter({ size: 280, collapsed: false }, false)
  try {
    state.press('ArrowRight'); await flush()
    assert.deepEqual(state.requests, [296]); assert.equal(state.separator().props['aria-valuenow'], 280)
    state.field('toggle').props.onClick(); await flush()
    assert.deepEqual(state.collapses, [true]); assert.ok(state.separator()); assert.equal(state.startPane().props.inert, undefined)
    state.props.size = 320; await flush()
    assert.equal(state.separator().props['aria-valuenow'], 320); assert.deepEqual(state.requests, [296])
    state.props.collapsed = true; await flush()
    assert.equal(state.separator(), undefined); assert.deepEqual(state.collapses, [true])
  } finally { state.app.unmount() }
})

test('percentage sizing stays responsive until interaction and a zero-size pane keeps its recovery handle', async () => {
  const state = mountSplitter()
  try {
    state.paneWidth.value = 240.5; await flush()
    assert.deepEqual(state.requests, [])
    assert.match(state.root.children[0].props.style.gridTemplateColumns, /30%/)
    state.containerWidth.value = 100; await flush()
    state.paneWidth.value = 30; await flush()
    state.containerWidth.value = 1000; state.paneWidth.value = 300; await flush()
    assert.deepEqual(state.requests, [], 'automatic container changes must not pin percentage sizing to pixels')
    assert.equal(state.separator().props['aria-valuenow'], 300)
    state.press('Home'); await flush()
    state.paneWidth.value = 0; await flush()
    assert.ok(state.separator()); assert.equal(state.separator().props['aria-valuenow'], 0)
    assert.equal(state.startPane().props.inert, true)
    state.press('ArrowRight'); await flush()
    assert.equal(state.separator().props['aria-valuenow'], 16)
  } finally { state.app.unmount() }
})

test('changing Splitter direction measures the new track before mounting the handle or normalizing stale dimensions', async () => {
  const state = mountSplitter({ min: 100, max: 480, endMin: 180 })
  try {
    state.paneWidth.value = 500; await flush()
    const previous = [...state.requests]
    state.props.orientation = 'vertical'; state.props.defaultSize = 180; await flush()
    assert.equal(state.separator().props['aria-valuenow'], 180)
    assert.equal(state.separator().props['aria-orientation'], 'horizontal')
    assert.deepEqual(state.requests, previous)
  } finally { state.app.unmount() }
})

test('left-side resize follows pointer and arrow direction, shares bounds and cancels to its starting width', async () => {
  const state = mountResize({ side: 'left' }), { separator, pointer } = state
  try {
    state.press('ArrowRight'); await flush(); assert.equal(state.props.modelValue, 376)
    state.press('ArrowLeft'); await flush(); assert.equal(state.props.modelValue, 360)
    separator.props.onPointerdown(pointer(300)); separator.props.onPointermove(pointer(400)); await flush()
    assert.equal(state.props.modelValue, 460)
    state.press('Escape'); await flush(); assert.equal(state.props.modelValue, 360)
    separator.props.onPointerdown(pointer(300)); separator.props.onPointermove(pointer(900)); await flush()
    assert.equal(state.props.modelValue, 640)
    separator.props.onPointerup(pointer(900)); await flush()
    separator.props.onDblclick(); await flush(); assert.equal(state.props.modelValue, 360)
  } finally { state.app.unmount() }
})

test('resizable columns retain width and input through collapse, reset to their measured initial size and accept an external track', async () => {
  const state = mountColumns('both', { collapsed: false, resizable: true, leftWidth: '15rem' })
  const separator = () => walk(state.root, node => node.props.role === 'separator')[0]
  const toggle = () => walk(state.root, node => hasClass(node, 'equal-height-columns__header-toggle'))[0]
  const width = () => state.root.children[0].props.style['--equal-height-columns-left-width']
  const pointer = x => ({ button: 0, clientX: x, pointerId: 1, currentTarget: separator(), preventDefault() {} })
  try {
    const input = state.field('left-search')
    assert.equal(separator().props['aria-valuenow'], 240)
    assert.ok(separator().props['aria-controls'].includes(state.field('left').parent.props.id))
    separator().props.onPointerdown(pointer(240)); separator().props.onPointermove(pointer(320)); await flush()
    separator().props.onPointerup(pointer(320)); await flush()
    assert.equal(width(), '320px'); assert.deepEqual(state.resizes, [320])
    state.props.collapsed = true; await flush()
    assert.equal(separator(), undefined); assert.equal(width(), '0px')
    assert.equal(state.document.activeElement, toggle())
    state.props.collapsed = false; await flush()
    assert.equal(width(), '320px'); assert.equal(separator().props['aria-valuenow'], 320)
    assert.equal(state.field('left-search'), input)
    separator().props.onDblclick(); await flush(); assert.equal(width(), '240px')
    state.props.leftWidth = '20rem'; state.paneWidth.value = 320; await flush()
    assert.equal(width(), '20rem'); assert.equal(separator().props['aria-valuenow'], 320)
    state.containerWidth.value = 600; await flush()
    assert.equal(width(), '240px'); assert.equal(separator().props['aria-valuemax'], 240)
    separator().focus(); state.props.resizable = false; await flush()
    assert.equal(separator(), undefined); assert.equal(width(), '240px')
    assert.equal(state.document.activeElement, toggle())
    toggle().props.onClick(); await flush()
    assert.equal(state.document.activeElement, toggle(), 'explicit toggle actions retain focus after the icon changes')
  } finally { state.app.unmount() }
})
