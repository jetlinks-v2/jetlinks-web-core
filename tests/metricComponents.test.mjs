import assert from 'node:assert/strict'
import test from 'node:test'
import { defineComponent, h, onUnmounted, reactive, ref, nextTick } from 'vue'
import { resolve } from 'node:path'
import { createMetricLoader, createMetricRenderer, flush, walk, textContent, sourceRoot } from './helpers/metricRuntime.mjs'
const api = {}
const confirmations = []
const load = createMetricLoader({
  '@jetlinks-web/vite/dist/dynamic-remote': { dynamicRemoteManager: {} },
  '@jetlinks-web-core/utils/consts': { isSubApp: false },
  'vue-i18n': { useI18n: () => ({ t: key => key }) },
  'ant-design-vue': { Modal: { confirm: value => confirmations.push(value) } },
  [resolve(sourceRoot, 'components/Metric/api.ts')]: { metricApi: api },
  [resolve(sourceRoot, 'components/Echarts/index.ts')]: { __esModule: true, default: () => h('chart') },
})
const { moduleRegistry } = load('utils/module-registry.ts')
const Workspace = load('components/Metric/workspace/MetricWorkspace.vue').default
const Panel = load('components/Metric/MetricPanel.vue').default
const Editor = load('components/Metric/MetricConfigEditor.vue').default
const Manager = load('components/Metric/template/MetricTemplateManager.vue').default
const DisplayFields = load('components/Metric/extensions/MetricDisplayFields.vue').default
const template = { id: 'power', version: '1', name: 'Power', outputs: [{ metricId: 'value', label: 'Consumption', unit: 'kW', publish: true }], inputDefinitions: [], parameterDefinitions: [{ id: 'factor', expands: { editable: true } }], parameters: { factor: 1 }, definitions: [], options: { presentation: { provider: 'line/status', settings: { decimals: 2, warning: true } } } }
const config = { id: 'c', name: 'Room', ownerType: 'line', ownerId: 'a', targetType: 'line', targetId: 'a', slot: 'c', templateId: 'power', templateVersion: '1', inputMappings: {}, parameters: {}, presentation: { decimals: 0, warning: false, unknown: 7 }, state: 'enabled', revision: 2, dataVersion: 'same' }
const value = { metricId: 'value', value: 5.815, unit: 'kW', eventTime: 1000, quality: { valid: true } }
const controls = ['a-space','a-button','a-select','a-select-option','a-alert','a-spin','a-empty','a-tag','a-dropdown','a-menu','a-menu-item','a-steps','a-form','a-form-item','a-input','a-input-number','a-descriptions','a-descriptions-item','a-popconfirm','a-collapse','a-collapse-panel','a-radio-group','a-radio-button','a-range-picker','a-pagination','a-segmented','a-tabs','a-tab-pane','a-checkbox','a-switch']
function mount(component, props = {}) {
  const previousDocument = globalThis.document
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }
  const { renderer, root } = createMetricRenderer()
  const app = renderer.createApp({ setup: () => () => h(component, props) })
  for (const name of controls) app.component(name, defineComponent({ inheritAttrs: false, setup: (_props, { attrs, slots }) => () => h(name, attrs, Object.values(slots).flatMap(slot => slot?.())) }))
  app.config.warnHandler = () => {}
  app.mount(root)
  return { root, close() { app.unmount(); globalThis.document = previousDocument } }
}
const nodes = (root, type) => walk(root, node => node.type === type)
const findText = (root, type, text) => nodes(root, type).find(node => textContent(node).includes(text))
const click = async node => { assert.ok(node); await node.props.onClick?.(); await flush() }
function defaults() {
  Object.assign(api, { byOwner: async () => [config], configTemplate: async () => template,
    latest: async ids => ids.map(configId => ({ configId, outputs: { value } })), getConfig: async () => config,
    history: async () => [value], selectable: async () => [{ id: 't', name: 'Power', available: true, released: true, template }],
    saveConfig: async next => ({ ...next, revision: next.revision + 1 }), queryTemplates: async () => ({ data: [], total: 0 }) })
}

