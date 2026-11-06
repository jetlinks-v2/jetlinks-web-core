import assert from 'node:assert/strict'
import test from 'node:test'
import { defineComponent, h, onUnmounted, reactive, ref, nextTick } from 'vue'
import { useEventListener } from '@vueuse/core'
import { theme } from 'ant-design-vue'
import { resolve } from 'node:path'
import { createMetricLoader, createMetricRenderer, flush, walk, textContent, sourceRoot } from './helpers/metricRuntime.mjs'
const api = {}
const confirmations = []
const workspaceWidth = ref(1200)
const load = createMetricLoader({
  '@vueuse/core': { useEventListener, useElementSize: () => ({ width:workspaceWidth, height:ref(800) }) },
  '@jetlinks-web/vite/dist/dynamic-remote': { dynamicRemoteManager: {} },
  '@jetlinks-web-core/utils/consts': { isSubApp: false },
  'vue-i18n': { useI18n: () => ({ t: key => key, locale: { value: 'zh' } }) },
  'ant-design-vue': { theme, Modal: { confirm: value => { confirmations.push(value);return { destroy() {} } } } },
  [resolve(sourceRoot, 'components/Editable/index.vue')]: { __esModule:true, default:defineComponent({ setup:(_, { attrs, slots, expose }) => { expose({ edit:async () => {} }); return () => h('external-shell', attrs, Object.values(slots).flatMap(slot => slot?.())) } }) },
  [resolve(sourceRoot, 'components/Metric/api.ts')]: { metricApi: api },
  [resolve(sourceRoot, 'components/ConditionFilter/index.ts')]: { __esModule:true, default:defineComponent({ props:['modelValue','fields'], setup:(props,{emit})=>()=>h('condition-filter',{...props,'onUpdate:modelValue':value=>emit('update:modelValue',value)}) }) },
  [resolve(sourceRoot, 'components/Echarts/index.ts')]: { __esModule: true, default: defineComponent({ props: ['option','events'], setup: props => () => h('chart', { option: props.option, events:props.events }) }) },
})
const { moduleRegistry } = load('utils/module-registry.ts')
const Workspace = load('components/Metric/workspace/MetricWorkspace.vue').default
const WorkspaceNavigation = load('components/Metric/workspace/MetricWorkspaceNavigation.vue').default
const Panel = load('components/Metric/MetricPanel.vue').default
const Editor = load('components/Metric/MetricConfigEditor.vue').default
const Manager = load('components/Metric/template/MetricTemplateManager.vue').default
const DisplayFields = load('components/Metric/extensions/MetricDisplayFields.vue').default
const Trend = load('components/Metric/MetricTrend.vue').default
const OutputSwitch = load('components/Metric/MetricOutputSwitch.vue').default
const Graph = load('components/Metric/template/TemplateGraph.vue').default
const Lineage = load('components/Metric/MetricLineage.vue').default
const template = { id: 'power', version: '1', name: 'Power', outputs: [{ metricId: 'value', label: 'Consumption', unit: 'kW', publish: true }], inputDefinitions: [], parameterDefinitions: [{ id: 'factor', expands: { editable: true } }], parameters: { factor: 1 }, definitions: [], options: { presentation: { provider: 'line/status', settings: { decimals: 2, warning: true } } } }
const config = { id: 'c', name: 'Room', ownerType: 'line', ownerId: 'a', targetType: 'line', targetId: 'a', slot: 'c', templateId: 'power', templateVersion: '1', inputMappings: {}, parameters: {}, presentation: { decimals: 0, warning: false, unknown: 7 }, state: 'enabled', revision: 2, dataVersion: 'same' }
const value = { metricId: 'value', value: 5.815, unit: 'kW', eventTime: 1000, quality: { valid: true } }
const controls = ['a-space','a-button','a-select','a-select-option','a-alert','a-spin','a-empty','a-tag','a-dropdown','a-menu','a-menu-item','a-steps','a-form','a-form-item','a-input','a-input-number','a-descriptions','a-descriptions-item','a-popconfirm','a-collapse','a-collapse-panel','a-radio-group','a-radio-button','a-range-picker','a-pagination','a-segmented','a-tabs','a-tab-pane','a-checkbox','a-switch']
function mount(component, props = {}) {
  const previousDocument = globalThis.document
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }
  const { renderer, root } = createMetricRenderer()
  const app = renderer.createApp({ setup: () => () => h(component, props) })
  for (const name of controls) app.component(name, defineComponent({ inheritAttrs: false, setup: (_props, { attrs, slots }) => () => h(name, attrs, Object.entries(slots).flatMap(([key, slot]) => key === 'option' ? [] : slot?.())) }))
  app.component('a-drawer', defineComponent({ props:['open','forceRender'], inheritAttrs:false, setup:(props,{attrs,slots})=>()=>h('a-drawer', { ...attrs, open:props.open }, props.open || props.forceRender ? slots.default?.() : []) }))
  app.config.warnHandler = () => {}
  app.mount(root)
  return { root, close() { app.unmount(); globalThis.document = previousDocument } }
}
const nodes = (root, type) => walk(root, node => node.type === type)
const findText = (root, type, text) => nodes(root, type).find(node => node.props['aria-label'] === text)
  || nodes(root, type).find(node => textContent(node).includes(text) || node.props['aria-label']?.includes(text))
const click = async node => { assert.ok(node); await node.props.onClick?.(); await flush() }
function defaults() {
  Object.assign(api, { templateCategories: async () => [], calculators: async () => [], byOwner: async () => [config], configTemplate: async () => template,
    latest: async ids => ids.map(configId => ({ configId, outputs: { value } })), getConfig: async () => config,
    history: async () => [value], selectable: async () => [{ id: 't', name: 'Power', available: true, released: true, template }],
    saveConfig: async next => ({ ...next, revision: next.revision + 1 }), queryTemplates: async () => ({ data: [], total: 0 }) })
}

test('维度入口显示业务注册图标，旧扩展回退通用图标并保持选择事件', async () => {
  const navigator = defineComponent({ setup: () => () => h('navigator') })
  const dimensions = [{ moduleId:'custom', provider:{ ownerType:'line', label:'Line', icon:'PartitionOutlined', navigator } }, { moduleId:'legacy', provider:{ ownerType:'area', label:'Area', navigator } }]
  const chosen = []
  const props = reactive({ scopeKey:'icons', dimensions, dimension:dimensions[0], selection:{ ownerType:'line', ownerId:'a' }, onDimension:value=>chosen.push(value) })
  const view = mount(WorkspaceNavigation, props)
  const icon = () => walk(view.root, node => node.props.class === 'metric-navigation__icon')[0]
  try {
    assert.equal(icon().props.type, 'PartitionOutlined')
    const select = nodes(view.root, 'a-select')[0]
    assert.equal(select.props['option-label-prop'], 'label')
    select.props['onUpdate:value']('area')
    assert.deepEqual(chosen, ['area'])
    props.dimension = dimensions[1]; props.selection = { ownerType:'area', ownerId:'b' }; await flush()
    assert.equal(icon().props.type, 'AppstoreOutlined')
    assert.equal(nodes(view.root, 'a-select-option')[1].props.label, 'Area')
  } finally { view.close() }
})

test('相同对象上下文重新渲染保留结果、草稿与在途请求，仅对象身份变化重新加载', async () => {
  defaults(); moduleRegistry.clear()
  const props = reactive({ context:{ ownerType:'line', ownerId:'a', label:'Line A', editable:true } })
  let queries = 0, release
  api.byOwner = async () => { queries++; return new Promise(resolve => { release = resolve }) }
  const view = mount(Panel, props)
  try {
    await flush(); assert.equal(queries, 1)
    props.context = { ...props.context, label:'Renamed line' }; await flush()
    assert.equal(queries, 1)
    release([config]); await flush()
    assert.equal(nodes(view.root, 'article').length, 1)
    await click(findText(view.root, 'a-button', 'edit'))
    const editor = nodes(view.root, 'external-shell').find(node => node.props.open)
    assert.equal(editor.props.open, true)
    props.context = { ...props.context }; await flush()
    assert.equal(queries, 1)
    assert.equal(nodes(view.root, 'external-shell').some(node => node.props.open), true)
    props.context = { ...props.context, editable:false }; await flush()
    assert.equal(queries, 1)
    assert.equal(nodes(view.root, 'external-shell').some(node => node.props.open), false)
    props.context = { ...props.context, ownerId:'b' }; await flush()
    assert.equal(queries, 2)
    assert.equal(nodes(view.root, 'article').length, 0)
    release([]); await flush()
    props.context = { ...props.context, ownerType:'area' }; await flush()
    assert.equal(queries, 3)
    release([]); await flush()
  } finally { view.close(); moduleRegistry.clear() }
})

