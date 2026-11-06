import assert from 'node:assert/strict'
import test from 'node:test'
import * as vue from 'vue'
import { createDashboardLoader, passthrough } from './helpers/dashboardRuntime.mjs'

test('container changes update grid width without a window event, remount or layout commit', async () => {
  let observe, mounts = 0, sizeChanges = 0
  const width = vue.ref(820), changes = [], widgets = [{ id: 'device', type: 'device', componentProps: { gridItem: { x: 0, y: 0, w: 12, h: 17 } } }]
  const Layout = vue.defineComponent({ setup(_, { expose, slots }) {
    mounts++; expose({ width }); vue.watch(width, () => sizeChanges++, { flush: 'sync' })
    return () => vue.h('grid', slots.default?.())
  } })
  const Grid = createDashboardLoader({
    '@vueuse/core': { useResizeObserver: (_target, callback) => { observe = callback } },
    'vue3-grid-layout-next': { GridLayout: Layout, GridItem: passthrough('item') },
    'vue3-grid-layout-next/dist/style.css': {},
    '../composables/useDashboardDrag': { useDashboardDrag: () => ({ cancel() {}, getCommittedLayout: () => [] }) },
  })('components/DashBoardCanvas/components/GridCanvas.vue').default
  const renderer = vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
  const app = renderer.createApp({ setup: () => () => vue.h(Grid, { widgets, settings: { columns: 12, rowHeight: 10, margin: [8, 6] }, editable: false, layoutEditable: true, onChange: layout => changes.push(layout) }) })
  try {
    app.mount({}); await vue.nextTick()
    observe([{ borderBoxSize: [{ inlineSize: 809 }], contentRect: { width: 809 } }])
    await vue.nextTick()
    assert.equal(width.value, 809)
    observe([{ borderBoxSize: [{ inlineSize: 809 }], contentRect: { width: 809 } }])
    observe([{ borderBoxSize: [{ inlineSize: 0 }], contentRect: { width: 0 } }])
    assert.equal(sizeChanges, 1, 'same width and temporarily hidden containers must not schedule layout work')
    assert.equal(mounts, 1)
    assert.deepEqual(changes, [])
    assert.equal(widgets[0].componentProps.gridItem.w, 12)
  } finally { app.unmount() }
})

test('reactivating a cached grid restores its actual width before painting without a layout commit', async () => {
  const active = vue.ref(true), width = vue.ref(null), changes = []
  let mounts = 0
  const Layout = vue.defineComponent({ setup(_, { expose, slots }) {
    mounts++; expose({ width })
    // The grid library's own resize detector can observe zero while detached.
    vue.onDeactivated(() => { width.value = 0 })
    return () => vue.h('grid', slots.default?.())
  } })
  const Grid = createDashboardLoader({
    '@vueuse/core': { useResizeObserver() {} },
    'vue3-grid-layout-next': { GridLayout: Layout, GridItem: passthrough('item') },
    'vue3-grid-layout-next/dist/style.css': {},
    '../composables/useDashboardDrag': { useDashboardDrag: () => ({ cancel() {}, getCommittedLayout: () => [] }) },
  })('components/DashBoardCanvas/components/GridCanvas.vue').default
  const renderer = vue.createRenderer({ createElement: () => ({ offsetWidth: 820 }), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
  const app = renderer.createApp({ setup: () => () => vue.h(vue.KeepAlive, null, () => active.value ? vue.h(Grid, {
    widgets: [{ id: 'device', type: 'device', componentProps: { gridItem: { x: 0, y: 0, w: 12, h: 17 } } }],
    settings: { columns: 12, rowHeight: 10, margin: [8, 6] }, editable: false, layoutEditable: true,
    onChange: layout => changes.push(layout),
  }) : null) })
  try {
    app.mount({}); await vue.nextTick()
    assert.equal(width.value, 820)
    for (let i = 0; i < 3; i++) {
      active.value = false; await vue.nextTick(); assert.equal(width.value, 0)
      active.value = true; await vue.nextTick(); assert.equal(width.value, 820)
    }
    assert.equal(mounts, 1)
    assert.deepEqual(changes, [])
  } finally { app.unmount() }
})