test('真实Workspace等待授权对象、导航失败清理、同ID重试重建来源scope；业务菜单缺席隐藏跳转', async () => {
  defaults(); moduleRegistry.clear()
  const navigators = new Map(); let sourceMounts = 0; let sourceCloses = 0; let queries = 0; let business = false
  api.byOwner = async () => { queries++; return [] }
  const provider = ownerType => ({ ownerType, label: ownerType,
    navigator: defineComponent({ props: ['selectedId'], setup: (_p, { emit }) => { navigators.set(ownerType, object => emit('select', object)); return () => h('navigator') } }),
    useSourcePicker: context => { sourceMounts++; onUnmounted(() => sourceCloses++); return { pickSource: async () => undefined, host: () => h('source-host', context.value.ownerId) } },
    canEdit: () => false, toBusiness: object => business ? { name: 'line-detail', params: { id: object.ownerId } } : undefined,
  })
  moduleRegistry.register('line-module', { metricDimensions: { line: provider('line'), area: provider('area') } })
  const props = reactive({ scopeKey: 'user/project/tenant', selection: { ownerType: 'line', ownerId: 'a' }, editable: true, onToBusiness: route => routes.push(route) })
  const routes = []
  const view = mount(Workspace, props)
  try {
    await flush(); assert.equal(queries, 0)
    navigators.get('line')({ ownerId: 'a', label: 'Line A' }); await flush()
    assert.equal(queries, 1); assert.equal(sourceMounts, 1)
    assert.equal(findText(view.root, 'a-button', 'openBusiness'), undefined)
    const select = nodes(view.root, 'a-select')[0]
    select.props['onUpdate:value']('area'); await flush()
    assert.equal(sourceCloses, 1)
    navigators.get('area')(undefined); await flush(); assert.equal(queries, 1)
    navigators.get('area')({ ownerId: 'a', label: 'Area A' }); await flush()
    assert.equal(queries, 2); assert.equal(sourceMounts, 2)
    business = true
    navigators.get('area')({ ownerId: 'a', label: 'Area confirmed' }); await flush()
    await click(findText(view.root, 'a-button', 'openBusiness'))
    assert.deepEqual(routes, [{ name: 'line-detail', params: { id: 'a' } }])
    moduleRegistry.unregister('line-module'); await flush()
    assert.equal(nodes(view.root, 'source-host').length, 0)
    assert.equal(sourceCloses, 2)
  } finally { view.close(); moduleRegistry.clear() }
})

test('真实Panel组合模块卡片和详情；共享单位质量时间保留；卸载/渲染失败回退并可删除跳转', async () => {
  defaults(); moduleRegistry.clear(); let histories = 0; let failedDelete = true
  api.history = async () => { histories++; return [value] }
  api.removeConfig = async () => { if (failedDelete) throw new Error('Referenced'); api.byOwner = async () => [] }
  const card = defineComponent({ props: ['settings'], setup: props => () => h('custom-card', `custom:${props.settings.decimals}:${props.settings.warning}`) })
  const detail = defineComponent({ props: ['values'], setup: props => () => h('custom-detail', `points:${props.values.length}`) })
  moduleRegistry.register('line', { metricPresentations: { status: { label: 'Status', card, detail } } })
  const jumps = []; const alarms = []
  const view = mount(Panel, { context: { ownerType: 'line', ownerId: 'a', editable: true, alarmEnabled: true }, detailLinkLabel: 'openWorkspace',
    onOpenDetailLink: reference => jumps.push(reference), onCreateAlarm: reference => alarms.push(reference) })
  try {
    await flush(); assert.equal(textContent(nodes(view.root, 'custom-card')[0]), 'custom:0:false')
    assert.ok(textContent(view.root).includes('kW')); assert.ok(textContent(view.root).includes('valid')); assert.ok(textContent(view.root).includes('sourceTime'))
    assert.equal(histories, 0)
    await click(nodes(view.root, 'button').find(node => node.props.class?.includes('metric-panel__card')))
    assert.equal(textContent(nodes(view.root, 'custom-detail')[0]), 'points:1'); assert.equal(histories, 1)
    await click(findText(view.root, 'a-button', 'openWorkspace')); assert.equal(jumps[0].configId, 'c')
    await click(findText(view.root, 'a-button', 'createAlarm')); assert.equal(alarms[0].outputId, 'value')
    await click(findText(view.root, 'a-menu-item', 'deleteMetric')); await assert.rejects(confirmations.at(-1).onOk()); await flush()
    assert.ok(nodes(view.root, 'a-alert').some(node => node.props.description === 'Referenced'))
    assert.equal(nodes(view.root, 'custom-detail').length, 1)
    moduleRegistry.unregister('line'); await flush()
    assert.equal(nodes(view.root, 'custom-card').length, 0); assert.equal(nodes(view.root, 'custom-detail').length, 0)
    assert.ok(textContent(view.root).includes('6'))
    moduleRegistry.register('line', { metricPresentations: { status: { label: 'Broken', card: { render() { throw new Error('renderer failure') } } } } }); await flush()
    assert.ok(nodes(view.root, 'a-alert').some(node => node.props.message === 'presentationFailed'))
    failedDelete = false
    await click(findText(view.root, 'a-menu-item', 'deleteMetric')); await confirmations.at(-1).onOk(); await flush()
    assert.equal(nodes(view.root, 'button').filter(node => node.props.class?.includes('metric-panel__card')).length, 0)
  } finally { view.close(); moduleRegistry.clear() }
})

