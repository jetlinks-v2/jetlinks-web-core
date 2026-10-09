import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

const root = resolve(import.meta.dirname, '../src/components/ConditionFilter')
const require = createRequire(import.meta.url)
let nextKey = 0
const dependencies = {
  'vue-i18n': { useI18n: () => ({ t: key => key }) },
  '@jetlinks-web/utils': { randomString: () => `key-${++nextKey}` },
  '@jetlinks-web/core': { request: { get: () => { throw new Error('Unexpected remote request') } } },
  '@jetlinks-web-core/locales': { default: { global: { t: key => key, te: () => false } } },
}

// Run the real SFC setup and local query transforms with Vue's reactive scheduler.
// Only rendering, i18n and network boundaries are replaced; input handlers stay real.
const loadComponent = (name) => {
  const cache = new Map()
  const load = (filename, component = false) => {
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    let source = readFileSync(filename, 'utf8')
    if (component) source = compileScript(parse(source, { filename }).descriptor, { id: name }).content
    const { code } = transformSync(source, { loader: 'ts', format: 'cjs' })
    const imports = id => {
      if (Object.hasOwn(dependencies, id)) return dependencies[id]
      if (id.endsWith('.vue')) return {}
      if (id.startsWith('.')) return load(resolve(dirname(filename), `${id}.ts`))
      return require(id)
    }
    new Function('require', 'module', 'exports', ...Object.keys(vue), code)(imports, module, module.exports, ...Object.values(vue))
    return module.exports
  }
  const component = load(resolve(root, name), true).default
  component.render = () => null
  return component
}

const renderer = vue.createRenderer({
  createElement: tag => ({ tag, children: [] }),
  createText: text => ({ text }), createComment: text => ({ text }),
  insert: (child, parent) => parent.children.push(child), remove: () => {},
  setText: () => {}, setElementText: () => {}, patchProp: () => {},
  parentNode: () => null, nextSibling: () => null,
})

const fields = [
  { title: 'Time', dataIndex: 'requestTime', search: { type: 'date', rename: 'timestamp', defaultTermType: 'btw', defaultValue: [1000, 2000] } },
  { title: 'URL', dataIndex: 'url', search: { type: 'string' } },
  { title: 'Count', dataIndex: 'count', search: { type: 'number' } },
  { title: 'Status', dataIndex: 'status', search: { type: 'select', options: [{ label: 'OK', value: 0 }] } },
]

const mountFilter = () => {
  const timers = new Map()
  let timerKey = 0
  const previousWindow = globalThis.window
  const previousDocument = globalThis.document
  globalThis.window = {
    setTimeout: (fn, delay) => { const id = ++timerKey; timers.set(id, { fn, delay }); return id },
    clearTimeout: id => timers.delete(id),
  }
  globalThis.document = { activeElement: null }
  const changes = []
  const models = []
  const props = vue.reactive({ fields, modelValue: [] })
  const component = loadComponent('ConditionFilter.vue')
  const app = renderer.createApp({
    setup: () => () => vue.h(component, {
      ...props,
      'onUpdate:modelValue': value => { models.push(value); props.modelValue = value },
      onChange: value => changes.push(value),
    }),
  })
  app.mount({ children: [] })
  const instance = app._instance.subTree.component
  let stopped = false
  return {
    props, changes, models, timers, state: instance.setupState, api: instance.exposed,
    drain: () => { const tasks = [...timers.values()]; timers.clear(); tasks.forEach(task => task.fn()) },
    stop: () => {
      if (stopped) return
      stopped = true
      app.unmount()
      globalThis.window = previousWindow
      globalThis.document = previousDocument
    },
  }
}

const url = value => ({ column: 'url', termType: 'eq', value, type: 'and' })

test('initial defaults are mirrored before the first external append and confirmed changes have no timer', async () => {
  const h = mountFilter()
  try {
    assert.equal(h.models[0][0].column, 'requestTime')
    assert.deepEqual(h.models[0][0].value, [1000, 2000])
    await vue.nextTick()
    h.props.modelValue = [...h.props.modelValue, url('/first')]
    await vue.nextTick()
    assert.equal(h.changes.length, 1)
    assert.deepEqual(h.changes[0].filter.terms, [
      { column: 'timestamp', termType: 'btw', value: [1000, 2000] }, url('/first'),
    ])
    assert.equal(h.timers.size, 0)
    h.props.modelValue = [...h.props.modelValue]
    await vue.nextTick()
    assert.equal(h.changes.length, 1)
  } finally { h.stop() }
})