test('跨日缩略趋势显示日期，避免24小时两端同一时刻产生歧义', () => {
  const start = new Date(2026, 10, 3, 9).getTime(), end = new Date(2026, 10, 4, 9).getTime()
  const view = mount(Trend, { compact: true, values: [{ ...value, evaluationTime: end }], bounds: [start, end] })
  try {
    const labels = nodes(view.root, 'time').map(textContent)
    assert.equal(labels.length, 2)
    assert.notEqual(labels[0], labels[1])
  } finally { view.close() }
})

test('缩略趋势悬停展示真实时间与读数，离开后收起；密集样本只保留峰值和一个悬停标记', async () => {
  const rows = Array.from({ length:200 },(_,i) => ({ ...value, value:i, evaluationTime:1000+i }))
  const view = mount(Trend, { compact:true, values:rows, bounds:[1000,1199], unit:'kW' })
  try {
    const plot = walk(view.root,node => node.props.class === 'metric-trend-mini__plot')[0]
    const peak = walk(view.root,node => node.props.class === 'metric-trend-mini__peak')[0]
    assert.ok(peak.props['aria-label'].includes('samplePeak')); assert.ok(peak.props.title.includes('199 kW'))
    plot.props.onPointermove({ clientX:150, currentTarget:{ getBoundingClientRect:() => ({ left:0,width:300 }) } }); await flush()
    const tip = walk(view.root,node => node.props.role === 'tooltip')[0]
    assert.ok(tip); assert.ok(textContent(tip).includes('99 kW'))
    assert.equal(nodes(view.root,'circle').length,1)
    plot.props.onPointermove({ clientX:296, currentTarget:{ getBoundingClientRect:() => ({ left:0,width:300 }) } }); await flush()
    assert.ok(textContent(walk(view.root,node => node.props.role === 'tooltip')[0]).includes('samplePeak'))
    plot.props.onPointerleave(); await flush()
    assert.equal(walk(view.root,node => node.props.role === 'tooltip').length,0)
    assert.equal(nodes(view.root,'circle').length,0)
  } finally { view.close() }
})

test('数字枚举状态使用有界的状态采样色带，详情复用离散时间轴；普通评分仍用数值趋势', () => {
  const rows = Array.from({length:200},(_,index) => ({...value,value:index % 3,evaluationTime:1000 + index,resultId:String(index)}))
  const labels = [{value:0,name:'正常',icon:'color:#22c55e'},{value:1,name:'异常',icon:'color:#ff4d4f'},{value:2,name:'等待',icon:'font:ClockCircleOutlined'}]
  const view = mount(Trend,{compact:true,values:rows,bounds:[1,3600000],labels})
  try {
    const strip = walk(view.root,node => node.props.class === 'state-samples__strip')[0]
    assert.ok(strip)
    assert.equal(strip.children.filter(node => node.type === 'span').length,60,'many metrics must not render every historical sample')
    assert.equal(nodes(view.root,'path').length,0,'numeric state codes are not connected by a numeric line')
    assert.ok(strip.children.some(node => node.props.style?.background === '#22c55e'))
  } finally {view.close()}
  const detail = mount(Trend,{values:rows,bounds:[1,3600000],labels})
  try {
    const option=nodes(detail.root,'chart')[0].props.option
    assert.equal(option.series[0].type,'custom');assert.equal(option.series[1].data.length,0)
  } finally {detail.close()}
  const score = mount(Trend,{compact:true,values:rows})
  try {assert.ok(walk(score.root,node => node.props.class === 'metric-trend-mini__plot').length)} finally {score.close()}
})

test('结果切换菜单以语义区分图标，保留当前选中项和切换事件', async () => {
  const outputs = [{metricId:'state',label:'连接状态',metricKind:'state',valueType:'int'},
    {metricId:'score',label:'评分',metricKind:'score'}, {metricId:'ratio',label:'在线率',unit:'%'},
    {metricId:'duration',label:'离线时长',unit:'s'}, {metricId:'tracked',label:'本次状态',valueType:'int'}]
  const spec={...template,outputs,definitions:[{id:'tracked',stateTracking:{}}]}
  const chosen=[]
  const view=mount(OutputSwitch,{template:spec,output:outputs[0],outputId:'state',onChange:id=>chosen.push(id)})
  try {
    const options=nodes(view.root,'external-shell').filter(node=>node.props.icon)
    assert.deepEqual(options.map(node=>node.props.icon),['SwitcherOutlined','DashboardOutlined','PercentageOutlined','ClockCircleOutlined','FieldTimeOutlined'])
    const menu=nodes(view.root,'a-menu')[0]
    assert.deepEqual(menu.props['selected-keys'],['state'])
    await menu.props.onClick({key:'duration'});await flush()
    assert.deepEqual(chosen,['duration'])
  } finally {view.close()}
})

test('声明枚举沿用状态图；文本与对象仅展示真实记录，不显示缩放操作', () => {
  for (const valueType of ['string','object']) {
    const raw=valueType==='object' ? {temperature:26} : 'ready'
    const view=mount(Trend,{output:{metricId:'v',valueType},values:[{metricId:'v',value:raw,evaluationTime:1000}],bounds:[0,2000]})
    try {
      assert.equal(nodes(view.root,'chart').length,0)
      assert.equal(nodes(view.root,'article').length,1)
      assert.ok(textContent(view.root).includes(valueType==='object' ? 'temperature' : 'ready'))
      assert.equal(nodes(view.root,'a-button').filter(node=>['historyBrush','historyResetFocus','historyOverview'].includes(node.props['aria-label'])).length,0)
    } finally {view.close()}
    const compact=mount(Trend,{compact:true,output:{metricId:'v',valueType},values:Array.from({length:200},(_,index)=>({metricId:'v',value:raw,evaluationTime:1000+index}))})
    try {
      const preview=walk(compact.root,node=>node.props.class==='metric-trend-mini__records')[0]
      assert.ok(preview);assert.equal(preview.children.filter(node=>node.type==='div').length,2)
      assert.equal(textContent(compact.root).includes('noHistory'),false)
      assert.equal(nodes(compact.root,'svg').length,0)
    } finally {compact.close()}
  }
  const view=mount(Trend,{output:{metricId:'v',valueType:'enum'},values:[{metricId:'v',value:3,evaluationTime:1000}],bounds:[0,2000]})
  try {assert.equal(nodes(view.root,'chart')[0].props.option.series[0].type,'custom')} finally {view.close()}
})

test('查询达到上限时仅缩略图采用返回样本范围，详情保留完整查询范围；布尔样本按状态合并刻度路径', () => {
  const rows = Array.from({ length: 200 }, (_, index) => ({ ...value, value: index > 100, evaluationTime: 1000 + index }))
  const compact = mount(Trend, { compact: true, values: rows, bounds: [1, 3600000], limited: true })
  try {
    const text = textContent(compact.root)
    assert.equal(text.includes('resultsLimit'), false, 'query limit stays out of the main content')
    const hint = nodes(compact.root, 'a-tooltip').find(node => node.props.title === 'trendSampleRangeHint')
    assert.deepEqual(hint.props.trigger, ['hover', 'click'])
    assert.equal(walk(compact.root, node => node.props.class === 'metric-trend-mini__scope').length, 0)
    const axis = walk(compact.root, node => node.props.class?.includes('metric-trend-mini__times'))[0]
    let stopped = false
    axis.props.onClick({ stopPropagation: () => { stopped = true } })
    assert.ok(stopped, 'opening the range hint must not open the metric drawer')
    assert.equal(nodes(compact.root, 'circle').length, 0)
    assert.equal(nodes(compact.root, 'path').filter(node => node.props.class?.includes('metric-trend-mini__marks')).length, 2)
    assert.equal(nodes(compact.root, 'time').map(textContent)[1], new Date(1199).toLocaleString('zh', { hour: '2-digit', minute: '2-digit' }))
  } finally { compact.close() }
  const detail = mount(Trend, { values: rows, bounds: [1, 3600000], limited: true })
  try {
    const option=nodes(detail.root,'chart')[0].props.option
    assert.equal(option.series[0].type,'custom','boolean facts retain discrete marks, not a numeric scatter plot')
    assert.equal(option.series[0].data.length,200)
    assert.equal(option.series[1].data.length,0,'boolean samples never fill gaps as continuous states')
    assert.equal(option.xAxis.min,1);assert.equal(option.xAxis.max,3600000)
    assert.deepEqual(option.series[0].data.map(point=>point.value[0]),rows.map(point=>point.evaluationTime))
    assert.ok(nodes(detail.root, 'a-tooltip').some(node => node.props.title?.includes('resultsLimit')))
  } finally { detail.close() }
})

