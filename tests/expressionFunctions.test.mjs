import assert from 'node:assert/strict'
import test from 'node:test'
import { h, reactive, ref } from 'vue'
import { createMetricLoader, createMetricRenderer, flush } from './helpers/metricRuntime.mjs'

test('shared candidates filter names, identifiers and descriptions, preserving groups and disabled choices', () => {
  const { useExpressionCandidateMenu } = createMetricLoader()('components/Expression/useExpressionCandidateMenu.ts')
  const props = reactive({groups:[{id:'readings',label:'Inputs',items:[{id:'timestamp',name:'采集时间',description:'设备采集时刻',disabled:true},{id:'value',name:'当前值',description:'当前处理节点的数值'}]},{id:'functions',items:[{id:'math.abs',name:'绝对值'}]}]})
  const menu = useExpressionCandidateMenu(props)
  assert.equal(menu.first.value.id,'value','disabled options are not inserted by Enter')
  menu.query.value='设备采集'
  assert.deepEqual(menu.groups.value.map(group=>group.id),['readings'])
  assert.equal(menu.first.value,undefined)
  menu.query.value=' MATH.ABS '
  assert.equal(menu.first.value.id,'math.abs')
  menu.query.value='不存在'
  assert.equal(menu.groups.value.length,0)
  props.groups=[{id:'states',items:[{id:0,name:'不存在',description:'枚举状态'}]}]
  assert.equal(menu.first.value.id,0,'a changed catalog reuses the same filtering behavior')
})

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
  const { default: Menu } = createMetricLoader({ 'vue-i18n': { useI18n: () => ({ t: key => key }) } })('components/Expression/ExpressionCandidateMenu.vue')
  const failed = ref(true), retries = []
  const { renderer, root } = createMetricRenderer()
  const app = renderer.createApp({ render: () => h(Menu, { groups: [], placeholder: 'Search functions', emptyText: 'empty', error: failed.value, onRetry: () => retries.push(true) }, { error: () => 'Retry catalog' }) })
  for (const name of ['a-menu', 'a-menu-item-group']) app.component(name, passthrough(name))
  const focusOptions=[]
  app.component('a-input',defineComponent({setup(_props,{expose}) {expose({focus(options){focusOptions.push(options)}});return()=>h('input')}}))
  app.component('AIcon', passthrough('icon'))
  app.component('a-menu-item', defineComponent({ setup: (_props, { slots, attrs }) => () => h('button', attrs, slots.default?.()) }))
  app.mount(root)
  try {
    assert.deepEqual(focusOptions,[{preventScroll:true}],'opening search does not scroll the host page')
    assert.match(textContent(root), /Retry catalog/)
    assert.doesNotMatch(textContent(root), /empty/)
    walk(root, node => node.type === 'button')[0].props.onClick({ stopPropagation() {} })
    assert.equal(retries.length, 1)
    failed.value = false; await flush()
    assert.match(textContent(root), /empty/)
    assert.doesNotMatch(textContent(root), /Retry catalog/)
  } finally { app.unmount() }
})
