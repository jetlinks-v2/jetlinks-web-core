import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, ref, reactive, defineComponent, h } from 'vue'
import { resolve } from 'node:path'
import { createMetricLoader, createMetricRenderer, flush, walk, textContent, sourceRoot } from './helpers/metricRuntime.mjs'

const load = createMetricLoader({
  'vue-i18n': { useI18n: () => ({ t: key => key }) },
  [resolve(sourceRoot, 'components/Metric/api.ts')]: { metricApi: {} },
  [resolve(sourceRoot, 'components/Metric/template/TemplateFormulaEditor.vue')]: { default: defineComponent({
    inheritAttrs: false, setup: (_props, { attrs }) => () => h('formula-boundary', attrs),
  }), __esModule: true },
})
const { useTemplateDesigner } = load('components/Metric/template/useTemplateDesigner.ts')
const { useMetricTemplates } = load('components/Metric/template/useMetricTemplates.ts')
const { templateGraph } = load('components/Metric/template/designer.ts')
const RuleEditor = load('components/Metric/template/TemplateRuleEditor.vue').default
const NodeEditor = load('components/Metric/template/TemplateNodeEditor.vue').default
const template = () => ({ id: 'rise', version: '1', name: '温升',
  inputDefinitions: [{ id: 'temperature', name: '绕组温度', unit: 'Cel', maxAge: 'PT30S', custom: false }, { id: 'ambient', name: '环境温度', unit: 'Cel' }],
  definitions: [{ id: 'rise', type: 'composite', dependsOn: ['temperature'], expression: '#temperature', window: { mode: 'none', extension: 0 } }],
  outputs: [{ metricId: 'rise', label: '温升', persist: false, publish: true, custom: { x: 0 } }],
  parameterDefinitions: [{ id: 'limit', name: '限值', valueType: { type: 'double' } }], parameters: { limit: 0 }, options: { unknown: false },
})
function designer() {
  const scope = effectScope(); const value = ref(template()); const disabled = ref(false); const commits = []
  const view = scope.run(() => useTemplateDesigner(value, disabled, next => { commits.push(next); value.value = next }))
  return { scope, value, disabled, commits, view }
}

test('抽屉连续编辑共享会话，取消整轮撤回，完成一次提交并保留扩展及0/false', () => {
  const { scope, value, commits, view } = designer()
  try {
    const initial = JSON.stringify(value.value)
    view.select({ kind: 'input', index: 0 }); view.patch({ name: '温度' }); view.move(1); view.patch({ unit: 'K' })
    assert.equal(view.view.value.inputDefinitions[0].name, '温度'); assert.equal(JSON.stringify(value.value), initial)
    view.cancel(); assert.equal(JSON.stringify(value.value), initial); assert.equal(commits.length, 0)
    view.select({ kind: 'output', index: 0 }); view.patch({ label: '温升结果', publish: false }); view.finish()
    assert.equal(commits.length, 1); assert.equal(view.selection.value, undefined)
    assert.deepEqual(value.value.outputs[0], { metricId: 'rise', label: '温升结果', persist: false, publish: false, custom: { x: 0 } })
    assert.deepEqual(value.value.options, { unknown: false }); assert.equal(value.value.parameters.limit, 0)
  } finally { scope.stop() }
})

test('局部文本错误阻止切换/完成/添加；取消可用，撤权与模板替换清理会话', () => {
  const { scope, value, disabled, commits, view } = designer()
  try {
    view.select({ kind: 'rule', index: 0 }); view.invalid.value = true; view.move(1); view.finish(); view.add('input')
    assert.equal(view.selection.value.kind, 'rule'); assert.equal(view.view.value.inputDefinitions.length, 2); assert.equal(commits.length, 0)
    view.cancel(); assert.equal(view.invalid.value, false)
    view.select({ kind: 'input', index: 0 }); view.patch({ name: '未提交' }); disabled.value = true
    assert.equal(view.selection.value, undefined); assert.equal(value.value.inputDefinitions[0].name, '绕组温度')
    view.select({ kind: 'input', index: 0 }); view.patch({ name: '只读' }); view.finish(); assert.equal(commits.length, 0)
    disabled.value = false; view.select({ kind: 'rule', index: 0 }); value.value = template(); assert.equal(view.selection.value, undefined)
  } finally { scope.stop() }
})