test('布尔详情在空刷新帧中保留时间轴和固定身份，恢复后仍展示同一条记录', async () => {
  const rows = [{ ...value, resultId:'a', value:false, evaluationTime:1000 }, { ...value, resultId:'b', value:true, evaluationTime:2000 }]
  const props = reactive({ values:rows, current:rows[1], bounds:[0,3000] })
  const view = mount(Trend, props)
  try {
    const plot = walk(view.root,node=>node.props.class?.includes('history-timeline__plot'))[0]
    plot.props.onKeydown({ key:'Home', preventDefault() {} }); await flush()
    props.values = []; props.current = undefined; await flush()
    assert.ok(textContent(view.root).includes('historySelectionMissing'))
    props.values = [...rows,{ ...value,resultId:'c',value:true,evaluationTime:2500 }]; await flush()
    const record = walk(view.root,node=>node.props.class === 'history-record')[0]
    assert.ok(textContent(record).includes('conditionFalse'))
    assert.ok(nodes(record,'a-button').some(node=>node.props['aria-label']==='historyUnpin'))
    assert.equal(textContent(record).includes('historySelectionMissing'),false)
  } finally { view.close() }
})

test('来源详情仅展示当前输出实际引用的输入与计算，不夹带其他输出的来源', async () => {
  const spec = { ...template, inputDefinitions: [{ id: 'cpu', name: 'CPU' }, { id: 'unused', name: 'Unrelated sensor' }],
    definitions: [{ id: 'score', name: 'Pressure', type: 'composite', expression: 'cpu * 2', dependsOn: ['cpu'] }, { id: 'other', name: 'Other result', type: 'composite', expression: 'unused', dependsOn: ['unused'] }],
    outputs: [{ metricId: 'score', label: 'Pressure', persist: true }, { metricId: 'other', label: 'Other result' }] }
  const configuration = { ...config, inputMappings: { cpu: { kind: 'property', thingId: 'a', id: 'cpuSystemUsage' } } }
  const view = mount(Lineage, { configuration, template: spec, output: spec.outputs[0], context: { ownerType: 'device', ownerId: 'a', label: 'Mac' } })
  try {
    await flush()
    const text = textContent(view.root)
    assert.ok(text.includes('Mac / CPU')); assert.ok(text.includes('Pressure')); assert.ok(text.includes('outputHistory'))
    assert.equal(text.includes('Unrelated sensor'), false); assert.equal(text.includes('Other result'), false)
  } finally { view.close() }
})

test('历史读取失败保留最新值，避免同时展示无历史的误导空态；重试恢复', async () => {
  defaults(); moduleRegistry.clear()
  api.history = async () => { throw new Error('history unavailable') }
  const view = mount(Panel, { context: { ownerType: 'line', ownerId: 'a' } })
  try {
    await flush()
    await click(nodes(view.root, 'button').find(node => node.props.class?.includes('metric-panel__card')))
    assert.ok(nodes(view.root, 'strong').some(node => textContent(node) === '6'))
    assert.ok(nodes(view.root, 'a-alert').some(node => node.props.description === 'history unavailable'))
    assert.equal(nodes(view.root, 'a-empty').some(node => node.props.description === 'noHistory'), false)
    api.history = async () => [value]
    await click(findText(view.root, 'a-button', 'retry'))
    assert.equal(nodes(view.root, 'a-alert').some(node => node.props.description === 'history unavailable'), false)
    assert.equal(nodes(view.root, 'chart').length, 1)
  } finally { view.close() }
})

test('卡片与编辑使用配置名称和模板图标，实时值类型变化不改变身份，详情保留输出名称', async () => {
  defaults(); moduleRegistry.clear()
  const declared = { ...template, options:{ icon:'DashboardOutlined' } }
  let current = value
  api.configTemplate = async () => declared
  api.latest = async ids => ids.map(configId => ({ configId, outputs:{ value:current } }))
  const view = mount(Panel, { context:{ ownerType:'line', ownerId:'a', editable:true } })
  const header = () => walk(view.root, node => node.props.class === 'metric-panel__card-head')[0]
  const icon = () => walk(header(), node => node.props.type === 'DashboardOutlined')[0]
  try {
    await flush()
    assert.equal(textContent(walk(header(), node => node.props.class === 'metric-panel__name')[0]), 'Room')
    assert.ok(icon())
    const card = nodes(view.root, 'button').find(node => node.props.class?.includes('metric-panel__card'))
    assert.equal(card.props['aria-label'], 'Room')
    current = { ...value, value:false, evaluationTime:2000 }
    await click(findText(view.root, 'a-button', 'refresh'))
    assert.ok(icon()); assert.equal(nodes(view.root, 'article')[0].children.includes(header()), true)
    await click(card)
    const drawer = nodes(view.root, 'external-shell').find(node => node.props.open)
    assert.equal(drawer.props.title, 'Room'); assert.equal(drawer.props.sub, 'Room')
    await click(findText(header(), 'a-button', 'edit'))
    const title = walk(view.root, node => node.props.class === 'config-head__title')[0]
    assert.ok(walk(title, node => node.props.type === 'DashboardOutlined').length)
    assert.ok(nodes(title, 'external-shell').some(node => node.props.value === 'Room'))
  } finally { view.close(); moduleRegistry.clear() }
})

test('关系图选中与键盘焦点控制连线，重绘后保留节点和内部滚动位置', async () => {
  const model = reactive({ template:{ ...template, inputDefinitions:[{ id:'input', name:'Input' }], definitions:[{ id:'value', expression:'input * 2', dependsOn:['input'] }] }, selected:{ kind:'rule', index:0 } })
  const view = mount(Graph, model)
  const active = () => nodes(view.root,'path').filter(node => node.props.class?.includes('active'))
  const flowing = () => nodes(view.root,'path').filter(node => node.props.class === 'template-graph__flow')
  try {
    const viewport = walk(view.root, node => node.props.class === 'template-graph')[0]
    viewport.scrollTop = 125; viewport.scrollLeft = 90
    const rule = nodes(view.root,'button').find(node => node.props['data-node'] === 'rule-0')
    assert.equal(active().length, 2)
    assert.equal(flowing().length, 2)
    const input = nodes(view.root,'button').find(node => node.props['data-node'] === 'input-0')
    input.parent.props.onFocusin(); await flush(); assert.equal(active().length, 1)
    input.parent.props.onFocusout(); await flush(); assert.equal(active().length, 2)
    model.template = { ...model.template, name:'Renamed' }; await flush()
    assert.equal(nodes(view.root,'button').find(node => node.props['data-node'] === 'rule-0'), rule)
    assert.equal(viewport.scrollTop, 125); assert.equal(viewport.scrollLeft, 90)
    assert.equal(active().length, 2)
    model.selected = undefined; await flush(); assert.equal(flowing().length, 0)
    input.parent.props.onFocusin(); await flush(); assert.equal(active().length, 1); assert.equal(flowing().length, 0)
  } finally { view.close() }
})