test('same-turn external changes coalesce, incomplete edits stay quiet and manual refresh remains repeatable', async () => {
  const h = mountFilter()
  try {
    await vue.nextTick()
    h.api.setTerms([...h.props.modelValue, url('/old')])
    h.api.setTerms([...h.props.modelValue, url('/latest')])
    await vue.nextTick()
    assert.equal(h.changes.length, 1)
    assert.equal(h.changes[0].terms.at(-1).value, '/latest')
    h.api.setTerms([...h.props.modelValue, { column: 'count', termType: 'eq' }])
    await vue.nextTick()
    assert.equal(h.changes.length, 1)
    h.state.triggerSearch()
    h.state.triggerSearch()
    assert.equal(h.changes.length, 3)
    assert.equal(h.timers.size, 0)
  } finally { h.stop() }
})

test('continuous numeric inputs debounce; a confirmed append cancels the timer and uses the latest full model', async () => {
  const h = mountFilter()
  try {
    await vue.nextTick()
    h.api.setTerms([...h.props.modelValue, { column: 'count', termType: 'eq', value: 1 }])
    await vue.nextTick()
    h.changes.length = 0
    const term = h.state.termsModel.find(item => item.column === 'count')
    h.state.onApplyPanelValue(term.key, { ...term, value: 12 }, { close: false, source: 'input' })
    await vue.nextTick()
    h.state.onApplyPanelValue(term.key, { ...term, value: 123 }, { close: false, source: 'input' })
    await vue.nextTick()
    assert.equal(h.changes.length, 0)
    assert.equal(h.timers.size, 1)
    assert.equal([...h.timers.values()][0].delay, 260)
    h.props.modelValue = [...h.props.modelValue, url('/confirmed')]
    await vue.nextTick()
    assert.equal(h.changes.length, 1)
    assert.equal(h.changes[0].terms.find(item => item.column === 'count').value, 123)
    assert.equal(h.changes[0].terms.at(-1).value, '/confirmed')
    assert.equal(h.timers.size, 0)
    h.drain()
    assert.equal(h.changes.length, 1)
  } finally { h.stop() }
})

test('Enter and closing the input panel flush once; an expired input timer also commits only once', async () => {
  const h = mountFilter()
  try {
    await vue.nextTick()
    h.api.setTerms([{ column: 'count', termType: 'eq', value: 0 }])
    await vue.nextTick()
    h.changes.length = 0
    const term = h.state.termsModel[0]
    h.state.onApplyPanelValue(term.key, { ...term, value: 2 }, { close: false, source: 'input' })
    await vue.nextTick()
    h.state.onApplyPanelValue(term.key, { ...term, value: 2 })
    await vue.nextTick()
    assert.equal(h.changes.length, 1)
    assert.equal(h.timers.size, 0)
    h.state.onApplyPanelValue(term.key, { ...term, value: 3 }, { close: false, source: 'input' })
    await vue.nextTick()
    h.state.onValuePanelOpenChange(term.key, false)
    await vue.nextTick()
    assert.equal(h.changes.length, 2)
    assert.equal(h.timers.size, 0)
    h.state.onApplyPanelValue(term.key, { ...term, value: 4 }, { close: false, source: 'input' })
    await vue.nextTick()
    h.drain()
    assert.equal(h.changes.length, 3)
    assert.equal(h.changes.at(-1).terms[0].value, 4)
  } finally { h.stop() }
})

test('deletion cancels input work, zero and nullary selections query immediately, unmount clears timers', async () => {
  const h = mountFilter()
  try {
    await vue.nextTick()
    h.api.setTerms([{ column: 'count', termType: 'eq', value: 0 }])
    await vue.nextTick()
    const term = h.state.termsModel[0]
    h.state.onApplyPanelValue(term.key, { ...term, value: 10 }, { close: false, source: 'input' })
    await vue.nextTick()
    h.state.onRemoveTerm(term.key)
    await vue.nextTick()
    assert.equal(h.timers.size, 0)
    assert.deepEqual(h.changes.at(-1).terms, [])
    h.api.setTerms([{ column: 'status', termType: 'eq', value: 0 }, { column: 'url', termType: 'isnull', type: 'and' }])
    await vue.nextTick()
    assert.equal(h.changes.at(-1).terms[0].value, 0)
    assert.equal(h.changes.at(-1).terms[1].termType, 'isnull')
    assert.equal(h.timers.size, 0)
    h.api.setTerms([{ column: 'count', termType: 'eq', value: 1 }])
    await vue.nextTick()
    const pending = h.state.termsModel[0]
    h.state.onApplyPanelValue(pending.key, { ...pending, value: 2 }, { close: false, source: 'input' })
    await vue.nextTick()
    assert.equal(h.timers.size, 1)
    h.stop()
    assert.equal(h.timers.size, 0)
  } finally { h.stop() }
})