test('添加与删除属于当前会话，取消不残留，删除末项仍可连续编辑其它对象', () => {
  const { scope, value, view } = designer()
  try {
    view.add('input'); assert.equal(view.view.value.inputDefinitions.at(-1).id, 'input1'); view.cancel(); assert.equal(value.value.inputDefinitions.length, 2)
    view.add('rule'); view.patch({ expression: '#rise * 2', dependsOn: ['rise'] }); view.add('output'); view.finish()
    assert.equal(value.value.outputs.at(-1).metricId, 'result1')
    view.select({ kind: 'output', index: 1 }); view.remove(); assert.ok(view.selection.value); assert.equal(value.value.outputs.length, 2)
    view.finish(); assert.equal(value.value.outputs.length, 1)
  } finally { scope.stop() }
})

test('关系图读取多级、前向声明及显式输入引用；未知或循环不挂起、不伪造连线', () => {
  const value = template()
  value.definitions = [{ id: 'last', dependsOn: ['middle'] }, { id: 'middle', inputs: [{ id: 'a', metricId: 'temperature' }, { id: 'b', metricId: 'ambient' }] }]
  value.outputs[0].metricId = 'last'
  const graph = templateGraph(value)
  assert.equal(graph.edges.length, 4)
  assert.ok(graph.nodes.find(x => x.index === 0 && x.kind === 'rule').column > graph.nodes.find(x => x.index === 1 && x.kind === 'rule').column)
  value.definitions = [{ id: 'a', dependsOn: ['b'] }, { id: 'b', dependsOn: ['a', 'unknown'] }]
  assert.equal(templateGraph(value).edges.length, 2)
  value.definitions = [{ id: 'temperature', sourceMetric: 'temperature' }]; value.outputs[0].metricId = 'temperature'
  assert.deepEqual(templateGraph(value).edges.map(edge => edge.key), ['input-0:rule-0', 'rule-0:output-0'])
})

test('同一模板在可视与YAML/JSON间往返，坏文本不覆盖草稿及扩展字段', async () => {
  const scope = effectScope(); const view = scope.run(() => useMetricTemplates(ref(true), {}))
  try {
    view.open({ id: 'e', released: false, template: template() }); view.draft.value.definitions[0].expression = '#temperature - #ambient'
    const changed = JSON.stringify(view.draft.value)
    view.switchMode('full'); view.switchFormat('json'); assert.equal(JSON.parse(view.fullText.value).definitions[0].window.extension, 0)
    view.switchMode('form'); assert.equal(JSON.stringify(view.draft.value), changed); view.switchMode('full')
    const original = JSON.stringify(view.draft.value); view.fullText.value = '{'; view.switchMode('form')
    assert.equal(view.mode.value, 'full'); assert.equal(JSON.stringify(view.draft.value), original); assert.equal(view.fullText.value, '{')
    view.fullText.value = '{"definitions":null}'; view.switchMode('form'); assert.equal(view.mode.value, 'full')
    view.fullText.value = original; view.switchMode('form'); assert.equal(view.draft.value.options.unknown, false)
    assert.equal(view.draft.value.definitions[0].expression, '#temperature - #ambient')
    view.open({ id: 'e', released: false, template: template() }); view.switchMode('full'); view.switchMode('form'); assert.equal(view.hasChanges.value, false)
  } finally { scope.stop() }
})

test('修改规则、样本、权限或卸载后，旧试算结果和晚到响应均不可回填', async () => {
  const scope = effectScope(); const editable = ref(true); let resolveResult
  const view = scope.run(() => useMetricTemplates(editable, { simulate: () => new Promise(resolve => { resolveResult = resolve }) }))
  try {
    view.open({ id: 'e', released: false, template: template() })
    for (const change of [() => { view.draft.value.parameters.limit = 1 }, () => { view.simulationText.value += '\n' }, () => { editable.value = false }]) {
      editable.value = true; const pending = view.simulate(); change(); resolveResult({ status: 'success', results: [{ metricId: 'rise', value: 35 }], records: [], recordsTruncated: false }); await pending
      assert.deepEqual(view.simulationResults.value, []); assert.equal(view.simulating.value, false)
    }
    editable.value = true; const first = view.simulate(); resolveResult({ status: 'success', results: [{ metricId: 'rise', value: false }], records: [], recordsTruncated: false }); await first
    assert.equal(view.simulationResults.value[0].value, false)
    view.draft.value.inputDefinitions[0].maxAge = 'PT5S'; assert.deepEqual(view.simulationResults.value, [])
    const pending = view.simulate(); scope.stop(); resolveResult({ status: 'success', results: [{ metricId: 'rise', value: 99 }], records: [], recordsTruncated: false }); await pending; assert.deepEqual(view.simulationResults.value, [])
  } finally { scope.stop() }
})