test('真实Editor专用表单只改绑定和可编辑参数；显示覆盖单独保存且缺模块/渲染错误禁止保存', async () => {
  defaults(); moduleRegistry.clear(); let change; let stored; let savedEvents = 0
  const fields = defineComponent({ props: ['draft'], emits: ['change'], setup: (_props, { emit }) => { change = patch => emit('change', patch); return () => h('custom-config') } })
  moduleRegistry.register('line', { metricPresentations: { status: { label: 'Status', configFields: fields } } })
  api.saveConfig = async next => { stored = next; return { ...next, revision: 3 } }
  const view = mount(Editor, { context: { ownerType: 'line', ownerId: 'a', editable: true }, configuration: config, onSaved: () => savedEvents++ })
  try {
    await flush(); assert.equal(nodes(view.root, 'custom-config').length, 1)
    change({ parameters: { factor: 0, forbidden: 99 }, revision: 99, state: 'disabled', presentation: { unknown: 0 } }); await flush()
    await click(findText(view.root, 'a-button', 'next')); await click(findText(view.root, 'a-button', 'next'))
    moduleRegistry.unregister('line'); await flush()
    await click(findText(view.root, 'a-button', 'saveDisable')); assert.equal(stored, undefined)
    moduleRegistry.register('line', { metricPresentations: { status: { label: 'Status' } } }); await flush()
    await click(findText(view.root, 'a-button', 'saveDisable'))
    assert.deepEqual(stored.parameters, { factor: 0 }); assert.equal(stored.revision, 2)
    assert.deepEqual(stored.presentation, config.presentation); assert.equal(savedEvents, 1)
  } finally { view.close(); moduleRegistry.clear() }
})

test('对象切换卸载旧编辑器后，迟到保存事件不能关闭新对象的编辑抽屉或追加刷新', async () => {
  defaults(); moduleRegistry.clear()
  const props = reactive({ context: { ownerType: 'line', ownerId: 'a', editable: true } })
  let reads = 0, completeSave
  api.byOwner = async (_type, ownerId) => { reads++; return [{ ...config, id: `config-${ownerId}`, ownerId, targetId: ownerId }] }
  api.configTemplate = async () => ({ ...template, options: {} })
  api.selectable = async () => [{ id: 't', name: 'Power', available: true, released: true, template: { ...template, options: {} } }]
  api.saveConfig = next => new Promise(resolve => { completeSave = () => resolve({ ...next, revision: next.revision + 1 }) })
  const view = mount(Panel, props)
  const openEditor = async () => {
    await click(nodes(view.root, 'button').find(node => node.props.class?.includes('metric-panel__card')))
    await click(findText(view.root, 'a-menu-item', 'edit'))
  }
  try {
    await flush()
    await openEditor()
    await click(findText(view.root, 'a-button', 'next'))
    await click(findText(view.root, 'a-button', 'next'))
    const saving = findText(view.root, 'a-button', 'saveDisable').props.onClick()
    assert.equal(typeof completeSave, 'function')
    props.context = { ...props.context, ownerId: 'b' }
    await flush()
    await openEditor()
    const readCount = reads
    completeSave()
    await saving
    await flush()
    assert.ok(findText(view.root, 'a-button', 'next'))
    assert.equal(reads, readCount)
  } finally { view.close(); moduleRegistry.clear() }
})

