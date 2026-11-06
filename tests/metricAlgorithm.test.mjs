import assert from 'node:assert/strict'
import test from 'node:test'
import { defineComponent, effectScope, h, reactive, ref } from 'vue'
import { resolve } from 'node:path'
import { createMetricLoader, createMetricRenderer, flush, walk, textContent, sourceRoot } from './helpers/metricRuntime.mjs'

const load = createMetricLoader({ '@jetlinks-web/core': { request: {} }, [resolve(sourceRoot,'utils/ndjson.ts')]: { createRuntimeNdJson:()=>({}) }, 'vue-i18n': { useI18n: () => ({ t: (key, values) => values?.name ? `${key} · ${values.name}` : key, locale:{ value:'zh' } }) } })
const { algorithmSuggestions, bindAlgorithmInput, calculatorKey, chooseAlgorithm, findCalculator, interactiveCalculator } = load('components/Metric/template/algorithm.ts')
const { calculatorIcon, calculatorOption } = load('components/Metric/template/calculatorPresentation.ts')
const { metricMessages } = load('components/Metric/messages.ts')
const { ruleFormulaReferences, expressionToFormula, formulaToExpression } = load('components/Metric/template/formula.ts')
const Editor = load('components/Metric/template/TemplateAlgorithmEditor.vue').default
const { useMetricTemplates } = load('components/Metric/template/useMetricTemplates.ts')
const state = {
  id: 'duration', name: 'State duration', inputNames: { state: 'State' },
  configuration: { provider: 'state', providerVersion: '1', inputTypes: { state: { type: 'array', elementType: { type: 'int' } } },
    outputType: { type: 'object', properties: [{ id: 'activeDuration', name: 'Runtime', valueType: { type: 'double', unit: 's' } }] },
    parameters: { duration: 'PT1H', maxHold: 'PT20M', activeValue: 1, inactiveValue: 0 } },
  parameterDefinitions: [
    { id: 'duration', name: 'Duration', valueType: { type: 'string' }, expands: { editor: 'duration' } },
    { id: 'maxHold', name: 'Validity', valueType: { type: 'string' }, expands: { editor: 'duration' } },
    { id: 'activeValue', name: 'Active', valueType: { type: 'int' }, expands: { typeFromInput: 'state' } },
    { id: 'inactiveValue', name: 'Inactive', valueType: { type: 'int' }, expands: { typeFromInput: 'state' } },
  ],
}
const meter = { id: 'increase', name: 'Counter increase', inputNames: { reading: 'Reading' },
  configuration: { provider: 'measurement', providerVersion: '1', inputTypes: { reading: { type: 'array', elementType: { type: 'double' } } },
    outputType: { type: 'double' }, parameters: { operation: 'increase', negativeDelta: 'reject' } },
  parameterDefinitions: [{ id: 'negativeDelta', name: 'Decrease', valueType: { type: 'enum', elements: [{ value: 'reject', text: 'Reject' }, { value: 'rollover', text: 'Rollover' }] } }],
}
const clone = value => JSON.parse(JSON.stringify(value))
function fixture() {
  const calculator = { ...clone(state.configuration), custom: false, parameters: { ...state.configuration.parameters, extra: 0 } }
  const rule = { id: 'statistics', inputs: [{ id: 'state', metricId: 'operating', presence: 'required' }], calculator }
  const template = { id: 'runtime', version: '1', name: 'Runtime', parameters: {}, parameterDefinitions: [], outputs: [],
    inputDefinitions: [{ id: 'operating', name: 'Operating', valueType: { type: 'int' }, source: { lookback: 'PT2H', maxPoints: 256 } },
      { id: 'online', name: 'Online', valueType: { type: 'boolean' } }], definitions: [rule] }
  return { rule, template }
}
function mount(extra = {}) {
  const { renderer, root } = createMetricRenderer()
  const { rule, template } = fixture()
  const invalid = [], patches = []
  const props = reactive({ rule, template, calculators: clone([state, meter]), disabled: false,
    onPatch: fields => { patches.push(fields); Object.assign(props.rule, fields) }, onInvalid: value => invalid.push(value), ...extra })
  const app = renderer.createApp({ setup: () => () => h(Editor, props) })
  for (const type of ['a-select', 'a-button', 'a-tooltip', 'a-tag', 'a-input', 'a-input-number', 'a-space', 'a-switch']) {
    app.component(type, defineComponent({ inheritAttrs: false, setup: (_props, { attrs, slots }) => () => h(type, attrs, Object.values(slots).flatMap(slot => slot?.())) }))
  }
  app.config.warnHandler = () => {}; app.mount(root)
  return { root, props, invalid, patches, close: () => app.unmount() }
}
const nodes = (view, type) => walk(view.root, node => node.type === type)
const yaml = view => nodes(view, 'external-shell').find(node => node.props.language === 'yaml')
const mode = view => nodes(view, 'a-button').find(node => ['YAML', 'algorithmInteractive'].includes(node.props['aria-label']))