test('保存并发布期间撤权不继续发起发布', async () => {
  const scope = effectScope(); const editable = ref(true); let finishSave; let releases = 0
  const view = scope.run(() => useMetricTemplates(editable, { saveTemplate: () => new Promise(resolve => { finishSave = resolve }), queryTemplates: async () => ({ data: [], total: 0 }), releaseTemplate: async () => { releases++ } }))
  try {
    view.open(); const pending = view.release(); editable.value = false
    finishSave({ id: 'e', released: false, template: template() }); await pending; assert.equal(releases, 0)
  } finally { scope.stop() }
})

function mountRule(rule) {
  const { renderer, root } = createMetricRenderer(); const patches = []; const invalid = []
  const props = reactive({ template: template(), rule, disabled: false, onPatch: fields => { patches.push(fields); Object.assign(props.rule, fields) }, onInvalid: value => invalid.push(value) })
  const app = renderer.createApp({ setup: () => () => h(RuleEditor, props) })
  for (const type of ['a-form', 'a-form-item', 'a-select', 'a-button', 'a-textarea', 'a-collapse', 'a-collapse-panel', 'a-alert', 'a-input', 'a-input-number', 'a-space']) {
    app.component(type, defineComponent({ inheritAttrs: false, setup: (_props, { attrs, slots }) => () => h(type, attrs, Object.values(slots).flatMap(slot => slot?.())) }))
  }
  app.config.warnHandler = () => {}; app.mount(root)
  return { root, props, patches, invalid, close: () => app.unmount() }
}
test('公式编辑边界复用别名，显式输入与依赖同步，保留输入约束，禁用不提交', async () => {
  const editor = mountRule({ id: 'rise', expression: '#t + 1', dependsOn: ['temperature'], inputs: [{ id: 't', metricId: 'temperature', maxAge: 'PT10S' }] })
  try {
    const formula = () => walk(editor.root, x => x.type === 'formula-boundary')[0]
    assert.equal(formula().props.references[0].expression, 't')
    assert.equal(formula().props.references[1].expression, 'ambient')
    assert.deepEqual(formula().props.references.map(item => item.group), ['data', 'data', 'parameter'])
    assert.equal(formula().props.references[2].expression, 'params.limit')
    formula().props.onChange({ expression: 't + ambient', metricIds: ['temperature', 'ambient'] }); await flush()
    assert.equal(editor.props.rule.expression, 't + ambient')
    assert.deepEqual(editor.props.rule.dependsOn, ['temperature', 'ambient'])
    assert.equal(editor.props.rule.inputs[0].maxAge, 'PT10S'); assert.equal(editor.props.rule.inputs[1].metricId, 'ambient')
    formula().props.onInvalid(true); await flush()
    walk(editor.root, x => x.type === 'a-select' && x.props.value === 'expression')[0].props['onUpdate:value']('temporal'); await flush()
    assert.equal(editor.patches.length, 1); assert.equal(editor.invalid.at(-1), true)
    formula().props.onInvalid(false)
    editor.props.disabled = true; await flush(); formula().props.onChange({ expression: '1', metricIds: [] }); await flush(); assert.equal(editor.patches.length, 1)
  } finally { editor.close() }
})
test('公式引用沿用后端输入别名清理规则；特殊参数键使用SpEL索引', async () => {
  const editor = mountRule({ id: 'rise', expression: 't_air', inputs: [{ id: 't-air', metricId: 'temperature' }] })
  try {
    editor.props.template.parameterDefinitions.push({ id: "factor-'key", name: '修正系数' }); await flush()
    const references = walk(editor.root, x => x.type === 'formula-boundary')[0].props.references
    assert.equal(references[0].expression, 't_air')
    assert.equal(references.at(-1).expression, "params['factor-''key']")
    assert.equal(references.at(-1).group, 'parameter')
  } finally { editor.close() }
})
test('真实算法编辑器保留坏JSON原文且不覆盖对象，修正后保留0/false与扩展元数据', async () => {
  const editor = mountRule({ id: 'usage', calculator: { provider: 'measurement', providerVersion: '1', parameters: { operation: 'increase' }, custom: false } })
  try {
    const textarea = () => walk(editor.root, x => x.type === 'a-textarea' && x.props['aria-label'] === 'algorithmConfiguration')[0]
    textarea().props['onUpdate:value'].forEach(fn => fn('{')); await flush()
    assert.equal(textarea().props.value, '{'); assert.equal(editor.invalid.at(-1), true); assert.equal(editor.props.rule.calculator.provider, 'measurement')
    textarea().props['onUpdate:value'].forEach(fn => fn('{"provider":"measurement","custom":false,"parameters":{"zero":0}}')); await flush()
    assert.equal(editor.invalid.at(-1), false); assert.equal(editor.props.rule.calculator.custom, false); assert.equal(editor.props.rule.calculator.parameters.zero, 0)
  } finally { editor.close() }
})