test('真实显示设置继承删除覆盖且保留未知字段；模板草稿删除确认失败可重试', async () => {
  defaults(); moduleRegistry.clear()
  const props = reactive({ modelValue: { decimals: 0, unknown: false }, defaults: { decimals: 2 }, 'onUpdate:modelValue': value => { props.modelValue = value } })
  const fields = mount(DisplayFields, props)
  try {
    await click(findText(fields.root, 'a-button', 'inheritDisplay')); assert.deepEqual(props.modelValue, { unknown: false })
    const input = nodes(fields.root, 'a-input-number')[0]
    input.props['onUpdate:value'](0); await flush(); assert.deepEqual(props.modelValue, { unknown: false, decimals: 0 })
    input.props['onUpdate:value'](9); await flush(); assert.equal(props.modelValue.decimals, 0)
  } finally { fields.close() }
  let fail = true; let removals = 0
  const entity = { id: 'draft', name: 'Power', released: false, available: false, template: { ...template, options: {} } }
  api.queryTemplates = async () => ({ data: [entity], total: 1 })
  api.removeTemplate = async () => { removals++; if (fail) throw new Error('Referenced template') }
  const manager = mount(Manager, { editable: true })
  try {
    await flush(); await click(findText(manager.root, 'button', 'Power'))
    assert.ok(findText(manager.root, 'a-popconfirm', 'deleteDraft'))
    await findText(manager.root, 'a-popconfirm', 'deleteDraft').props.onConfirm(); await flush()
    assert.ok(nodes(manager.root, 'a-alert').some(node => node.props.description === 'Referenced template'))
    fail = false
    await findText(manager.root, 'a-popconfirm', 'deleteDraft').props.onConfirm(); await flush()
    assert.equal(removals, 2); assert.equal(findText(manager.root, 'a-popconfirm', 'deleteDraft'), undefined)
  } finally { manager.close() }
})

test('真实Workspace抽屉动作返回第二配置引用；关闭后页头无引用，撤权及owner切换无旧动作', async () => {
  defaults(); moduleRegistry.clear()
  let confirm; let allowed = true
  const second = { ...config, id: 'second', name: 'Second configuration', slot: 'second' }
  api.byOwner = async (_type, id) => id === 'a' ? [config, second] : []
  api.getConfig = async id => id === 'second' ? second : config
  api.latest = async ids => ids.filter(id => allowed || id !== 'second').map(configId => ({ configId, outputs: { value } }))
  moduleRegistry.register('line-module', { metricDimensions: { line: { ownerType: 'line', label: 'Line',
    navigator: defineComponent({ setup: (_p, { emit }) => { confirm = object => emit('select', object); return () => h('navigator') } }),
    useSourcePicker: () => ({ pickSource: async () => undefined }), toBusiness: object => ({ name: 'detail', params: { id: object.ownerId } }),
  } } })
  const returned = []
  const view = mount(Workspace, { scopeKey: 'user/project/tenant', selection: { ownerType: 'line', ownerId: 'a' }, initialReference: { configId: 'c', outputId: 'value' },
    onToBusiness: (route, reference) => returned.push({ route, reference }) })
  try {
    confirm({ ownerId: 'a', label: 'Line A' }); await flush()
    const drawer = () => nodes(view.root, 'external-shell').find(node => node.props.open)
    await click(findText(drawer(), 'a-button', 'openBusiness'))
    assert.equal(returned.at(-1).reference.configId, 'c')
    const cards = () => nodes(view.root, 'button').filter(node => node.props.class?.includes('metric-panel__card'))
    await click(cards()[1]); await click(findText(drawer(), 'a-button', 'openBusiness'))
    assert.equal(returned.at(-1).reference.configId, 'second')
    nodes(view.root, 'external-shell').find(node => node.props.open).props['onUpdate:open'](false); await flush()
    await click(findText(view.root, 'a-button', 'openBusiness')); assert.equal(returned.at(-1).reference, undefined)
    await click(cards()[1]); allowed = false
    await click(findText(view.root, 'a-button', 'refresh'))
    assert.equal(drawer(), undefined)
    await click(findText(view.root, 'a-button', 'openBusiness')); assert.equal(returned.at(-1).reference, undefined)
    allowed = true; await click(findText(view.root, 'a-button', 'refresh')); await click(cards()[0])
    confirm({ ownerId: 'b', label: 'Line B' }); await flush(); assert.equal(drawer(), undefined)
    await click(findText(view.root, 'a-button', 'openBusiness')); assert.equal(returned.at(-1).reference, undefined)
  } finally { view.close(); moduleRegistry.clear() }
})