test('同一配置聚合主辅输出，辅助值仍有独立详情与关闭回焦', async () => {
  defaults(); moduleRegistry.clear()
  const multi = { ...template, options: { presentation: { settings: { primaryOutput: 'duration' } } },
    outputs: [{ metricId: 'coverage', label: 'Coverage', unit: '%' }, { metricId: 'duration', label: 'Runtime', unit: 'min' }] }
  api.configTemplate = async () => multi
  api.latest = async ids => ids.map(configId => ({ configId, outputs: { duration: { ...value, metricId: 'duration', unit: 'min' }, coverage: { ...value, metricId: 'coverage', value: 90, unit: '%' } } }))
  const view = mount(Panel, { context: { ownerType: 'line', ownerId: 'a' } })
  try {
    await flush()
    const primary = nodes(view.root, 'button').filter(node => node.props.class?.includes('metric-panel__card'))
    const secondary = nodes(view.root, 'button').filter(node => node.props.class === 'metric-panel__secondary')
    assert.equal(primary.length, 1); assert.equal(secondary.length, 1)
    assert.equal(primary[0].props['aria-label'], 'Room')
    assert.ok(textContent(secondary[0]).includes('Coverage'))
    assert.ok(textContent(secondary[0]).includes('90'))
    await click(secondary[0])
    const drawer = nodes(view.root, 'external-shell').find(node => node.props.open)
    assert.equal(drawer.props.title, 'Room')
    drawer.props['onUpdate:open'](false); await flush()
    drawer.props.onAfterOpenChange(false)
    assert.deepEqual(secondary[0].focused, { preventScroll: true })
    api.latest = async () => { throw new Error('read timeout') }
    await click(nodes(view.root, 'a-button').find(node => node.props['aria-label'] === 'refresh'))
    const failedSecondary = nodes(view.root, 'button').find(node => node.props.class === 'metric-panel__secondary')
    assert.equal(failedSecondary.props.disabled, true)
    assert.ok(textContent(failedSecondary).includes('readFailed'))
    assert.equal(textContent(failedSecondary).includes('disabled'), false)
    assert.equal(textContent(failedSecondary).includes('90'), false, 'failed reads do not expose the previous value')
  } finally { view.close() }
})

test('主要结果编辑保留已有显示扩展与数值精度', async () => {
  const changes = []
  const view = mount(DisplayFields, { modelValue: { decimals: 0, custom: false }, template: { ...template, outputs: [...template.outputs, { metricId: 'quality', label: 'Quality' }] },
    'onUpdate:modelValue': next => changes.push(next) })
  try {
    await flush()
    const select = nodes(view.root, 'a-select').find(node => node.props['aria-label'] === 'primaryOutput')
    assert.equal(select.props.value, 'value')
    select.props['onUpdate:value']('quality')
    assert.deepEqual(changes.at(-1), { decimals: 0, custom: false, primaryOutput: 'quality' })
  } finally { view.close() }
})

test('状态卡收敛为主结果与两项摘要，完整输出仍可在原详情切换并回焦', async () => {
  defaults(); moduleRegistry.clear()
  const outputs = ['state','one','two','three','four','five'].map(metricId => ({ metricId, label:metricId }))
  api.configTemplate = async () => ({ ...template, outputs, definitions:[{ id:'state', stateTracking:{} }], options:{ presentation:{ settings:{ summaryOutputs:['two','three'] } } } })
  const now = Date.now(), startTime = now - 15000
  const snapshot = { ...value, metricId:'state', value:2, evaluationTime:now - 5000, state:{ duration:10, currentInterval:{ id:'state-a', value:2, startTime, startKnown:true, observedUntil:startTime, validUntil:now + 60000 }, readView:{ time:now, duration:15 } } }
  api.latest = async ids => ids.map(configId => ({ configId, outputs:{ state:snapshot, ...Object.fromEntries(outputs.slice(1).map(output => [output.metricId, { ...value, metricId:output.metricId }])) } }))
  api.history = async () => [snapshot]
  const view = mount(Panel, { context:{ ownerType:'line', ownerId:'a' } })
  try {
    await flush()
    assert.equal(nodes(view.root, 'button').filter(node => node.props.class === 'metric-panel__secondary').length, 2)
    assert.equal(walk(view.root, node => node.props.class?.includes('interval-history__timeline')).length, 1)
    assert.equal(walk(view.root, node => node.props.class === 'interval-history__record').length, 0, 'card uses a timeline instead of repeated interval rows')
    const primary = nodes(view.root, 'button').find(node => node.props['aria-label'] === 'Room')
    await click(primary)
    const outputNav = nodes(view.root,'a-menu').find(node=>node.props['aria-label']==='allOutputs')
    assert.equal(nodes(outputNav, 'a-menu-item').length, outputs.length)
    outputNav.props.onClick({key:'five'}); await flush()
    const drawer = nodes(view.root, 'external-shell').find(node => node.props.open)
    assert.equal(drawer.props.title, 'Room')
    drawer.props['onUpdate:open'](false); await flush(); drawer.props.onAfterOpenChange(false)
    assert.deepEqual(primary.focused, { preventScroll:true })
  } finally { view.close(); moduleRegistry.clear() }
})

test('摘要编辑支持两项约束、主动留空和继承，保留其他展示设置', async () => {
  const changes = []
  const model = reactive({ modelValue:{ decimals:0, custom:false }, defaults:{ summaryOutputs:['one','two'] }, template:{ ...template, outputs:['main','one','two','three'].map(metricId => ({ metricId, label:metricId })) },
    'onUpdate:modelValue':next => { changes.push(next); model.modelValue = next } })
  const view = mount(DisplayFields, model)
  try {
    await flush()
    const select = () => nodes(view.root, 'a-select').find(node => node.props['aria-label'] === 'summaryOutputs')
    assert.deepEqual(select().props.value, ['one','two'])
    assert.equal(select().props.options.find(option => option.value === 'three').disabled, true)
    select().props['onUpdate:value'](['three']); await flush()
    assert.deepEqual(changes.at(-1), { decimals:0, custom:false, summaryOutputs:['three'] })
    select().props['onUpdate:value']([]); await flush()
    assert.deepEqual(select().props.value, [])
    await click(findText(view.root, 'a-button', 'inheritDisplay'))
    assert.deepEqual(select().props.value, ['one','two'])
  } finally { view.close() }
})

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

test('工作区只装配一个导航；窄屏保留关闭抽屉内的授权确认，撤权销毁导航与来源',async()=>{
  defaults();moduleRegistry.clear()
  const allowed=ref(true)
  let mounted=0,closed=0,sourceClosed=0,confirm
  workspaceWidth.value=0
  moduleRegistry.register('objects',{metricDimensions:{line:{ownerType:'line',label:'Line',available:()=>allowed.value,
    navigator:defineComponent({setup:(_props,{emit})=>{mounted++;confirm=(object,origin)=>emit('select',object,origin);onUnmounted(()=>closed++);return()=>h('navigator')}}),
    useSourcePicker:()=>{onUnmounted(()=>sourceClosed++);return{pickSource:async()=>undefined}},
  }}})
  const view=mount(Workspace,{scopeKey:'narrow/project',selection:{ownerType:'line',ownerId:'a'}})
  try{
    await flush();assert.equal(mounted,0)
    workspaceWidth.value=700;await flush()
    assert.equal(mounted,1);assert.equal(nodes(view.root,'navigator').length,1)
    assert.equal(nodes(view.root,'a-drawer')[0].props.open,false)
    confirm({ownerId:'a',label:'Line A'});await flush()
    assert.ok(textContent(view.root).includes('Line A'))
    await click(findText(view.root,'a-button','selectObject'))
    assert.equal(nodes(view.root,'a-drawer')[0].props.open,true)
    confirm({ownerId:'a',label:'Line A'},'validation');await flush()
    assert.equal(nodes(view.root,'a-drawer')[0].props.open,true)
    confirm({ownerId:'a',label:'Line A'});await flush()
    assert.equal(nodes(view.root,'a-drawer')[0].props.open,false)
    workspaceWidth.value=1200;await flush()
    assert.equal(nodes(view.root,'navigator').length,1);assert.equal(mounted-closed,1)
    allowed.value=false;await flush()
    assert.equal(nodes(view.root,'navigator').length,0);assert.equal(mounted,closed)
    assert.equal(sourceClosed,1)
    assert.equal(textContent(view.root).includes('Line A'),false)
  }finally{view.close();workspaceWidth.value=1200;moduleRegistry.clear()}
})

