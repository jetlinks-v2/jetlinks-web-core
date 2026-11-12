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
