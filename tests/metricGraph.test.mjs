import assert from 'node:assert/strict'
import test from 'node:test'
import { createMetricLoader } from './helpers/metricRuntime.mjs'

const load = createMetricLoader()
const { templateGraph, templateGraphLayout, relatedGraphEdges } = load('components/Metric/template/designer.ts')
const { graphTimeGroups, graphNodeSummary } = load('components/Metric/template/graphPresentation.ts')
const { simulationSteps } = load('components/Metric/template/simulationFlow.ts')
const t = (key, values) => values ? `${key}:${JSON.stringify(values)}` : key
const template = (definitions = []) => ({ id: 'test', version: '1', name: 'Test', inputDefinitions: [{ id: 'temperature', name: '温度' }], definitions,
  outputs: definitions.length ? [{ metricId: definitions.at(-1).id, label: '结果' }] : [], parameterDefinitions: [], parameters: {} })
const statistic = (id, size, extra = {}) => ({ id, sourceMetric: 'temperature', aggregation: 'avg', window: { mode: 'time', size, timeMode: 'event', emitPolicy: 'onEvent', ...extra } })

test('选择输出追溯完整上游，选择中间节点覆盖上下游但不绕入共享输入的旁支', () => {
  const edges = [['a','total'],['b','total'],['total','ratio'],['b','ratio'],['ratio','output'],['total','other'],['other','otherOutput']]
    .map(([source,target]) => ({ source,target,key:`${source}:${target}` }))
  assert.deepEqual([...relatedGraphEdges(edges,'output')], ['a:total','b:total','total:ratio','b:ratio','ratio:output'])
  assert.equal(relatedGraphEdges(edges,'total').size, 7)
  assert.deepEqual([...relatedGraphEdges(edges,'ratio')], ['a:total','b:total','total:ratio','b:ratio','ratio:output'])
  assert.equal(relatedGraphEdges(edges).size, 0)
  assert.equal(relatedGraphEdges(edges,'missing').size, 0)
  assert.equal(relatedGraphEdges([...edges,{source:'ratio',target:'total',key:'cycle'}],'total').size, 8)
})

test('多来源、前向声明和复用结果均按依赖向下，输出贴近各自生产节点', () => {
  const value = template([{ id: 'difference', dependsOn: ['short', 'long'], expression: 'short - long' }, statistic('short', 'PT5M'), statistic('long', 'PT15M')])
  value.outputs = [{ metricId: 'short' }, { metricId: 'difference' }]
  const before = JSON.stringify(value)
  const graph = templateGraph(value)
  assert.equal(graph.nodes.filter(node => node.kind === 'input').length, 1)
  assert.equal(graph.edges.length, 6)
  for (const edge of graph.edges) {
    const source = graph.nodes.find(node => node.key === edge.source)
    const target = graph.nodes.find(node => node.key === edge.target)
    assert.ok(target.y >= source.y + templateGraphLayout.nodeHeight)
  }
  const early = graph.nodes.find(node => node.key === 'output-0')
  const late = graph.nodes.find(node => node.key === 'output-1')
  assert.ok(early.y < late.y)
  assert.equal(JSON.stringify(value), before)
})

test('深计算链增长图高，不增加横向列；各节点不重叠且完整落在画布内', () => {
  const value = template(Array.from({ length: 6 }, (_, index) => ({ id: `r${index}`, dependsOn: [index ? `r${index - 1}` : 'temperature'] })))
  const graph = templateGraph(value)
  assert.ok(graph.height > graph.width)
  for (const node of graph.nodes) {
    assert.ok(node.x >= 0 && node.x + templateGraphLayout.nodeWidth <= graph.width)
    assert.ok(node.y >= 0 && node.y + templateGraphLayout.nodeHeight <= graph.height)
    for (const other of graph.nodes.filter(other => other.key !== node.key && other.level === node.level)) {
      assert.ok(Math.abs(node.x - other.x) >= templateGraphLayout.nodeWidth)
    }
  }
})