test('模板筛选空集不显示空库引导，编辑后返回保留分类和搜索且不重新加载目录',async()=>{
  defaults();let reads=0
  api.templateCategories=async()=>[{value:'energy',label:'Energy'},{value:'health',label:'Health'}]
  api.queryTemplates=async()=>{reads++;return{data:[
    {id:'power',released:false,template:{...template,options:{category:'energy'}}},
    {id:'runtime',released:false,template:{...template,id:'runtime',name:'Runtime',options:{category:'health'}}},
  ],total:2}}
  const view=mount(Manager,{editable:true})
  const cards=()=>nodes(view.root,'button').filter(node=>node.props.class==='template-catalog__item')
  try{
    await flush();assert.equal(cards().length,2)
    await click(findText(view.root,'button','Health'));assert.equal(cards().length,1)
    const filter=nodes(view.root,'condition-filter')[0]
    filter.props['onUpdate:modelValue']([{column:'category',termType:'eq',value:'health'},{column:'name',termType:'like',value:'missing'}]);await flush()
    assert.equal(cards().length,0)
    assert.ok(nodes(view.root,'a-empty').some(node=>node.props.description==='noMatchingTemplates'))
    assert.equal(textContent(view.root).includes('startWithScenario'),false)
    await click(findText(view.root,'a-button','clearFilters'));assert.equal(cards().length,2)
    await click(findText(view.root,'button','Health'))
    await click(cards()[0]);assert.equal(nodes(view.root,'a-drawer')[0].props.open,true)
    await click(findText(view.root,'a-button','close'))
    assert.equal(nodes(view.root,'a-drawer')[0].props.open,false)
    assert.equal(cards().length,1);assert.ok(textContent(cards()[0]).includes('Runtime'));assert.equal(reads,1)
  }finally{view.close()}
})

test('真实Panel组合模块卡片和详情；共享单位质量时间保留；卸载/渲染失败回退并可删除跳转', async () => {
  defaults(); moduleRegistry.clear(); let histories = 0; let failedDelete = true
  api.history = async () => { histories++; return [value] }
  api.removeConfig = async () => { if (failedDelete) throw new Error('Referenced'); api.byOwner = async () => [] }
  const card = defineComponent({ props: ['settings'], setup: props => () => h('custom-card', `custom:${props.settings.decimals}:${props.settings.warning}`) })
  const detail = defineComponent({ props: ['values'], setup: props => () => h('custom-detail', `points:${props.values.length}`) })
  moduleRegistry.register('line', { metricPresentations: { status: { label: 'Status', card, detail } } })
  const jumps = []
  const view = mount(Panel, { context: { ownerType: 'line', ownerId: 'a', editable: true }, detailLinkLabel: 'openWorkspace',
    onOpenDetailLink: reference => jumps.push(reference) })
  try {
    await flush(); assert.equal(textContent(nodes(view.root, 'custom-card')[0]), 'custom:0:false')
    assert.ok(textContent(view.root).includes('kW')); assert.ok(nodes(view.root, 'a-tooltip').some(node => node.props.title?.includes('sourceTimeHint') && node.props.title.includes('valid'))); assert.ok(textContent(view.root).includes('sourceTime'))
    assert.equal(histories, 1, 'visible overview loads one shared history')
    await click(nodes(view.root, 'button').find(node => node.props.class?.includes('metric-panel__card')))
    assert.equal(textContent(nodes(view.root, 'custom-detail')[0]), 'points:1'); assert.equal(histories, 1)
    await click(findText(view.root, 'a-button', 'openWorkspace')); assert.equal(jumps[0].configId, 'c')
    assert.equal(findText(view.root, 'a-button', 'createAlarm'), undefined)
    await click(findText(view.root, 'a-menu-item', 'deleteMetric')); assert.equal(confirmations.at(-1).content,'deleteInheritanceHint'); await assert.rejects(confirmations.at(-1).onOk()); await flush()
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
    moduleRegistry.unregister('line'); await flush()
    await click(findText(view.root, 'a-button', 'saveDisable')); assert.equal(stored, undefined)
    moduleRegistry.register('line', { metricPresentations: { status: { label: 'Status' } } }); await flush()
    await click(findText(view.root, 'a-button', 'saveDisable'))
    assert.deepEqual(stored.parameters, { factor: 0 }); assert.equal(stored.revision, 2)
    assert.deepEqual(stored.presentation, config.presentation); assert.equal(savedEvents, 1)
  } finally { view.close(); moduleRegistry.clear() }
})