test('历史输入切回最新值同步移除序列约束，其它来源扩展和输入约束保留', async () => {
  const { renderer, root } = createMetricRenderer(); const value = template(); let patch
  value.inputDefinitions[0] = { ...value.inputDefinitions[0], source: { lookback: 'PT1H', maxPoints: 128, extra: false }, minSamples: 2, maxGap: 'PT30M' }
  const app = renderer.createApp({ setup: () => () => h(NodeEditor, { template: value, node: { kind: 'input', index: 0 }, onPatch: fields => { patch = fields } }) })
  app.config.warnHandler = () => {}; app.mount(root)
  try {
    walk(root, node => node.type === 'a-select' && node.props.value === 'history')[0].props['onUpdate:value']('latest'); await flush()
    assert.deepEqual(patch, { source: { lookback: undefined, maxPoints: undefined, extra: false }, minSamples: undefined, maxGap: undefined })
    assert.equal(value.inputDefinitions[0].maxAge, 'PT30S')
  } finally { app.unmount() }
})

test('窗口统计通过来源/时长/统计方式组装真实规则；切回公式无残留字段', async () => {
  const editor = mountRule({ id: 'average', type: 'composite', expression: 'temperature', dependsOn: ['temperature'], window: { mode: 'none' } })
  try {
    walk(editor.root, n => n.type === 'a-select' && n.props.value === 'expression')[0].props['onUpdate:value']('statistics'); await flush()
    assert.equal(editor.props.rule.type, 'feature'); assert.equal(editor.props.rule.window.timeMode, 'event')
    walk(editor.root, n => n.type === 'a-select' && n.props['aria-label'] === 'statisticSource')[0].props['onUpdate:value']('ambient'); await flush()
    assert.equal(editor.props.rule.sourceMetric, 'ambient'); assert.deepEqual(editor.props.rule.dependsOn, ['ambient'])
    walk(editor.root, n => n.type === 'a-select' && n.props['aria-label'] === 'windowRange')[0].props['onUpdate:value']('latestN'); await flush()
    assert.equal(editor.props.rule.window.size, '5'); assert.equal(editor.props.rule.window.emitPolicy, 'onEvent')
    walk(editor.root, n => n.type === 'a-select' && n.props.value === 'statistics')[0].props['onUpdate:value']('expression'); await flush()
    assert.equal(editor.props.rule.window, undefined); assert.equal(editor.props.rule.aggregation, undefined)
  } finally { editor.close() }
})

test('公式和算法可定时；随数据的算法不残留不支持的window对象', async () => {
  const editor = mountRule({ id: 'r', type: 'composite', expression: 'temperature', dependsOn: ['temperature'] })
  try {
    const trigger = () => walk(editor.root, n => n.type === 'a-select' && n.props['aria-label'] === 'calculationTrigger')[0]
    trigger().props['onUpdate:value']('onSchedule'); await flush()
    assert.equal(editor.props.rule.window.mode, 'none'); assert.equal(editor.props.rule.window.emitInterval, 'PT5M')
    walk(editor.root, n => n.type === 'a-select' && n.props.value === 'expression')[0].props['onUpdate:value']('calculator'); await flush()
    trigger().props['onUpdate:value']('onSchedule'); await flush(); trigger().props['onUpdate:value']('onEvent'); await flush()
    assert.equal(editor.props.rule.window, undefined)
    editor.props.disabled = true; await flush(); trigger().props['onUpdate:value']('onSchedule'); assert.equal(editor.props.rule.window, undefined)
  } finally { editor.close() }
})