test('算法配置按来源、计算、结果分层，来源块复用真实引用且选择仍更新原规则', async () => {
  const view = mount()
  try {
    const stages = walk(view.root, node => node.props.class === 'algorithm-editor__stage-title').map(textContent)
    assert.deepEqual(stages, ['algorithmDataStage','algorithmProcessStage','algorithmResultStage'])
    assert.equal(walk(view.root, node => node.props.class?.split(' ').includes('algorithm-editor__stage')).length, 3)
    const reference = walk(view.root, node => node.props.class?.includes('algorithm-editor__source-chip') && node.props['data-reference'] === 'operating')[0]
    assert.ok(reference)
    const source = nodes(view,'external-shell').find(node => node.props['component-props']?.['aria-label'] === 'source · State')
    assert.ok(source)
    assert.equal(source.props['component-props'].options.find(item => item.value === 'operating').label, 'Operating')
    source.props.onChange('online'); await flush()
    assert.equal(view.props.rule.inputs[0].metricId,'online')
  } finally { view.close() }
})

test('算法图标按真实操作区分，未知算法使用通用图标且不推断名称或能力', () => {
  assert.equal(calculatorIcon(state), 'ClockCircleOutlined')
  assert.equal(calculatorIcon(meter), 'RiseOutlined')
  assert.equal(calculatorIcon({ ...meter, id:'integral' }), 'AreaChartOutlined')
  assert.equal(calculatorIcon({ ...meter, id:'rms', configuration:{ provider:'signal' } }), 'DashboardOutlined')
  assert.equal(calculatorIcon({ ...meter, id:'future' }), 'CalculatorOutlined')
  assert.equal(calculatorIcon({ ...meter, configuration:{ ...meter.configuration, provider:'third-party' } }), 'CalculatorOutlined')
  assert.equal(calculatorIcon(), 'CalculatorOutlined')
  const opaque = { id:'custom', name:'Custom model', configuration:{ provider:'custom', providerVersion:'v7' } }
  const original = JSON.stringify(opaque)
  for (const locale of ['zh','en']) {
    const t = (key, values) => (metricMessages[locale][key] || key).replace('{version}', values?.version || '')
    const option = calculatorOption(opaque, t)
    assert.equal(option.label, opaque.name)
    assert.equal(option.icon, 'CodeOutlined')
    assert.match(option.description, /YAML/)
    assert.ok(option.description.includes(locale === 'zh' ? '版本 v7' : 'Version v7'))
    const builtin = calculatorOption({ ...meter, description:'Counter change' }, t)
    assert.equal(builtin.description, `Counter change · ${locale === 'zh' ? '版本 1' : 'Version 1'}`)
  }
  assert.equal(JSON.stringify(opaque), original)
})