test('真实专用配置组件渲染失败保持草稿并阻止保存；provider替换恢复', async () => {
  defaults(); moduleRegistry.clear(); let saves = 0
  api.saveConfig = async next => { saves++; return next }
  moduleRegistry.register('line', { metricPresentations: { status: { label: 'Broken', configFields: { render() { throw new Error('fields crashed') } } } } })
  const view = mount(Editor, { context: { ownerType: 'line', ownerId: 'a', editable: true }, configuration: config })
  try {
    await flush(); assert.ok(nodes(view.root, 'a-alert').some(node => node.props.message === 'presentationFailed'))
    await click(findText(view.root, 'a-button', 'next')); await click(findText(view.root, 'a-button', 'next'))
    await click(findText(view.root, 'a-button', 'saveDisable')); assert.equal(saves, 0)
    moduleRegistry.register('line', { metricPresentations: { status: { label: 'Recovered' } } }, { override: true }); await flush()
    await click(findText(view.root, 'a-button', 'saveDisable')); assert.equal(saves, 1)
  } finally { view.close(); moduleRegistry.clear() }
})

test('专用展示设置组件同一路径更新展示覆盖；默认精度继承不修改未知值', async () => {
  let update; let failures = 0
  const provider = { label: 'Custom', presentationFields: defineComponent({ props: ['modelValue','defaults','disabled'], emits: ['update:modelValue'], setup: (props, { emit }) => { update = value => emit('update:modelValue', value); return () => h('custom-display', String(props.defaults.decimals)) } }) }
  const props = reactive({ modelValue: { decimals: 0, unknown: false }, defaults: { decimals: 2 }, disabled: false, provider, 'onUpdate:modelValue': value => { props.modelValue = value }, onFailed: () => failures++ })
  const view = mount(DisplayFields, props)
  try {
    await flush(); assert.equal(textContent(nodes(view.root, 'custom-display')[0]), '2')
    update({ ...props.modelValue, warning: false }); await flush(); assert.equal(props.modelValue.warning, false)
    props.disabled = true; await flush(); update({ decimals: 8 }); await flush(); assert.equal(props.modelValue.decimals, 0)
    props.provider = { label: 'Broken', presentationFields: { render() { throw new Error('display form failed') } } }; await flush()
    assert.equal(failures, 1)
  } finally { view.close() }
})

