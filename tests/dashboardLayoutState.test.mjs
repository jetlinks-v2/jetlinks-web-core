import assert from 'node:assert/strict'
import test from 'node:test'
import * as vue from 'vue'
import { createDashboardLoader, passthrough } from './helpers/dashboardRuntime.mjs'

const { useDashboardState } = createDashboardLoader()('components/DashBoardCanvas/composables/useDashboardState.ts')
const initial = () => ({ canvas: {}, components: [{ id: 'resources', type: 'resources', componentProps: { gridItem: { x: 0, y: 0, w: 12, h: 17, minW: 12, minH: 17, maxH: 100 } } }] })

function harness(t) {
  const saved = new Map(), input = vue.ref(initial()), changes = []
  const oldStorage = globalThis.localStorage
  globalThis.localStorage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) }
  const scope = vue.effectScope()
  const state = scope.run(() => useDashboardState({ value: () => input.value, catalog: () => ({ components: {}, groups: [] }), editable: () => false, layoutEditable: () => true, storageKey: () => 'node:regular', onChange: value => changes.push(value) }))
  t.after(() => { scope.stop(); if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage })
  return { saved, input, state, changes }
}

test('personal layout stores only coordinates without changing source configuration or emitting business updates', t => {
  const { saved, input, state, changes } = harness(t)
  state.updateLayout([{ i: 'resources', x: 0, y: 5, w: 12, h: 20 }])
  assert.equal(input.value.components[0].componentProps.gridItem.y, 0)
  assert.equal(state.value.value.components[0].componentProps.gridItem.y, 5)
  assert.deepEqual(JSON.parse(saved.get('node:regular')), [{ i: 'resources', x: 0, y: 5, w: 12, h: 20 }])
  assert.deepEqual(changes, [])
})

test('expanded content respects new minimum size while collapse restores the saved personal size', async t => {
  const { input, state } = harness(t)
  state.updateLayout([{ i: 'resources', x: 0, y: 5, w: 12, h: 20 }])
  input.value = { ...initial(), components: [{ ...initial().components[0], componentProps: { gridItem: { x: 0, y: 0, w: 12, h: 48, minW: 12, minH: 48, maxH: 100 } } }] }
  await vue.nextTick()
  assert.equal(state.value.value.components[0].componentProps.gridItem.h, 48)
  assert.equal(state.value.value.components[0].componentProps.gridItem.y, 5)
  input.value = initial()
  await vue.nextTick()
  assert.equal(state.value.value.components[0].componentProps.gridItem.h, 20)
})

test('canvas keeps the default renderer and custom slot alive when only layout changes', async () => {
  for (const custom of [false, true]) {
    const counts = { mounts: 0, disposals: 0 }
    const Consumer = vue.defineComponent({ setup() { counts.mounts++; vue.onScopeDispose(() => counts.disposals++); return () => vue.h('live-widget') } })
    const Grid = vue.defineComponent({ props: ['widgets'], setup: (props, { slots }) => () => vue.h('grid', props.widgets.map(widget => slots.default({ id: widget.id }))) })
    const asModule = component => ({ default: component, __esModule: true })
    const Canvas = createDashboardLoader({
      'vue-i18n': { useI18n: () => ({ t: key => key }) },
      'ant-design-vue': {}, '@ant-design/icons-vue': {},
      './components/GridCanvas.vue': asModule(Grid),
      './components/WidgetFrame.vue': asModule(passthrough('frame')),
      './components/WidgetRenderer.vue': asModule(Consumer),
    })('components/DashBoardCanvas/DashBoardCanvas.vue').default
    const documentBefore = globalThis.document
    globalThis.document = { addEventListener() {}, removeEventListener() {} }
    const renderer = vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
    const model = vue.ref(initial()), catalog = { groups: [], components: { resources: { component: Consumer, configs: [], defaultConfig: {} } } }
    const app = renderer.createApp({ setup: () => () => vue.h(Canvas, { modelValue: model.value, catalog, editable: false, layoutEditable: true }, custom ? { widget: () => vue.h(Consumer) } : {}) })
    try {
      app.mount({})
      assert.equal(counts.mounts, 1)
      model.value.components[0].componentProps.gridItem.y = 5
      await vue.nextTick()
      assert.equal(counts.mounts, 1)
      assert.equal(counts.disposals, 0)
    } finally { app.unmount(); if (documentBefore === undefined) delete globalThis.document; else globalThis.document = documentBefore }
    assert.equal(counts.disposals, 1)
  }
})