test('常用菜单依据可视描述筛选起点，扩展算法与同名版本仍按精确身份选择', async () => {
  const newer = { ...clone(meter), configuration:{ ...clone(meter.configuration), providerVersion:'2' } }
  const extension = { ...clone(meter), name:'External meter', configuration:{ ...clone(meter.configuration), provider:'external-meter' } }
  const opaque = { id:'custom', name:'Custom', inputNames:{}, parameterDefinitions:[], configuration:{ provider:'custom', providerVersion:'v7' } }
  const view = mount({ calculators:clone([state,meter,newer,extension,opaque]) })
  try {
    const select = () => nodes(view,'external-shell').find(node => node.props['component-props']?.['aria-label'] === 'chooseAlgorithm')
    assert.equal(select().props['component-props'].dropdownMatchSelectWidth, false)
    const options = select().props['component-props'].options
    assert.equal(new Set(options.map(item => item.value)).size, 4)
    assert.equal(options.some(item => item.value === calculatorKey(opaque)), false)
    assert.ok(options.some(item => item.value === calculatorKey(extension)))
    assert.equal(options[1].label, options[2].label)
    assert.equal(options[1].icon, 'RiseOutlined')
    select().props.onChange(calculatorKey(newer)); await flush()
    assert.equal(view.props.rule.calculator.providerVersion, '2')
    assert.equal(view.props.rule.calculator.parameters.operation, 'increase')
    select().props.onChange(calculatorKey(extension)); await flush()
    assert.equal(view.props.rule.calculator.provider, 'external-meter')
    assert.equal(yaml(view), undefined)
    assert.equal(view.patches.length, 2)
  } finally { view.close() }
})

test('已有自定义算法保留选中回显与YAML编辑，可切换到普通算法', async () => {
  const opaque = { id:'custom', name:'Custom', inputNames:{}, parameterDefinitions:[], configuration:{ provider:'custom', providerVersion:'v7' } }
  const { rule, template } = fixture()
  rule.calculator = { ...opaque.configuration, parameters:{ custom:0 } }
  const view = mount({ rule, template, calculators:clone([state,meter,opaque]) })
  try {
    const select = () => nodes(view,'external-shell').find(node => node.props['component-props']?.['aria-label'] === 'chooseAlgorithm')
    assert.equal(select().props.value, calculatorKey(opaque))
    assert.ok(select().props['component-props'].options.some(item => item.value === calculatorKey(opaque)))
    assert.ok(yaml(view))
    assert.equal(view.patches.length, 0)
    yaml(view).props['onUpdate:modelValue']('provider: custom\nproviderVersion: v7\nparameters:\n  custom: 2'); await flush()
    assert.equal(view.props.rule.calculator.parameters.custom, 2)
    select().props.onChange(calculatorKey(meter)); await flush()
    assert.equal(view.props.rule.calculator.provider, 'measurement')
    assert.equal(yaml(view), undefined)
    assert.equal(select().props['component-props'].options.some(item => item.value === calculatorKey(opaque)), false)
  } finally { view.close() }
})

test('来源缺项在对应输入旁具名提示，原位选择后消失且不阻止切换', async () => {
  const { rule, template } = fixture()
  rule.inputs = []
  const view = mount({ rule, template })
  try {
    const hints = () => nodes(view,'p').filter(node => node.props.role === 'status').map(textContent)
    const source = () => nodes(view,'external-shell').find(node => node.props['component-props']?.['aria-label'] === 'source · State')
    assert.deepEqual(hints(), ['algorithmMissingSource · State'])
    assert.equal(source().props['component-props']['aria-invalid'], true)
    assert.equal(view.invalid.at(-1), false)
    mode(view).props.onClick(); await flush()
    assert.ok(yaml(view)); assert.deepEqual(hints(), ['algorithmMissingSource · State'])
    mode(view).props.onClick(); await flush()
    source().props.onChange('operating'); await flush()
    assert.deepEqual(hints(), [])
    assert.equal(source().props['component-props']['aria-invalid'], false)
    assert.equal(view.props.rule.inputs[0].metricId, 'operating')
  } finally { view.close() }
})