test('真实模板编辑器选择展示提供者及默认值，表单和完整配置保存同一DTO', async () => {
  defaults(); moduleRegistry.clear()
  const entity = { id: 'draft', name: 'Power', released: false, available: false, template: { ...template, options: { keep: 9, presentation: { settings: { unknown: false } } } } }
  let stored; let settingsChanged
  moduleRegistry.register('line', { metricPresentations: { status: { label: () => 'Status', presentationFields: defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup: (props, { emit }) => { settingsChanged = value => emit('update:modelValue', value); return () => h('custom-template-settings', JSON.stringify(props.modelValue)) } }) } } })
  api.queryTemplates = async () => ({ data: [entity], total: 1 })
  api.saveTemplate = async next => { stored = next; return { ...entity, template: next } }
  const view = mount(Manager, { editable: true })
  try {
    await flush(); await click(findText(view.root, 'button', 'Power'))
    const decimals = nodes(view.root, 'a-input-number').find(node => node.props.max === 8)
    decimals.props['onUpdate:value'](0); await flush()
    const selection = nodes(view.root, 'a-select').find(node => node.props.value === 'builtin/default')
    assert.ok(selection); selection.props['onUpdate:value']('line/status'); await flush()
    settingsChanged({ decimals: 0, unknown: false, warning: false }); await flush()
    await click(findText(view.root, 'a-button', 'save')); assert.equal(stored.options.keep, 9)
    assert.deepEqual(stored.options.presentation, { provider: 'line/status', settings: { decimals: 0, unknown: false, warning: false } })
    await click(findText(view.root, 'a-button', 'fullMode'))
    await click(findText(view.root, 'a-button', 'save')); assert.equal(stored.options.presentation.settings.warning, false)
    await click(findText(view.root, 'a-button', 'visualMode'))
    moduleRegistry.unregister('line'); await flush()
    assert.ok(nodes(view.root, 'a-alert').some(node => node.props.message === 'presentationMissing'))
    assert.equal(nodes(view.root, 'custom-template-settings').length, 0)
  } finally { view.close(); moduleRegistry.clear() }
})

test('来源适配器装载失败显示错误且以只读面板保留查看能力', async () => {
  defaults(); api.byOwner = async () => []
  const Scope = load('components/Metric/workspace/MetricWorkspaceScope.vue').default
  const view = mount(Scope, { context: { ownerType: 'line', ownerId: 'a', editable: true }, provider: { ownerType: 'line', label: 'Line', navigator: {}, useSourcePicker() { throw new Error('Source adapter missing') } } })
  try {
    await flush(); assert.ok(nodes(view.root, 'a-alert').some(node => node.props.description === 'Source adapter missing'))
    assert.equal(findText(view.root, 'a-button', 'add'), undefined)
  } finally { view.close() }
})

test('真实模板管理页图中定位、连续修改与取消/完成只提交父草稿，保存及撤权边界一致', async () => {
  defaults(); moduleRegistry.clear()
  const entity = { id: 'rise', name: 'Temperature', released: false, available: false, template: {
    ...template, name: 'Temperature', inputDefinitions: [{ id: 'temperature', name: 'Winding' }, { id: 'ambient', name: 'Ambient' }],
    definitions: [{ id: 'rise', type: 'composite', dependsOn: ['temperature', 'ambient'], expression: '#temperature - #ambient' }],
    outputs: [{ metricId: 'rise', label: 'Rise', persist: false }], options: {},
  } }
  let stored; let saves = 0
  api.queryTemplates = async () => ({ data: [entity], total: 1 })
  api.saveTemplate = async next => { saves++; stored = next; return { ...entity, template: next } }
  const props = reactive({ editable: true }); const view = mount(Manager, props)
  const selectInput = async () => { const button = nodes(view.root, 'button').find(node => node.props['data-node'] === 'input-0'); button.props.onClick({ currentTarget: button }); await flush() }
  try {
    await flush(); await click(findText(view.root, 'button', 'Temperature')); await selectInput()
    nodes(view.root, 'a-input').find(node => node.props.value === 'Winding').props['onUpdate:value']('Changed'); await flush()
    assert.equal(findText(view.root, 'a-button', 'save').props.disabled, true)
    await click(findText(view.root, 'a-button', 'nextNode'))
    nodes(view.root, 'a-input').find(node => node.props.value === 'Ambient').props['onUpdate:value']('Room'); await flush()
    await click(findText(view.root, 'a-button', 'cancel')); assert.ok(findText(view.root, 'button', 'Winding')); assert.equal(saves, 0)
    await selectInput(); nodes(view.root, 'a-input').find(node => node.props.value === 'Winding').props['onUpdate:value']('New winding'); await flush()
    await click(findText(view.root, 'a-button', 'finishEditing')); await click(findText(view.root, 'a-button', 'save'))
    assert.equal(stored.inputDefinitions[0].name, 'New winding'); assert.equal(stored.outputs[0].persist, false); assert.equal(saves, 1)
    await selectInput(); props.editable = false; await flush()
    assert.equal(findText(view.root, 'a-input', 'New winding'), undefined)
    assert.equal(findText(view.root, 'a-button', 'save'), undefined)
    props.editable = true; await flush()
    nodes(view.root, 'a-tabs')[0].props['onUpdate:activeKey']('simulation'); await flush()
    props.editable = false; await flush(); assert.equal(nodes(view.root, 'a-tabs')[0].props['active-key'], 'design')
  } finally { view.close(); moduleRegistry.clear() }
})