test('无输入的常量计算没有空白首层，连线与压缩后的节点位置一致', () => {
  const value = template([{ id: 'constant', expression: '1' }]); value.inputDefinitions = []
  const graph = templateGraph(value)
  assert.equal(graph.levels[0].y, 0)
  const source = graph.nodes.find(node => node.kind === 'rule')
  assert.equal(source.y, templateGraphLayout.headingHeight)
  assert.ok(graph.edges[0].path.startsWith(`M${source.x + templateGraphLayout.nodeWidth / 2},${source.y + templateGraphLayout.nodeHeight} `))
})

test('同层相邻的同口径统计可共用范围；单节点和不同范围不套组框', () => {
  const value = template([statistic('mean', 'PT5M'), { ...statistic('max', 'PT300S'), aggregation: 'max' }, statistic('long', 'PT15M')])
  const groups = graphTimeGroups(value, templateGraph(value), t)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].key, 'rule-0')
  assert.match(groups[0].label, /5 minutes/)
  assert.equal(graphTimeGroups(template([statistic('single', 'PT5M')]), templateGraph(template([statistic('single', 'PT5M')])), t).length, 0)
})

test('相同时长的取数、触发、成立、有效期以及不同时间依据不会误归为同组', () => {
  const value = template([
    statistic('event', 'PT5M'), statistic('processing', 'PT5M', { timeMode: 'processing' }),
    { id: 'scheduled', dependsOn: ['temperature'], expression: 'temperature', window: { mode: 'none', emitPolicy: 'onSchedule', emitInterval: 'PT5M' } },
    { id: 'held', dependsOn: ['temperature'], temporalCondition: { enterExpression: 'temperature > 8', dwell: 'PT5M', recovery: 'PT1M' } },
  ])
  value.inputDefinitions[0].maxAge = 'PT5M'
  assert.equal(graphTimeGroups(value, templateGraph(value), t).length, 0)
  const scheduled = graphNodeSummary(value, { kind: 'rule', index: 2 }, t)
  const held = graphNodeSummary(value, { kind: 'rule', index: 3 }, t)
  assert.match(scheduled.detail, /graphEvery/)
  assert.match(held.detail, /graphDwellRecovery/)
  assert.equal(held.expression, 'temperature > 8')
})

test('先计算再统计及先统计再统计保留分层，不按相同时长跨层合并', () => {
  const value = template([statistic('short', 'PT5M'), { ...statistic('again', 'PT5M'), sourceMetric: 'short' }])
  assert.equal(graphTimeGroups(value, templateGraph(value), t).length, 0)
  assert.deepEqual(simulationSteps(value, []).map(step => step.id), ['short', 'again'])
})

test('图中的公式、条件和算法说明来自真实配置，未绑定的输入不杜撰设备', () => {
  const value = template([{ id: 'ratio', expression: 'temperature / 2', applicabilityExpression: 'temperature > 0' }])
  const formula = graphNodeSummary(value, { kind: 'rule', index: 0 }, t)
  assert.equal(formula.expression, 'temperature / 2')
  assert.equal(formula.condition, '温度 > 0')
  assert.equal(graphNodeSummary(value, { kind: 'input', index: 0 }, t).text, 'latestReading')
  value.definitions[0] = { id: 'model', calculator: { provider: 'installed-model' } }
  assert.equal(graphNodeSummary(value, { kind: 'rule', index: 0 }, t, [{ id: 'model-option', name: '异常检测', configuration: { provider: 'installed-model' } }]).text, '异常检测')
  value.definitions[0] = { id: 'increase', inputs: [{ id: 'reading', metricId: 'temperature' }], calculator: { provider: 'measurement', parameters: { operation: 'increase' } } }
  const natural = (key, values) => key === 'increaseCalculationSummary' ? `读取 ${values.source}` : key
  assert.equal(graphNodeSummary(value, { kind: 'rule', index: 0 }, natural).text, '读取 温度')
})
