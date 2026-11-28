import assert from 'node:assert/strict'
import test from 'node:test'
import { defineComponent, h, ref, shallowRef } from 'vue'
import { fileURLToPath } from 'node:url'
import { createDashboardLoader, passthrough } from './helpers/dashboardRuntime.mjs'
import { createComponentRenderer, flush, walk } from './helpers/componentRuntime.mjs'

const member = { ref: { type: 'target', providerId: 'metrics', kind: 'query', id: 'aggregate' }, metadata: { output: { type: 'object' } } }
function harness(t, query) {
  const fallbacks = [], received = []
  const stubs = {
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    './ObjectDataView.vue': { __esModule: true, default: defineComponent({ props: ['value', 'state', 'metadata'], setup: props => () => { fallbacks.push({ ...props }); return h('span', 'generic') } }) },
    '../RuntimeDiagnostics': {},
    '../../object-capability/useObjectDataQuery': { useObjectDataQuery: () => ({
      access: ref(), analysis: ref(), input: ref({}), busy: ref(false), failed: ref(false), result: ref(query), charts: ref([])
    }) }
  }
  const load = createDashboardLoader(stubs)
  stubs['@jetlinks-web-core/components/ObjectOverview'] = { ObjectDataView: stubs['./ObjectDataView.vue'].default }
  stubs['./ObjectMemberValue.vue'] = { __esModule: true, default: load('components/ObjectOverview/ObjectMemberValue.vue').default }
  const Presenter = defineComponent({ props: ['value', 'member'], setup: props => () => { received.push(props.value); return h('span', 'business') } })
  const mount = (name, props) => {
    const view = createComponentRenderer(), Component = load(`components/ObjectOverview/${name}.vue`).default
    const app = view.renderer.createApp({ setup: () => () => h(Component, props()) })
    for (const name of ['a-button', 'a-tooltip', 'a-form', 'a-form-item', 'a-alert', 'a-spin', 'a-empty']) app.component(name, passthrough(name))
    app.mount(view.root); t.after(() => app.unmount())
    return view
  }
  return { mount, Presenter, received, fallbacks, load }
}

test('current and related values share the raw presenter contract; hosts retain limits and read failures', async t => {
  const harnessed = harness(t), raw = { groups: [], availability: 'ready', from: 1, to: 2, interval: 1 }
  const entry = shallowRef({ member, presentation: { component: harnessed.Presenter }, state: { status: 'ready', value: [raw] } })
  const view = harnessed.mount('ObjectContentValue', () => ({ entry: entry.value }))
  assert.deepEqual(harnessed.received.at(-1), raw)
  entry.value = { ...entry.value, related: true, state: { status: 'ready', value: { values: [{ object: { type: 'target', id: 'A' }, value: [raw] }], limited: true } } }
  await flush()
  assert.deepEqual(harnessed.received.at(-1), raw)
  assert.ok(walk(view.root, node => node.text === 'limited').length)
  const before = harnessed.received.length
  entry.value = { ...entry.value, state: { status: 'failed' } }
  await flush()
  assert.equal(harnessed.received.length, before)
  assert.equal(harnessed.fallbacks.at(-1).state, 'failed')
})

test('query explorer keeps an array as one semantic value for each target', t => {
  const raw = [{ metadata: { id: 'temperature' }, value: 20 }, { metadata: { id: 'pressure' }, value: 3 }]
  const harnessed = harness(t, { values: [{ object: { type: 'target', id: 'A' }, value: [raw] }], limited: false })
  harnessed.mount('ObjectDataExplorer', () => ({ entry: { member, presentation: { component: harnessed.Presenter } }, runtime: () => undefined }))
  assert.equal(harnessed.received.length, 1)
  assert.deepEqual(harnessed.received[0], raw)
})

test('a failed business renderer falls back to the original value and recovers when the component changes', async t => {
  const harnessed = harness(t), raw = { total: 7 }
  const presentation = shallowRef({ component: defineComponent({ setup: () => () => { throw Error('broken renderer') } }) })
  const view = harnessed.mount('ObjectMemberValue', () => ({ member, value: raw, presentation: presentation.value }))
  await flush()
  assert.deepEqual(harnessed.fallbacks.at(-1).value, raw)
  assert.ok(walk(view.root, node => node.text === 'unavailable').length)
  presentation.value = { component: harnessed.Presenter }
  await flush()
  assert.deepEqual(harnessed.received.at(-1), raw)
  assert.equal(walk(view.root, node => node.text === 'unavailable').length, 0)
})

test('missing values remain generic and never reach a business renderer', t => {
  const harnessed = harness(t)
  harnessed.mount('ObjectMemberValue', () => ({ member, value: null, presentation: { component: harnessed.Presenter } }))
  assert.equal(harnessed.received.length, 0)
  assert.equal(harnessed.fallbacks.at(-1).value, null)
})

test('property arrays stay whole while a query stream sends each emitted output to the renderer', t => {
  const harnessed = harness(t), raw = [{ value: 0 }, { value: false }]
  harnessed.mount('ObjectMemberValue', () => ({ member: { ...member, ref: { ...member.ref, kind: 'property' } }, value: raw, presentation: { component: harnessed.Presenter } }))
  assert.deepEqual(harnessed.received, [raw])
  harnessed.mount('ObjectMemberValue', () => ({ member, value: raw, presentation: { component: harnessed.Presenter } }))
  assert.deepEqual(harnessed.received.slice(1), raw)
})

test('real metric and device renderers consume their original emitted outputs through the common host', t => {
  const harnessed = harness(t)
  const Metric = harnessed.load(fileURLToPath(new URL('../../modules/rule-engine-manager-ui/components/Metric/ObjectAggregateResult.vue', import.meta.url))).default
  const Snapshot = harnessed.load(fileURLToPath(new URL('../../modules/device-manager-ui/components/ObjectPropertySnapshots.vue', import.meta.url))).default
  const metric = harnessed.mount('ObjectMemberValue', () => ({ member, value: [{ groups: [], availability: 'ready', from: 1, to: 2, interval: 1 }], presentation: { component: Metric } }))
  assert.equal(walk(metric.root, node => node.props.description === 'aggregateEmpty').length, 1)
  const snapshot = { metadata: { id: 'temperature', name: 'Temperature', valueType: { type: 'double', unit: '℃' } }, value: 0 }
  const device = harnessed.mount('ObjectMemberValue', () => ({ member, value: [snapshot], presentation: { component: Snapshot } }))
  assert.ok(walk(device.root, node => node.text === 'Temperature').length)
  assert.equal(harnessed.fallbacks.at(-1).value, 0)
  assert.equal(harnessed.fallbacks.at(-1).metadata.unit, '℃')
})