test('真实值组件格式覆盖与共享质量/实际区间不被专用内容遮蔽', async () => {
  const Value = load('components/Metric/MetricValue.vue').default
  const props = reactive({ value: { ...value, inputTimeStart: 100, inputTimeEnd: 200, evaluationTime: 300, quality: { valid: true, coverage: 0 } }, unit: 'kW', settings: { decimals: 2 }, compact: true, disabled: false })
  const view = mount(Value, props)
  try {
    await flush(); assert.ok(textContent(view.root).includes('5.82')); assert.ok(textContent(view.root).includes('inputRange'))
    props.compact = false; await flush(); assert.ok(textContent(view.root).includes('coverage')); assert.ok(textContent(view.root).includes('updatedAt'))
    props.value = { ...value, value: 0, quality: {} }; await flush(); assert.ok(textContent(view.root).includes('0.00'))
    props.value = { ...value, value: false, unit: undefined }; await flush(); assert.ok(textContent(view.root).includes('false'))
    props.value = { ...value, status: 'invalid' }; await flush(); assert.ok(textContent(view.root).includes('—'))
    props.value = { ...value, quality: { valid: false } }; await flush(); assert.ok(textContent(view.root).includes('—'))
    props.disabled = true; await flush(); assert.ok(textContent(view.root).includes('disabled'))
    props.disabled = false; props.compact = true; props.value = { metricId: 'value', value: 1 }; await flush(); assert.ok(textContent(view.root).includes('inputTimeUnknown'))
    props.value = undefined; await flush(); assert.ok(textContent(view.root).includes('waiting'))
  } finally { view.close() }
})


