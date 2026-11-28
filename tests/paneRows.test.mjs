import assert from 'node:assert/strict'
import test from 'node:test'
import { h, nextTick, ref } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'
import { createComponentRenderer, walk } from './helpers/componentRuntime.mjs'

test('pane rows grow and shrink with natural content, exclude hidden layouts, and release removed panes', async t => {
  const heights = [], enabled = ref(true), second = ref(true)
  const load = createDashboardLoader({ '@vueuse/core': { useElementSize: () => {
    const height = ref(0); heights.push(height); return { height }
  } } })
  const { providePaneRows } = load('components/SplitterPane/usePaneRows.ts')
  const Pane = load('components/SplitterPane/index.vue').default
  const view = createComponentRenderer()
  const app = view.renderer.createApp({ setup() {
    providePaneRows(enabled)
    return () => h('main', [
      h(Pane, { 'data-pane': 'first' }, { header: () => h('input'), default: () => h('p', 'list') }),
      second.value && h(Pane, { 'data-pane': 'second' }, { header: () => h('strong', 'title'), toolbar: () => h('input') }),
    ])
  } })
  app.mount(view.root); t.after(() => app.unmount())
  const flush = async () => { await nextTick(); await nextTick() }
  const rows = () => walk(view.root, node => String(node.props.class).split(' ').includes('splitter-pane__row'))
  heights[0].value = 56; heights[3].value = 88; heights[4].value = 48; await flush()
  assert.deepEqual(rows().map(row => row.props.style.minHeight), ['88px', '48px', '88px', '48px'])
  heights[3].value = 57.6; await flush()
  assert.deepEqual(rows().map(row => row.props.style.minHeight), ['58px', '48px', '58px', '48px'])
  heights[3].value = 40; await flush()
  assert.deepEqual(rows().map(row => row.props.style.minHeight), ['56px', '48px', '56px', '48px'])
  enabled.value = false; await flush()
  assert.deepEqual(rows().map(row => row.props.style.minHeight), ['0px', '0px', '0px'])
  enabled.value = true; second.value = false; await flush()
  assert.deepEqual(rows().map(row => row.props.style.minHeight), ['56px'])
})

test('footer tracks align independent panes and release their natural height', async t => {
  const heights = [], second = ref(true)
  const load = createDashboardLoader({ '@vueuse/core': { useElementSize: () => {
    const height = ref(0); heights.push(height); return { height }
  } } })
  const { providePaneRows } = load('components/SplitterPane/usePaneRows.ts')
  const Pane = load('components/SplitterPane/index.vue').default, view = createComponentRenderer()
  const app = view.renderer.createApp({ setup() {
    providePaneRows()
    return () => h('main', [
      h(Pane, {}, { footer: () => h('button', 'create') }),
      second.value && h(Pane, {}, { footer: () => h('button', 'load') }),
    ])
  } })
  app.mount(view.root); t.after(() => app.unmount())
  const footerHeights = () => walk(view.root, node => node.type === 'footer').map(node => node.props.style.minHeight)
  heights[2].value = 48; heights[5].value = 64; await nextTick(); await nextTick()
  assert.deepEqual(footerHeights(), ['64px', '64px'])
  heights[5].value = 32; await nextTick(); await nextTick()
  assert.deepEqual(footerHeights(), ['48px', '48px'])
  heights[2].value = 48.25; await nextTick(); await nextTick()
  assert.deepEqual(footerHeights(), ['49px', '49px'])
  heights[2].value = 48; await nextTick(); await nextTick()
  assert.deepEqual(footerHeights(), ['48px', '48px'])
  second.value = false; await nextTick(); await nextTick()
  assert.deepEqual(footerHeights(), ['48px'])
})
