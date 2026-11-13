import assert from 'node:assert/strict'
import test from 'node:test'
import { h, ref } from 'vue'
import { createMetricLoader, createMetricRenderer, flush } from './helpers/metricRuntime.mjs'

test('function catalogs belong to the caller loader and coalesce initial and locale requests', async () => {
  const locale = ref('en')
  const { useExpressionFunctions } = createMetricLoader({ 'vue-i18n': { useI18n: () => ({ locale }) } })('components/Expression/useExpressionFunctions.ts')
  const pending = [], calls = []
  const loader = () => { calls.push(locale.value); return new Promise(resolve => pending.push(resolve)) }
  let first, second, other
  const { renderer, root } = createMetricRenderer()
  const app = renderer.createApp({ setup() {
    first = useExpressionFunctions(loader)
    second = useExpressionFunctions(loader)
    other = useExpressionFunctions(async () => [{ id: 'other' }])
    return () => h('div')
  } })
  app.mount(root)
  try {
    assert.deepEqual(calls, ['en'])
    locale.value = 'zh'; await flush()
    pending.shift()([{ id: 'old-en' }]); await flush()
    assert.deepEqual(first.functions.value, [], 'a stale locale never replaces the current catalog')
    assert.deepEqual(calls, ['en', 'zh'], 'both consumers share one locale reload')
    pending.shift()([{ id: 'new-zh' }]); await flush()
    assert.equal(first.functions.value[0].id, 'new-zh')
    assert.equal(second.functions.value, first.functions.value)
    assert.equal(other.functions.value[0].id, 'other')
  } finally { app.unmount() }
})

test('a failed caller loader can retry without a component or transport replacement', async () => {
  const locale = ref('en')
  const { useExpressionFunctions } = createMetricLoader({ 'vue-i18n': { useI18n: () => ({ locale }) } })('components/Expression/useExpressionFunctions.ts')
  let failed = true, catalog
  const { renderer, root } = createMetricRenderer()
  const app = renderer.createApp({ setup() {
    catalog = useExpressionFunctions(async () => { if (failed) throw Error('offline'); return [{ id: 'ready' }] })
    return () => h('div')
  } })
  app.mount(root)
  try {
    await flush(); assert.equal(catalog.error.value, true)
    failed = false; await catalog.refresh()
    assert.equal(catalog.error.value, false); assert.equal(catalog.functions.value[0].id, 'ready')
  } finally { app.unmount() }
})

test('catalog failure shows retry instead of a misleading empty search', async () => {
  const { passthrough, textContent, walk } = await import('./helpers/metricRuntime.mjs')
  const { defineComponent } = await import('vue')
  const { default: Menu } = createMetricLoader({ 'vue-i18n': { useI18n: () => ({ t: key => key }) } })('components/Expression/ExpressionFunctionMenu.vue')
  const failed = ref(true), retries = []
  const { renderer, root } = createMetricRenderer()
  const app = renderer.createApp({ render: () => h(Menu, { functions: [], error: failed.value, onRetry: () => retries.push(true) }, { error: () => 'Retry catalog' }) })
  for (const name of ['a-menu', 'a-menu-item-group', 'a-input']) app.component(name, passthrough(name))
  app.component('AIcon', passthrough('icon'))
  app.component('a-menu-item', defineComponent({ setup: (_props, { slots, attrs }) => () => h('button', attrs, slots.default?.()) }))
  app.mount(root)
  try {
    assert.match(textContent(root), /Retry catalog/)
    assert.doesNotMatch(textContent(root), /empty/)
    walk(root, node => node.type === 'button')[0].props.onClick({ stopPropagation() {} })
    assert.equal(retries.length, 1)
    failed.value = false; await flush()
    assert.match(textContent(root), /empty/)
    assert.doesNotMatch(textContent(root), /Retry catalog/)
  } finally { app.unmount() }
})