test('真实Panel轮询展示服务端过期与独立装载反馈，旧值和真实时间保留；同ID重试服从维护权限', async () => {
  defaults(); moduleRegistry.clear()
  const props = reactive({ context: { ownerType: 'line', ownerId: 'a', editable: true } })
  let runtime = { nodeId: 'node-a', state: 'loaded', lastSuccessTime: 100 }
  let observed = { ...value, quality: { valid: true, attributes: { validUntil: 2000 } } }
  let empty = false
  const saved = []
  api.latest = async ids => ids.map(configId => ({ configId, outputs: empty ? {} : { value: observed }, ...(runtime ? { runtime } : {}) }))
  api.saveConfig = async next => { saved.push(next); runtime = { nodeId: 'node-a', state: 'loaded', lastSuccessTime: 300 }; return next }
  const view = mount(Panel, props)
  const card = () => nodes(view.root, 'button').find(node => node.props.class?.includes('metric-panel__card'))
  const refresh = () => click(findText(view.root, 'a-button', 'refresh'))
  try {
    await flush()
    assert.ok(textContent(card()).includes('valid'))
    assert.equal(textContent(card()).includes('runtimeLoaded'), false)
    observed = { ...observed, quality: { ...observed.quality, stale: true } }
    await refresh()
    assert.ok(textContent(card()).includes('inputExpired'))
    assert.ok(textContent(card()).includes('6'))
    assert.ok(textContent(card()).includes(new Date(1000).toLocaleString()))
    assert.equal(observed.eventTime, 1000)
    runtime = { nodeId: 'node-a', state: 'pending' }; await refresh()
    assert.ok(textContent(card()).includes('runtimePending'))
    assert.ok(textContent(card()).includes('lastResult'))
    assert.ok(textContent(card()).includes('inputExpired'))
    runtime = { nodeId: 'node-a', state: 'failed', lastSuccessTime: 100, lastFailureTime: 200, errorCode: 'load_failed' }; await refresh()
    assert.ok(textContent(card()).includes('runtimeFailed'))
    assert.ok(textContent(card()).includes('inputExpired'))
    await click(card())
    assert.ok(textContent(view.root).includes('node-a'))
    assert.ok(textContent(view.root).includes('runtimeLastFailure'))
    assert.ok(textContent(view.root).includes('load_failed'))
    const retry = findText(view.root, 'a-button', 'retryLoad')
    assert.ok(retry)
    props.context = { ...props.context, editable: false }; await flush()
    assert.equal(findText(view.root, 'a-button', 'retryLoad'), undefined)
    await retry.props.onClick(); await flush(); assert.equal(saved.length, 0)
    props.context = { ...props.context, editable: true }; await flush()
    await click(card())
    await click(findText(view.root, 'a-button', 'retryLoad'))
    assert.equal(saved.length, 1)
    assert.deepEqual(saved[0], config)
    assert.equal(textContent(card()).includes('runtimeLoaded'), false)
    assert.equal(findText(view.root, 'a-button', 'retryLoad'), undefined)
    assert.equal(textContent(view.root).includes('runtimeFailed'), false)
    runtime = undefined; await refresh()
    assert.ok(textContent(card()).includes('runtimeUnknown'))
    assert.ok(textContent(card()).includes('inputExpired'))
    runtime = { nodeId: 'node-a', state: 'loaded' }; empty = true; await refresh()
    assert.ok(textContent(card()).includes('waiting'))
    assert.ok(textContent(card()).includes('runtimeLoaded'))
    runtime = { nodeId: 'node-a', state: 'failed' }; await refresh()
    assert.ok(textContent(card()).includes('runtimeFailed'))
    assert.equal(textContent(card()).includes('waiting'), false)
  } finally { view.close(); moduleRegistry.clear() }
})


test('真实详情接受较新面板快照，迟到拒权不锁死刷新；真正新拒权隐藏结果，后续授权快照恢复', async () => {
  defaults(); moduleRegistry.clear()
  const Result = load('components/Metric/MetricResult.vue').default
  let finishOld; let calls = 0
  api.latest = async () => { calls++; return calls === 1 ? new Promise(resolve => { finishOld = resolve }) : [] }
  const snapshot = number => ({ configId: 'c', outputs: { value: { ...value, value: number } }, runtime: { nodeId: 'node-a', state: 'loaded' } })
  const props = reactive({ reference: { configId: 'c', outputId: 'value' }, output: template.outputs[0], template, context: { ownerType: 'line', ownerId: 'a' }, latest: undefined })
  const view = mount(Result, props)
  const denied = () => nodes(view.root, 'a-alert').some(node => node.props.message === 'noAccess')
  const shownValue = () => textContent(nodes(view.root, 'strong')[0])
  try {
    await flush(); props.latest = snapshot(2); await flush()
    assert.equal(Number(shownValue()), 2); assert.equal(denied(), false)
    finishOld([]); await flush()
    assert.equal(denied(), false); assert.equal(Number(shownValue()), 2)
    assert.ok(findText(view.root, 'a-button', 'refresh'))
    props.latest = snapshot(3); await flush()
    assert.equal(Number(shownValue()), 3); assert.equal(denied(), false)
    await click(findText(view.root, 'a-button', 'refresh'))
    assert.equal(denied(), true); assert.equal(nodes(view.root, 'strong').length, 0)
    assert.equal(textContent(view.root).includes('node-a'), false)
    props.latest = snapshot(4); await flush()
    assert.equal(denied(), false); assert.equal(Number(shownValue()), 4)
    assert.ok(findText(view.root, 'a-button', 'refresh'))
  } finally { view.close(); moduleRegistry.clear() }
})
