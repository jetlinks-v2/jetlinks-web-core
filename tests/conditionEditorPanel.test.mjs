import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import { effectScope, nextTick, reactive } from 'vue'

const require = createRequire(import.meta.url)

// Run production validation with Vue reactivity; only the injected field registry is replaced.
function load(relative, dependencies = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  new Function('exports', 'require', output)(exports, id => dependencies[id] ?? require(id))
  return exports
}

const setting = load('../src/components/Search/Filter/setting.ts', {
  '@jetlinks-web-core/locales': { global: { t: key => key } },
})
const schema = load('../src/components/ConditionFilter/schema.ts', { '../Search/Filter/setting': setting })

function panel(t, { type = 'string', termType = 'in', value, search = {} } = {}) {
  const columns = reactive({ foo: { dataIndex: 'foo', title: 'Foo', search: { type, ...search } } })
  const options = reactive({})
  const props = reactive({ column: 'foo', term: { column: 'foo', termType, value } })
  const events = []
  const { useConditionEditorPanel } = load('../src/components/ConditionFilter/useConditionEditorPanel.ts', {
    './schema': schema,
    '../Search/Filter/hooks/useSearchEngine': {
      useColumnsMap: () => columns,
      useColumnItemOptions: () => options,
    },
  })
  const scope = effectScope()
  const state = scope.run(() => useConditionEditorPanel(props, (term, config) => events.push({ term, config })))
  t.after(() => scope.stop())
  return { state, props, events, columns, options }
}

for (const termType of ['in', 'nin']) {
  test(`${termType}: text membership edits submit arrays without mutating saved or input values`, t => {
    const saved = ['121']
    const { state, events } = panel(t, { termType, value: saved })
    assert.deepEqual(state.textValues.value, ['121'])
    assert.equal(events.length, 0)
    const values = ['3333', '4444', 'a,b']
    state.onValueItemUpdate(values)
    assert.deepEqual(events, [{ term: { column: 'foo', termType, value: values }, config: { close: false, source: 'input' } }])
    values.push('not committed')
    assert.deepEqual(events[0].term.value, ['3333', '4444', 'a,b'])
    assert.deepEqual(saved, ['121'])
    events[0].term.value.push('consumer mutation')
    assert.deepEqual(state.textValues.value, ['3333', '4444', 'a,b'])
  })

  test(`${termType}: removing the final tag explicitly clears the old condition and permits new values`, t => {
    const { state, events } = panel(t, { termType, value: ['121', '3333'] })
    state.onValueItemUpdate(['3333'])
    state.onValueItemUpdate([])
    assert.deepEqual(events[0].term.value, ['3333'])
    assert.deepEqual(events[1], {
      term: { column: 'foo', termType, value: [] }, config: { close: false, source: 'input', allowEmpty: true },
    })
    assert.equal(state.canApply.value, false)
    state.onValueItemUpdate(['replacement'])
    assert.deepEqual(events[2].term.value, ['replacement'])
  })
}

test('legacy single text values display without writing until a user edits; reopen displays committed values', async t => {
  const { state, props, events } = panel(t, { value: 'legacy' })
  assert.deepEqual(state.textValues.value, ['legacy'])
  assert.equal(events.length, 0)
  state.onValueItemUpdate(['replacement'])
  props.term = events[0].term
  await nextTick()
  const reopened = panel(t, { value: props.term.value })
  assert.deepEqual(reopened.state.textValues.value, ['replacement'])
  assert.equal(reopened.events.length, 0)
})

test('text membership does not submit a scalar or invalid element types', t => {
  const { state, events } = panel(t, { value: ['121'] })
  for (const value of ['3333', undefined, null, [3333], ['3333', null]]) state.onValueItemUpdate(value)
  assert.equal(events.length, 0)
  assert.deepEqual(state.textValues.value, ['121'])
})

test('field and operator changes restore the corresponding draft and editor', async t => {
  const { state, props, events, columns } = panel(t, { value: ['121'] })
  props.term = { column: 'foo', termType: 'eq', value: '121' }
  await nextTick()
  assert.equal(state.isTextMembershipMode.value, false)
  state.onValueItemUpdate('3333')
  assert.equal(events[0].term.value, '3333')
  props.term = { column: 'foo', termType: 'nin', value: ['3333'] }
  await nextTick()
  assert.equal(state.isTextMembershipMode.value, true)
  assert.deepEqual(state.textValues.value, ['3333'])
  columns.bar = { dataIndex: 'bar', title: 'Bar', search: { type: 'number' } }
  props.column = 'bar'
  props.term = { column: 'bar', termType: 'eq', value: 0 }
  await nextTick()
  assert.equal(state.isTextMembershipMode.value, false)
  assert.equal(state.draftValue.value, 0)
})

test('ordinary text operators still submit scalars', t => {
  for (const termType of ['eq', 'not', 'like', 'nlike']) {
    const { state, events } = panel(t, { termType, value: '121' })
    assert.equal(state.isTextMembershipMode.value, false)
    state.onValueItemUpdate('3333')
    assert.equal(events[0].term.value, '3333')
    assert.deepEqual(events[0].config, { close: false, source: 'input' })
  }
})

test('enum, tree and remote options retain their selection panel and loaded options', t => {
  for (const type of ['select', 'tree', 'treeSelect', 'string']) {
    const search = type === 'string' ? { optionPanel: { loadOptions: async () => [] } } : {}
    const { state, events, options } = panel(t, { type, value: ['saved'], search })
    assert.equal(state.isOptionPanelMode.value, true)
    assert.equal(state.resolvedOptionPanelConfig.value.multiple, true)
    options.foo = [{ label: 'Saved', value: 'saved' }]
    assert.deepEqual(state.optionPanelOptions.value, options.foo)
    state.setDraftValue(['other'])
    state.onSubmit({ close: false })
    assert.deepEqual(events[0].term.value, ['other'])
    state.setDraftValue([])
    state.onSubmit({ close: false, allowEmpty: true })
    assert.deepEqual(events[1].term.value, [])
  }
})

test('zero, false, numeric membership and custom array operators retain their value types', t => {
  for (const [type, termType, value, search] of [
    ['number', 'eq', 0], ['select', 'eq', false], ['select', 'in', [false]],
    ['number', 'in', [0, 12]], ['number', 'custom', [0, 12], { isBtw: ['custom'] }],
  ]) {
    const { state, events } = panel(t, { type, termType, search })
    state.onValueItemUpdate(value)
    assert.deepEqual(events[0].term.value, value)
  }
})

test('ranges reject unfinished bounds and retain zero and date values', t => {
  for (const type of ['number', 'date']) {
    for (const termType of ['btw', 'nbtw']) {
      const { state, events } = panel(t, { type, termType })
      state.onValueItemUpdate([0, undefined])
      assert.equal(events.length, 0)
      state.onValueItemUpdate([0, 12])
      assert.deepEqual(events[0].term.value, [0, 12])
      assert.equal(events[0].config.close, type === 'date')
      assert.equal(events[0].config.source, type === 'date' ? 'commit' : 'input')
    }
  }
})

test('panel initializes array defaults without applying incomplete conditions', t => {
  const { state, events } = panel(t)
  assert.deepEqual(state.textValues.value, [])
  assert.equal(state.canApply.value, false)
  state.onSubmit()
  assert.equal(events.length, 0)
})