test('省略的算法参数显示描述中默认值，显式0与false保留，回显不写配置', () => {
  const descriptor = clone(meter)
  descriptor.configuration.parameters.multiplier = 1
  descriptor.parameterDefinitions.push({ id:'multiplier', name:'Multiplier', valueType:{type:'double'} }, { id:'enabled', name:'Enabled', valueType:{type:'boolean'} })
  descriptor.configuration.parameters.enabled = true
  const rule = { id:'usage', inputs:[{id:'reading',metricId:'reading'}], calculator:{ ...clone(descriptor.configuration), parameters:{ operation:'increase', negativeDelta:'reject', enabled:false } } }
  const template = { ...fixture().template, definitions:[rule], inputDefinitions:[{id:'reading',name:'Reading',valueType:{type:'array'}}] }
  const view = mount({ calculators:[descriptor], rule, template })
  try {
    const number = nodes(view,'external-shell').find(node => node.props['component-props']?.['aria-label'] === 'Multiplier')
    const flag = nodes(view,'external-shell').find(node => node.props['component-props']?.['aria-label'] === 'Enabled')
    assert.equal(number.props.value,1)
    assert.equal(flag.props.value,'false')
    assert.equal(Object.hasOwn(view.props.rule.calculator.parameters,'multiplier'),false)
    assert.equal(view.patches.length,0)
    number.props.onChange(0)
    assert.equal(view.props.rule.calculator.parameters.multiplier,0)
  } finally { view.close() }
})

test('algorithm selection pins provider, version and operation; opaque inputs stay in YAML', () => {
  assert.equal(findCalculator(state.configuration, [state]), state)
  assert.equal(findCalculator({ ...state.configuration, providerVersion: '2' }, [state]), undefined)
  assert.equal(findCalculator({ ...meter.configuration, parameters: { operation: 'integral' } }, [meter]), undefined)
  assert.equal(interactiveCalculator(state.configuration, state), true)
  assert.equal(interactiveCalculator({ ...state.configuration, inputTypes: { from: { type: 'long' } } }, state), false)
  assert.equal(interactiveCalculator({ provider: 'external' }), false)
  const { rule } = fixture()
  const next = chooseAlgorithm(rule, meter)
  assert.equal(next.calculator.provider, 'measurement'); assert.deepEqual(next.inputs, [])
  assert.equal(rule.calculator.custom, false); assert.equal(state.configuration.parameters.duration, 'PT1H')
})

test('binding uses declared source types, keeps other bindings and does not alter lookback', () => {
  const { rule, template } = fixture()
  rule.inputs.push({ id: 'other', metricId: 'other', presence: 'optional' })
  const next = bindAlgorithmInput(rule, 'state', 'online', { type: 'boolean' }, state)
  assert.equal(next.calculator.inputTypes.state.elementType.type, 'boolean')
  assert.equal(next.calculator.parameters.activeValue, undefined); assert.equal(next.calculator.parameters.inactiveValue, undefined)
  assert.equal(next.calculator.parameters.extra, 0); assert.equal(next.calculator.custom, false)
  assert.equal(next.inputs[0].presence, 'optional'); assert.equal(template.inputDefinitions[0].source.lookback, 'PT2H')
  assert.equal(rule.calculator.inputTypes.state.elementType.type, 'int')
})