test('真实Editor恢复参数默认值后保存不携带覆盖，继续跟随绑定模板', async () => {
  defaults(); moduleRegistry.clear(); let stored
  api.configTemplate = async () => ({ ...template, options:{} })
  api.saveConfig = async next => { stored = next; return { ...next, revision:3 } }
  const view = mount(Editor, { context:{ ownerType:'line', ownerId:'a', editable:true }, configuration:{ ...config, parameters:{ factor:0 }, presentation:{} } })
  try {
    await flush()
    const parameter = walk(view.root, node => node.props['data-parameter'] === 'factor')[0]
    assert.ok(parameter)
    assert.ok(textContent(parameter).includes('parameterOverridden'))
    await click(findText(parameter, 'a-button', 'parameterRestoreDefault'))
    assert.ok(textContent(view.root).includes('parameterFollowing'))
    await click(findText(view.root, 'a-button', 'saveDisable'))
    assert.deepEqual(stored.parameters, {})
    assert.equal(config.parameters.factor, undefined)
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
    const saving = findText(view.root, 'a-button', 'saveDisable').props.onClick()
    assert.equal(typeof completeSave, 'function')
    props.context = { ...props.context, ownerId: 'b' }
    await flush()
    await openEditor()
    const readCount = reads
    completeSave()
    await saving
    await flush()
    assert.ok(findText(view.root, 'a-button', 'saveDisable'))
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

test('模板卡片打开全屏编辑，关闭保护草稿且保留首页容器，保存中阻止关闭', async () => {
  defaults()
  const entity = { id:'draft', name:'Power', released:false, available:false, template }
  let writes = 0, finishSave
  api.queryTemplates = async () => ({ data:[entity], total:1 })
  api.saveTemplate = next => { writes++; return new Promise(resolve=>{ finishSave=()=>resolve({ ...entity, template:next }) }) }
  const view = mount(Manager, { editable:true })
  const drawer = () => nodes(view.root,'a-drawer')[0]
  const gallery = () => nodes(view.root,'div').find(node=>node.props.class==='metric-template-manager__gallery')
  const close = () => nodes(view.root,'a-button').find(node=>node.props['aria-label']==='close')
  try {
    await flush()
    const original = gallery()
    assert.equal(drawer().props.open,false)
    assert.equal(nodes(view.root,'nav').length,1)
    await click(findText(original,'button','Power'))
    assert.equal(drawer().props.width,'100%')
    assert.equal(drawer().props.open,true)
    assert.equal(writes,0)
    const identity = nodes(view.root,'external-shell').find(node=>node.props.field==='name')
    identity.props.onChange({ value:'Energy', i18nMessages:{} }); await flush()
    const rejected = close().props.onClick(); await flush()
    confirmations.at(-1).onCancel(); await rejected; await flush()
    assert.equal(drawer().props.open,true)
    const saving = findText(view.root,'a-button','save').props.onClick(); await flush()
    assert.equal(close().props.disabled,true)
    await close().props.onClick(); assert.equal(drawer().props.open,true)
    finishSave(); await saving; await flush()
    await click(close())
    assert.equal(drawer().props.open,false)
    assert.equal(gallery(),original)
    await click(findText(original,'button','Power'))
    nodes(view.root,'external-shell').find(node=>node.props.field==='name').props.onChange({ value:'Discard', i18nMessages:{} }); await flush()
    const accepted = close().props.onClick(); await flush()
    confirmations.at(-1).onOk(); await accepted; await flush()
    assert.equal(drawer().props.open,false)
    assert.equal(writes,1)
    assert.equal(template.name,'Power')
  } finally { view.close() }
})

test('已有模板时首页只展示模板，空库才显示场景创建引导，只读保留空态', async () => {
  defaults()
  const starter = { id:'s', groupId:'energy', group:'Energy', template:{ ...template, name:'Starter' } }
  const props = reactive({ editable:true, starters:[starter] })
  const view = mount(Manager,props)
  const gallery = () => nodes(view.root,'div').find(node=>node.props.class==='metric-template-manager__gallery')
  try {
    await flush()
    assert.ok(textContent(gallery()).includes('startWithScenario'))
    api.queryTemplates = async () => ({ data:[{ id:'t',template,released:false }], total:1 })
    await click(nodes(view.root,'a-button').find(node=>node.props['aria-label']==='refresh'))
    assert.equal(textContent(gallery()).includes('startWithScenario'),false)
    assert.equal(textContent(gallery()).includes('Starter'),false)
    api.queryTemplates = async () => ({ data:[],total:0 })
    props.editable=false
    await click(nodes(view.root,'a-button').find(node=>node.props['aria-label']==='refresh'))
    assert.equal(nodes(gallery(),'a-empty').length,1)
    assert.equal(nodes(gallery(),'button').length,0)
    assert.equal(nodes(view.root,'a-button').some(node=>node.props['aria-label']==='newTemplate'),false)
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

test('模板名称标识版本收进顶部原位编辑，完整配置与只读不暴露双写入口', async () => {
  defaults()
  const entity = { id: 't', name: 'Power', released: false, available: false, template }
  api.queryTemplates = async () => ({ data: [entity], total: 1 })
  let stored
  api.saveTemplate = async next => { stored = next; return { ...entity, name: next.name, template: next } }
  const props = reactive({ editable: true }); const view = mount(Manager, props)
  const header = () => walk(view.root, node => node.type === 'header' && node.props.class === 'template-identity')[0]
  const fields = () => walk(header(), node => node.type === 'external-shell' && (node.props['onUpdate:value'] || node.props.field === 'name') && !node.props.disabled)
  try {
    await flush(); await click(findText(view.root, 'button', 'Power'))
    assert.equal(fields().length, 3)
    assert.equal(nodes(view.root, 'a-collapse-panel').some(node => node.props.header === 'basic'), false)
    fields()[0].props.onChange({ value: 'Energy', i18nMessages: { name: { zh: 'Energy', en: 'Energy use' } } }); await flush()
    fields()[1].props['onUpdate:value']('energy'); await flush()
    fields()[2].props['onUpdate:value']('2'); await flush()
    const stale = fields()[0].props.onChange
    await click(nodes(view.root, 'a-button').find(node => node.props['data-mode'] === 'full'))
    assert.equal(fields().length, 0)
    stale({ value: 'Ignored', i18nMessages: {} }); await flush()
    await click(nodes(view.root, 'a-button').find(node => node.props['data-mode'] === 'form'))
    await click(findText(view.root, 'a-button', 'save'))
    assert.equal(stored.name, 'Energy'); assert.equal(stored.id, 'energy'); assert.equal(stored.version, '2')
    assert.equal(stored.options.i18nMessages.name.en, 'Energy use')
    props.editable = false; await flush(); stale({ value: 'Ignored', i18nMessages: {} }); await flush()
    assert.equal(fields().length, 0); assert.equal(nodes(header(), 'external-shell').find(node => node.props.field === 'name').props.value, 'Energy')
  } finally { view.close() }
})

test('真实模板管理页属性连续编辑进入父草稿，统一保存及撤权边界一致', async () => {
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
    nodes(view.root, 'external-shell').find(node => node.props.value === 'Winding').props['onUpdate:value']('Changed'); await flush()
    assert.equal(findText(view.root, 'a-button', 'save').props.disabled, false)
    await click(nodes(view.root, 'a-button').find(node => node.props['aria-label'] === 'nextNode'))
    nodes(view.root, 'external-shell').find(node => node.props.value === 'Ambient').props['onUpdate:value']('Room'); await flush()
    await click(findText(view.root, 'a-button', 'revertNode')); assert.ok(findText(view.root, 'button', 'Changed')); assert.equal(saves, 0)
    await selectInput(); nodes(view.root, 'external-shell').find(node => node.props.value === 'Changed').props['onUpdate:value']('New winding'); await flush()
    await click(findText(view.root, 'a-button', 'save'))
    assert.equal(stored.inputDefinitions[0].name, 'New winding'); assert.equal(stored.inputDefinitions[1].name, 'Ambient'); assert.equal(stored.outputs[0].persist, false); assert.equal(saves, 1)
    await selectInput(); props.editable = false; await flush()
    assert.equal(findText(view.root, 'a-input', 'New winding'), undefined)
    assert.equal(findText(view.root, 'a-button', 'save'), undefined)
    props.editable = true; await flush()
    assert.ok(findText(view.root, 'a-button', 'simulate'))
    props.editable = false; await flush(); assert.equal(findText(view.root, 'a-button', 'simulate'), undefined)
  } finally { view.close(); moduleRegistry.clear() }
})

test('融合编辑：图内输入、时间轴、配置与结果共存；改值不保存模板且选时刻不执行计算', async () => {
  defaults(); moduleRegistry.clear()
  const content = { ...template, name:'Graph trial', inputDefinitions:[{ id:'reading', name:'Power', valueType:{ type:'double' } }], definitions:[{ id:'mean', name:'Mean', expression:'reading', dependsOn:['reading'] }], outputs:[{ metricId:'mean', label:'Average' }], options:{} }
  api.queryTemplates = async () => ({ data:[{ id:'graph-trial', name:'Graph trial', template:content }], total:1 })
  let calls = 0, finish, sent
  api.simulate = request => { calls++; sent = request; return new Promise(resolve => { finish = resolve }) }
  const view = mount(Manager, reactive({ editable:true }))
  const tabs = () => nodes(view.root, 'a-tabs')[0]
  const graphNode = key => nodes(view.root, 'button').find(node => node.props['data-node'] === key)
  const select = async key => { const node = graphNode(key); node.props.onClick({ currentTarget:node }); await flush() }
  const panel = () => walk(view.root, node => node.props.class === 'template-designer__panel-content')[0]
  try {
    await flush(); await click(findText(view.root, 'button', 'Graph trial'))
    const graph = walk(view.root, node => node.props.class === 'template-graph')[0]
    const mean = graphNode('rule-0'), coordinates = mean.parent.props.style
    assert.equal(nodes(view.root,'a-tab-pane').some(node => node.props.tab === 'simulate'), false)
    graph.scrollTop = 127
    const sampleEditor = () => walk(view.root, node => String(node.props.class).split(' ').includes('sample-editor'))[0]
    await click(nodes(graphNode('input-0').parent,'button').find(node => node.props.class === 'trial-input__add'))
    assert.equal(findText(view.root,'a-button','simulate').props.disabled, true)
    const graphValue = () => nodes(graphNode('input-0').parent,'external-shell').find(node => node.props.type === 'number')
    graphValue().props.onChange(0); await flush()
    await click(findText(sampleEditor(),'a-button','addSample'))
    nodes(sampleEditor(),'external-shell').filter(node => node.props.type === 'number')[1].props.onChange(120); await flush()
    assert.equal(walk(view.root,node => node.props.class === 'metric-template-manager__dirty').length,0)
    await select('input-0'); assert.equal(walk(view.root, node => node.props.class === 'sample-editor__filter').length, 1)
    await click(nodes(view.root,'a-button').find(node => node.props['aria-label'] === 'trialAllInputs'))
    assert.equal(graphNode('input-0').props['aria-pressed'], false)
    await select('rule-0')
    assert.ok(nodes(view.root,'external-shell').some(node => node.props.value === 'Mean'), 'rule remains editable alongside simulation')
    panel().scrollTop = 93
    const run = findText(view.root, 'a-button', 'simulate')
    run.props.onClick(); await flush()
    assert.equal(calls, 1); assert.equal(sent.includeRecords, true); assert.equal(sent.includeIntermediate, true)
    assert.equal(graphValue().props['component-props'].disabled, false, '样本在试算运行时仍可编辑')
    tabs().props['onUpdate:activeKey']('publication'); await flush(); assert.equal(tabs().props['active-key'], 'design')
    const results = sent.samples.map((sample, index) => ({ metricId:'mean', value:index ? 120 : 0, evaluationTime:sample.processTime, quality:{ valid:true } }))
    finish({ status:'success', results, records:results.flatMap((value, index) => [{ id:'n'+index, action:'metric.node', attributes:{ definitionId:'mean', evaluationTime:value.evaluationTime, state:'produced' } }, { id:'o'+index, action:'metric.output', parentId:'n'+index, attributes:{ resultIndex:index } }]), recordsTruncated:false }); await flush()
    assert.match(textContent(mean.parent), /120/)
    await click(nodes(view.root,'a-button').find(node => node.props['aria-label'] === 'trialPreviousTime'))
    assert.match(textContent(mean.parent), /0/); assert.equal(calls, 1)
    graphValue().props.onChange(15); await flush()
    assert.match(textContent(mean.parent), /trialPending/); assert.doesNotMatch(textContent(mean.parent), /120/)
    assert.equal(graphNode('rule-0'), mean); assert.equal(graphNode('rule-0').props['aria-pressed'], true)
    assert.equal(graph.scrollTop, 127); assert.equal(panel().scrollTop, 93)
    assert.ok(nodes(view.root,'external-shell').some(node => node.props.value === 'Mean'))
    assert.equal(nodes(sampleEditor(),'external-shell').find(node => node.props.type === 'number').props.value, 15)
    assert.deepEqual(mean.parent.props.style,coordinates)
    run.props.onClick(); await flush(); assert.equal(calls,2); assert.equal(sent.samples[0].value,15)
    finish({status:'success',results:[],records:[],recordsTruncated:false}); await flush()
  } finally { view.close(); moduleRegistry.clear() }
})

test('指标枚举显示 canonical text，保持真实值与原始元数据', async () => {
  const Value = load('components/Metric/MetricParameterValue.vue').default
  const parameter = { id: 'policy', valueType: { type: 'enum', elements: [{ value: 'reject', text: '判为异常' }] } }
  const view = mount(Value, { parameter, modelValue: 'reject' })
  try {
    const item = nodes(view.root, 'external-shell')[0].props.item
    assert.equal(item.valueType.elements[0].label, '判为异常')
    assert.equal(item.valueType.elements[0].value, 'reject')
    assert.equal(parameter.valueType.elements[0].label, undefined)
  } finally { view.close() }
})

test('图中接续计算即时进入草稿且可撤回；发布及只读限制不暴露结构操作', async () => {
  const Designer = load('components/Metric/template/TemplateDesigner.vue').default
  const value = { ...template, inputDefinitions:[{ id:'a', name:'A' },{ id:'b', name:'B' }],
    definitions:[{ id:'value', expression:'#a', dependsOn:['a'] }], outputs:[{ metricId:'value' }] }
  const commits = []
  const props = reactive({ template:value, disabled:false, published:false,
    'onUpdate:template': next => { commits.push(next); props.template = next } })
  const view = mount(Designer, props)
  const plus = id => nodes(view.root,'button').find(node => node.props['data-add-from'] === id)
  const open = async (id, kind) => {
    const button = plus(id); button.props.onClick({ currentTarget:button })
    nodes(button.parent,'a-menu')[0].props.onClick({ key:kind }); await flush()
  }
  try {
    await open('input-1','rule')
    assert.equal(nodes(view.root,'button').filter(node => node.props['data-node']?.startsWith('rule')).length, 2)
    await click(findText(view.root,'a-button','revertNode'))
    assert.equal(commits.length, 2); assert.equal(props.template.definitions.length, 1)
    await open('input-1','rule')
    assert.equal(commits.length, 3); assert.deepEqual(props.template.definitions.at(-1).dependsOn, ['b'])
    assert.equal(props.template.definitions[0].expression, '#a')
    props.published = true; await flush()
    assert.equal(walk(view.root,node => node.props['data-add-root'] === 'input').length, 0)
    assert.equal(nodes(view.root,'a-menu-item').filter(node => textContent(node).includes('addOutput')).length, 0)
    const stale = nodes(plus('rule-0').parent,'a-menu')[0].props.onClick
    props.disabled = true; await flush(); stale({ key:'rule' }); await flush()
    assert.equal(plus('rule-0'), undefined); assert.equal(commits.length, 3)
  } finally { view.close() }
})

test('常驻属性面板保留错误YAML，折叠不卸载，空白切换受保护，撤回后恢复模板设置', async () => {
  const Designer = load('components/Metric/template/TemplateDesigner.vue').default
  const states = []
  const value = { ...template, inputDefinitions:[{ id:'a', name:'A' }],
    definitions:[{ id:'r', calculator:{ provider:'external', parameters:{ zero:0, flag:false } } }], outputs:[] }
  const props = reactive({ template:value, disabled:false, onEditing:value => states.push(value),
    'onUpdate:template': next => { props.template = next } })
  const view = mount(Designer, props)
  const action = label => nodes(view.root,'a-button').find(node => node.props['aria-label'] === label)
  const select = async id => { const node = nodes(view.root,'button').find(node => node.props['data-node'] === id); node.props.onClick({ currentTarget:node }); await flush() }
  const blank = async () => { nodes(view.root,'div').find(node => node.props.class === 'template-graph').props.onClick({ target:{ closest:() => null } }); await flush() }
  const yaml = () => nodes(view.root,'external-shell').find(node => node.props.language === 'yaml')
  try {
    assert.ok(textContent(view.root).includes('scopeAndReference'))
    await select('rule-0')
    yaml().props['onUpdate:modelValue']('{'); await flush()
    const field = yaml(); assert.equal(states.at(-1), true)
    await click(action('collapseProperties'))
    assert.equal(yaml(), field); assert.equal(yaml().props['model-value'], '{')
    await blank(); await select('input-0')
    assert.equal(yaml(), field, '错误未修正时保留当前编辑器')
    await click(action('expandProperties'))
    assert.equal(yaml().props['model-value'], '{')
    await click(findText(view.root,'a-button','revertNode'))
    assert.notEqual(yaml(), field); assert.equal(states.at(-1), false)
    assert.equal(props.template.definitions[0].calculator.parameters.flag, false)
    await blank(); assert.ok(textContent(view.root).includes('scopeAndReference'))
    assert.equal(yaml(), undefined)
    await select('input-0'); await click(action('collapseProperties')); await blank()
    assert.ok(action('expandProperties'), '收起后点空白不自动展开')
    await select('input-0'); assert.ok(action('collapseProperties'), '点击节点展开属性')
    assert.equal(nodes(view.root,'external-shell').some(node => node.props.open), false, '没有节点抽屉')
  } finally { view.close() }
})

test('输出用业务名称和计算摘要表达，来源聚焦仅虚线强调，定位及发布限制保持明确', async () => {
  const Designer = load('components/Metric/template/TemplateDesigner.vue').default
  const value = { ...template, inputDefinitions:[{ id:'temperature', name:'温度' }],
    definitions:[{ id:'attention', name:'温度偏高', expression:'temperature > 30', dependsOn:['temperature'] }],
    outputs:[{ metricId:'attention', label:'温度提醒', persist:true, publish:false }] }
  const props = reactive({ template:value, disabled:false, published:false,
    'onUpdate:template': next => { props.template = next } })
  const view = mount(Designer, props)
  const node = key => nodes(view.root,'button').find(node => node.props['data-node'] === key)
  const reference = () => nodes(view.root,'span').find(node => node.props['data-reference'] === 'attention')
  const field = () => nodes(view.root,'external-shell').find(node => node.props['component-props']?.['aria-label'] === 'outputFrom')
  const outputEvent = () => nodes(view.root,'button').find(node => textContent(node).includes('outputEvents'))
  try {
    node('output-0').props.onClick({ currentTarget:node('output-0') }); await flush()
    assert.equal(field().props['component-props'].options.find(item => item.value === 'attention').label, '温度偏高')
    assert.ok(textContent(view.root).includes('outputAs'))
    assert.equal(field().props['component-props'].disabled, false)
    reference().props.onMouseenter(); await flush()
    assert.ok(node('rule-0').props.class.includes('referenced')); assert.equal(node('output-0').props['aria-pressed'], true)
    assert.ok(nodes(view.root,'path').some(node => node.props.class?.includes('referenced')))
    reference().props.onMouseleave(); await flush()
    assert.equal(node('rule-0').props.class.includes('referenced'), false)
    reference().props.onFocusin(); await flush(); assert.ok(node('rule-0').props.class.includes('referenced'))
    reference().props.onFocusout(); await flush()
    await click(outputEvent()); assert.equal(props.template.outputs[0].publish, true)
    props.published = true; await flush()
    assert.equal(field().props['component-props'].disabled, true)
    const history = nodes(view.root,'button').find(node => textContent(node).includes('outputHistory'))
    assert.equal(history.props.disabled, true)
    await click(history); assert.equal(props.template.outputs[0].persist, true)
    props.disabled = true; await flush()
    await click(outputEvent()); assert.equal(props.template.outputs[0].publish, true)
  } finally { view.close() }
})

test('指标数值编辑去除补齐零但保留输入文本和元数据精度，零值原样回传', async () => {
  const Value = load('components/Metric/MetricParameterValue.vue').default
  let changed
  const props = reactive({ parameter: { id: 'factor', name: 'Factor', valueType: { type: 'double', scale: 8 } }, modelValue: 1.163,
    'onUpdate:modelValue': value => { changed = value } })
  const view = mount(Value, props)
  try {
    await flush()
    const field = () => nodes(view.root, 'a-input-number')[0]
    assert.equal(field().props.precision, 8)
    assert.equal(field().props.formatter('1.16300000', { userTyping: false, input: '' }), '1.163')
    assert.equal(field().props.formatter('0.00000000', { userTyping: false, input: '' }), '0')
    assert.equal(field().props.formatter('-2.50000000', { userTyping: false, input: '' }), '-2.5')
    assert.equal(field().props.formatter('1', { userTyping: true, input: '1.' }), '1.')
    field().props['onUpdate:value'](0); assert.equal(changed, 0)
    props.parameter.valueType = { type: 'int' }; await flush(); assert.equal(field().props.precision, 0)
  } finally { view.close() }
})

test('真实值组件格式覆盖与共享质量/实际区间不被专用内容遮蔽', async () => {
  const Value = load('components/Metric/MetricValue.vue').default
  const props = reactive({ value: { ...value, inputTimeStart: 100, inputTimeEnd: 200, evaluationTime: 300, quality: { valid: true, coverage: 0 } }, unit: 'kW', settings: { decimals: 2 }, compact: true, disabled: false })
  const view = mount(Value, props)
  try {
    await flush(); assert.ok(textContent(view.root).includes('5.82')); assert.ok(textContent(view.root).includes('inputRange'))
    props.compact = false; await flush(); assert.ok(textContent(view.root).includes('coverage')); assert.ok(textContent(view.root).includes('updatedAt'))
    props.value = { ...value, value: 0, quality: {} }; await flush(); assert.ok(textContent(view.root).includes('0.00'))
    props.value = { ...value, value: false, unit: undefined }; await flush(); assert.ok(textContent(view.root).includes('conditionFalse'))
    props.value = { ...value, status: 'invalid' }; await flush(); assert.ok(textContent(view.root).includes('—'))
    props.value = { ...value, quality: { valid: false } }; await flush(); assert.ok(textContent(view.root).includes('—'))
    props.disabled = true; await flush(); assert.ok(textContent(view.root).includes('disabled'))
    props.disabled = false; props.compact = true; props.value = { metricId: 'value', value: 1 }; await flush(); assert.ok(textContent(view.root).includes('inputTimeUnknown'))
    props.value = { metricId: 'value', value: null, eventTime: 0, inputTimeStart: 0, inputTimeEnd: 0, evaluationTime: Date.UTC(2026, 10, 2), status: 'invalid' }
    await flush(); assert.ok(textContent(view.root).includes('inputTimeUnknown')); assert.ok(!textContent(view.root).includes('1970'))
    props.compact = false; await flush(); assert.ok(textContent(view.root).includes('updatedAt')); assert.ok(!textContent(view.root).includes('1970'))
    props.value = undefined; await flush(); assert.ok(textContent(view.root).includes('waiting'))
  } finally { view.close() }
})


test('时长卡片与趋势只格式化声明的时间单位，原始秒数不变且不重复显示单位', async () => {
  const Value = load('components/Metric/MetricValue.vue').default
  const result = { metricId:'duration', value:8100, unit:'s', evaluationTime:1000, status:'success' }
  const view = mount(Value, { value:result })
  const chart = mount(Trend, { values:[result], unit:'s' })
  try {
    assert.ok(textContent(view.root).includes('intervalHours'))
    assert.ok(textContent(view.root).includes('intervalMinutes'))
    assert.ok(!nodes(view.root, 'span').some(node => textContent(node) === 's'))
    const option = nodes(chart.root, 'chart')[0].props.option
    assert.deepEqual(option.series[0].data, [[1000,8100]])
    assert.equal(option.yAxis.axisLabel.formatter(8100), 'intervalHours intervalMinutes')
    assert.equal(option.tooltip.valueFormatter(45), 'intervalSeconds')
    assert.equal(result.value, 8100)
  } finally { chart.close(); view.close() }
})

test('数值趋势框选只改变时间视口，保留真实点和缺数，返回完整范围恢复坐标', async () => {
  const values=[{metricId:'v',value:10,evaluationTime:100},{metricId:'v',value:null,evaluationTime:300},{metricId:'v',value:20,evaluationTime:900}]
  const view=mount(Trend,{values,bounds:[0,1000]})
  const chart=()=>nodes(view.root,'chart')[0].props.option
  try {
    const original=chart().series[0].data.map(point=>[...point])
    const canonical=chart()
    nodes(view.root,'chart')[0].props.events.datazoom({startValue:100,endValue:500});await flush()
    assert.strictEqual(chart(),canonical,'native selection does not echo through setOption')
    assert.equal(chart().xAxis.min,0);assert.equal(chart().xAxis.max,1000)
    assert.deepEqual(chart().series[0].data,original)
    nodes(view.root,'chart')[0].props.events.restore();await flush()
    assert.equal(chart().xAxis.min,0);assert.equal(chart().xAxis.max,1000)
  } finally {view.close()}
})

test('详情手动刷新保留图表实例，主动切换查询时段才重置交互身份', async () => {
  defaults()
  const Result=load('components/Metric/MetricResult.vue').default
  const at=Date.now()-1000
  api.history=async()=>[{...value,evaluationTime:at}]
  const view=mount(Result,{reference:{configId:'c',outputId:'value'},output:template.outputs[0],template})
  try {
    await flush()
    const initial=nodes(view.root,'chart')[0]
    assert.ok(initial)
    initial.props.events.datazoom({startValue:at-500,endValue:at+500});await flush()
    await click(findText(view.root,'a-button','refresh'))
    assert.strictEqual(nodes(view.root,'chart')[0],initial,'refresh is data replacement, not a new inspection scope')
    await click(nodes(view.root,'button').find(node=>textContent(node)==='day'))
    assert.notStrictEqual(nodes(view.root,'chart')[0],initial,'a deliberate time query starts a new inspection scope')
  } finally {view.close()}
})

test('状态标签复用至当前结果且严格匹配类型，不影响未映射数字的小数设置', async () => {
  const Value=load('components/Metric/MetricValue.vue').default
  const props=reactive({value:{metricId:'v',value:false},labels:[{value:false,name:'未超限',icon:'color:#1677ff'}],settings:{decimals:2},summary:true})
  const view=mount(Value,props)
  try {
    assert.ok(textContent(view.root).includes('未超限'))
    props.value={metricId:'v',value:1.235};await flush()
    assert.ok(textContent(view.root).includes('1.24'))
    props.value={metricId:'v',value:0};await flush()
    assert.ok(textContent(view.root).includes('0.00'));assert.ok(!textContent(view.root).includes('未超限'))
  } finally {view.close()}
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
    assert.ok(nodes(card(), 'a-tooltip').some(node => node.props.title?.includes('valid')))
    assert.equal(textContent(card()).includes('runtimeLoaded'), false)
    observed = { ...observed, quality: { ...observed.quality, stale: true } }
    await refresh()
    assert.ok(textContent(card()).includes('inputExpired'))
    assert.ok(textContent(card()).includes('6'))
    const timeHint = nodes(card(), 'a-tooltip').find(node => node.props.title?.includes(new Date(1000).toLocaleString('zh')))
    const timestamp = nodes(timeHint, 'time')[0]
    assert.ok(timestamp)
    assert.ok(textContent(timestamp).includes(new Date(1000).toLocaleString('zh', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })))
    assert.ok(timeHint.props.title.includes('inputExpired'))
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
    assert.equal(textContent(card()).includes('runtimeUnknown'), false)
    assert.ok(textContent(card()).includes('inputExpired'))
    runtime = { nodeId: 'node-a', state: 'loaded' }; empty = true; await refresh()
    assert.ok(textContent(card()).includes('waiting'))
    assert.equal(textContent(card()).includes('runtimeLoaded'), false)
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