test('confirmation in the same turn as input is immediate even before a debounce timer exists', async () => {
  const h = mountFilter()
  try {
    await vue.nextTick()
    h.api.setTerms([{ column: 'count', termType: 'eq', value: 1 }])
    await vue.nextTick()
    h.changes.length = 0
    const term = h.state.termsModel[0]
    h.state.onApplyPanelValue(term.key, { ...term, value: 12 }, { close: false, source: 'input' })
    h.state.onApplyPanelValue(term.key, { ...term, value: 12 })
    await vue.nextTick()
    assert.equal(h.changes.length, 1)
    assert.equal(h.timers.size, 0)
    h.state.onApplyPanelValue(term.key, { ...term, value: 123 }, { close: false, source: 'input' })
    h.state.onValuePanelOpenChange(term.key, false)
    await vue.nextTick()
    assert.equal(h.changes.length, 2)
    assert.equal(h.timers.size, 0)
    h.state.onApplyPanelValue(term.key, { ...term, value: 1234 }, { close: false, source: 'input' })
    await vue.nextTick()
    assert.equal(h.timers.size, 1)
    assert.equal(h.changes.length, 2)
  } finally { h.stop() }
})

test('inline text stays a draft until confirmation and composition Enter does not submit', async () => {
  const h = mountFilter()
  try {
    await vue.nextTick()
    h.api.setTerms([{ column: 'url', termType: 'eq', value: '/old' }])
    await vue.nextTick()
    h.changes.length = 0
    h.state.startValueEdit(h.state.termsModel[0].key)
    h.state.onValueInput({ target: { value: '/中文' } })
    h.state.onValueKeydown({ key: 'Enter', isComposing: true })
    await vue.nextTick()
    assert.equal(h.changes.length, 0)
    h.state.onValueKeydown({ key: 'Enter', isComposing: false, preventDefault: () => {} })
    await vue.nextTick()
    assert.equal(h.changes.length, 1)
    assert.equal(h.changes[0].terms[0].value, '/中文')
    assert.equal(h.timers.size, 0)
  } finally { h.stop() }
})

test('value panel marks continuous edits as input and leaves date/option selection to their own commit handlers', async () => {
  const component = loadComponent('ConditionEditorPanel.vue')
  const applies = []
  const props = vue.reactive({ column: 'count', term: { column: 'count', termType: 'eq', value: 1 } })
  const app = renderer.createApp({
    setup() {
      vue.provide('columnsMapKey', Object.fromEntries(fields.map(field => [field.dataIndex, field])))
      vue.provide('useColumnItemOptionsKey', {})
      return () => vue.h(component, { ...props, onApply: (value, options) => applies.push({ value, options }) })
    },
  })
  app.mount({ children: [] })
  const state = app._instance.subTree.component.setupState
  try {
    state.onValueItemUpdate(12)
    assert.equal(applies.at(-1).options.source, 'input')
    state.onConfirmKeydown({ key: 'Enter', isComposing: true })
    assert.equal(applies.length, 1)
    state.onConfirmKeydown({ key: 'Enter', isComposing: false })
    assert.equal(applies.length, 2)
    assert.equal(applies.at(-1).options, undefined)
    props.column = 'requestTime'
    props.term = { column: 'requestTime', termType: 'btw', value: [1000, 2000] }
    await vue.nextTick()
    state.onValueItemUpdate([3000, 4000])
    assert.equal(applies.at(-1).options.source, 'commit')
    const count = applies.length
    state.onConfirmKeydown({ key: 'Enter', isComposing: false })
    assert.equal(applies.length, count)
    props.column = 'status'
    props.term = { column: 'status', termType: 'eq', value: 0 }
    await vue.nextTick()
    state.onSubmit({ close: false })
    assert.equal(applies.at(-1).value.value, 0)
    assert.notEqual(applies.at(-1).options.source, 'input')
  } finally { app.unmount() }
})

test('manual search confirms an active text draft without a second automatic request', async () => {
  const h = mountFilter()
  try {
    await vue.nextTick()
    h.api.setTerms([{ column: 'url', termType: 'eq', value: '/old' }])
    await vue.nextTick()
    h.changes.length = 0
    h.state.startValueEdit(h.state.termsModel[0].key)
    h.state.onValueInput({ target: { value: '/submitted' } })
    h.state.triggerSearch()
    await vue.nextTick()
    assert.equal(h.changes.length, 1)
    assert.equal(h.changes[0].terms[0].value, '/submitted')
    assert.equal(h.timers.size, 0)
  } finally { h.stop() }
})