test('object result selection roundtrips MathLive aliases and depends on its parent calculation', () => {
  const { rule, template } = fixture()
  delete rule.calculator.outputType.properties[0].name
  const expression = { id: 'minutes', inputs: [{ id: 'stats', metricId: 'statistics' }] }
  template.definitions.push(expression)
  const references = ruleFormulaReferences(template, expression, [state])
  const field = references.find(item => item.expression === "stats['activeDuration']")
  assert.equal(field.label, 'State duration · Runtime'); assert.equal(field.metricId, 'statistics')
  const latex = expressionToFormula("stats['activeDuration'] / 60", references)
  assert.ok(latex)
  const restored = formulaToExpression(latex, references)
  assert.equal(restored.expression, "(stats['activeDuration'] / 60)")
  assert.deepEqual(restored.metricIds, ['statistics'])
})

test('YAML completion is contextual for keys, enums, duration and exact provider versions', () => {
  assert.ok(algorithmSuggestions('parameters:\n  dur', state.configuration, state, [state]).some(item => item.label === 'duration' && item.insertText.includes('PT1H')))
  assert.deepEqual(algorithmSuggestions('parameters:\n  negativeDelta: re', meter.configuration, meter, [meter]).map(item => item.label), ['reject', 'rollover'])
  assert.deepEqual(algorithmSuggestions('parameters:\n  duration: ', state.configuration, state, [state]).map(item => item.label), ['PT1M', 'PT5M', 'PT1H'])
  assert.equal(algorithmSuggestions('providerVersion: ', state.configuration, state, [state, meter])[0].insertText, '"1"')
  assert.deepEqual(algorithmSuggestions('outputType:\n  properties:\n    unknown: ', state.configuration, state, [state]), [])
})

test('interactive changes and YAML share a draft; invalid text cannot overwrite or switch away', async () => {
  const view = mount()
  try {
    await flush()
    assert.equal(yaml(view), undefined)
    assert.ok(textContent(view.root).includes('Runtime'))
    const duration = nodes(view, 'external-shell').find(node => node.props.value === 1 && node.props['component-props']?.['aria-label'] === 'durationAmount')
    duration.props.onChange(2); await flush()
    assert.equal(view.props.rule.calculator.parameters.duration, 'PT7200S')
    mode(view).props.onClick(); await flush()
    assert.ok(yaml(view).props['model-value'].includes('custom: false'))
    yaml(view).props['onUpdate:modelValue']('{'); await flush()
    assert.equal(view.invalid.at(-1), true); assert.equal(yaml(view).props['model-value'], '{')
    mode(view).props.onClick(); await flush(); assert.ok(yaml(view))
    yaml(view).props['onUpdate:modelValue']('provider: state\nproviderVersion: "1"\ncustom: false\nparameters: []'); await flush()
    assert.equal(view.invalid.at(-1), true); assert.equal(view.props.rule.calculator.parameters.extra, 0)
    const valid = clone(view.props.rule.calculator); valid.parameters.duration = 'PT3H'
    yaml(view).props['onUpdate:modelValue'](JSON.stringify(valid)); await flush()
    assert.equal(view.invalid.at(-1), false); mode(view).props.onClick(); await flush()
    assert.equal(yaml(view), undefined)
    assert.equal(view.props.rule.calculator.parameters.duration, 'PT3H')
    assert.equal(view.props.rule.calculator.parameters.extra, 0); assert.equal(view.props.rule.calculator.custom, false)
    view.props.disabled = true; await flush()
    const before = view.patches.length
    nodes(view, 'external-shell').find(node => node.props.type === 'number').props.onChange(4); await flush()
    assert.equal(view.patches.length, before)
  } finally { view.close() }
})

