import assert from 'node:assert/strict'
import test from 'node:test'
import { h, nextTick, ref } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'
import { createComponentRenderer } from './helpers/componentRuntime.mjs'

test('virtual lists publish their bounded rendered range after scrolling', async t => {
  const previousWindow = globalThis.window, callbacks = [], ranges = []
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  const load = createDashboardLoader({ '@vueuse/core': { useResizeObserver: (_target, callback) => callbacks.push(callback) } })
  const VirtualScroll = load('components/VirtualScroll/index.vue').default
  const view = createComponentRenderer(), component = ref()
  const app = view.renderer.createApp({ setup: () => () => h(VirtualScroll, {
    ref: component, data: Array.from({ length: 10 }, (_, id) => ({ id })), itemHeight: 50,
    onRangeChange: range => ranges.push(range),
  }) })
  t.after(() => { app.unmount(); globalThis.window = previousWindow })
  app.mount(view.root)
  Object.assign(component.value.$el, { clientHeight: 100, scrollHeight: 500, scrollTop: 0, scrollLeft: 0 })
  callbacks.at(-1)(); await nextTick()
  assert.deepEqual(ranges.at(-1), { start: 0, end: 4 })
  component.value.scrollTo(150); await nextTick()
  assert.deepEqual(ranges.at(-1), { start: 3, end: 7 })
  assert.equal(component.value.getScrollTop(), 150)
})