test('boolean state binding requires explicit meanings and preserves false when completed', async () => {
  const view = mount()
  try {
    await flush()
    const source = nodes(view, 'external-shell').find(node => node.props['component-props']?.['aria-label'] === 'source · State')
    source.props.onChange('online'); await flush()
    const hints = () => nodes(view,'span').filter(node => node.props.role === 'status').map(textContent)
    assert.deepEqual(hints(), ['algorithmMissingParameter · Active', 'algorithmMissingParameter · Inactive'])
    assert.equal(view.invalid.at(-1), false)
    const active = nodes(view, 'external-shell').find(node => node.props['component-props']?.['aria-label'] === 'Active')
    const inactive = nodes(view, 'external-shell').find(node => node.props['component-props']?.['aria-label'] === 'Inactive')
    assert.deepEqual(active.props['component-props'].options.map(item => item.value), ['true', 'false'])
    assert.equal(active.props['component-props']['aria-invalid'], true)
    mode(view).props.onClick(); await flush(); assert.ok(yaml(view)); assert.deepEqual(hints(), [])
    mode(view).props.onClick(); await flush()
    active.props.onChange('true'); await flush(); assert.deepEqual(hints(), ['algorithmMissingParameter · Inactive'])
    inactive.props.onChange('false'); await flush(); assert.deepEqual(hints(), [])
    assert.equal(view.props.rule.calculator.parameters.inactiveValue, false)
    assert.equal(view.invalid.at(-1), false)
  } finally { view.close() }
})

test('数值状态0为已填写，不从算法默认值推断输入含义', async () => {
  const { rule, template } = fixture()
  delete rule.calculator.parameters.activeValue
  rule.calculator.parameters.inactiveValue = 0
  const view = mount({ rule, template })
  try {
    const hints = () => nodes(view,'span').filter(node => node.props.role === 'status').map(textContent)
    assert.deepEqual(hints(), ['algorithmMissingParameter · Active'])
    const active = nodes(view,'external-shell').find(node => node.props['component-props']?.['aria-label'] === 'Active')
    active.props.onChange(0); await flush()
    assert.deepEqual(hints(), [])
    assert.equal(view.props.rule.calculator.parameters.activeValue, 0)
  } finally { view.close() }
})

test('YAML completions are scoped to the active model and disposed across editor replacements', async () => {
  const view = mount()
  let closed = false
  try {
    mode(view).props.onClick(); await flush()
    const registrations = [], callbacks = []
    const model = { getValueInRange: () => 'parameters:\n  dur', getWordUntilPosition: () => ({ startColumn: 3 }) }
    const editor = { getModel: () => model, onDidDispose: callback => callbacks.push(callback) }
    const monaco = { languages: { CompletionItemKind: { Property: 9 }, registerCompletionItemProvider: (_language, provider) => {
      const registration = { provider, disposals: 0, dispose() { this.disposals++ } }; registrations.push(registration); return registration
    } } }
    yaml(view).props.init(editor, monaco)
    const position = { lineNumber: 2, column: 6 }
    assert.deepEqual(registrations[0].provider.provideCompletionItems({}, position).suggestions, [])
    assert.ok(registrations[0].provider.provideCompletionItems(model, position).suggestions.some(item => item.label === 'duration'))
    yaml(view).props.init(editor, monaco)
    callbacks[0](); assert.equal(registrations[1].disposals, 0)
    view.close(); closed = true; assert.equal(registrations[1].disposals, 1)
  } finally { if (!closed) view.close() }
})

test('metadata query failure is visible and disposed or superseded requests cannot replace the catalogue', async () => {
  const scope = effectScope(); let finish
  const api = { calculators: async () => { throw new Error('offline') } }
  const state = scope.run(() => useMetricTemplates(ref(true), api))
  try {
    await state.loadCalculators(); assert.equal(state.calculatorError.value, 'offline'); assert.deepEqual(state.calculators.value, [])
    api.calculators = () => new Promise(resolve => { finish = resolve })
    const old = state.loadCalculators()
    api.calculators = async () => [meter]
    await state.loadCalculators(); finish([]); await old
    assert.equal(state.calculators.value[0].name, meter.name); assert.equal(state.calculatorError.value, '')
    api.calculators = () => new Promise(resolve => { finish = resolve })
    const pending = state.loadCalculators(); scope.stop(); finish([]); await pending
    assert.equal(state.calculators.value[0].name, meter.name)
  } finally { scope.stop() }
})
