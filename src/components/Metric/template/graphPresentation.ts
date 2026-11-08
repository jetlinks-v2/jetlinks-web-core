import { calculationKind, durationSeconds } from './window'
import { simulationDuration, simulationOperation } from './simulationFlow'
import { expressionLabel, ruleExpression, templateGraphLayout, type TemplateNode, type TemplateRule, type templateGraph } from './designer'
import { ruleFormulaReferences } from './formula'
import { findCalculator } from './algorithm'
import { calculatorIcon } from './calculatorPresentation'
import type { MetricCalculatorDescriptor, MetricTemplate } from '../types'

type Translate = (key: string, values?: Record<string, unknown>) => string
type Graph = ReturnType<typeof templateGraph>
interface NodeSummary { icon: string; text: string; detail: string; description?:string; expression?: string; condition?: string }

/** 触发频率与取数窗口独立，供图与属性面板共享。 */
export function ruleTriggerSummary(rule:TemplateRule,t:Translate):string {
  return rule.window?.emitPolicy === 'onSchedule' ? t('graphEvery', { duration:simulationDuration(rule.window.emitInterval,t) })
    : rule.window?.emitPolicy === 'onWindowClose' ? t('graphWindowClose') : t('onEvent')
}

/** 图摘要只解释已有配置，不推断时间对齐、采样或计算结果。 */
export function graphNodeSummary(template: MetricTemplate, node: TemplateNode, t: Translate, calculators: MetricCalculatorDescriptor[] = []): NodeSummary {
  if (node.kind === 'input') {
    const input = template.inputDefinitions[node.index]
    return { icon: 'ImportOutlined', text: input.source?.lookback ? `${t('recentDuration')} ${simulationDuration(input.source.lookback, t)}` : t('latestReading'), detail: input.unit || '', expression: undefined }
  }
  if (node.kind === 'output') {
    const output = template.outputs[node.index]
    return { icon: 'ExportOutlined', text: output.unit || '', detail: t('output'), expression: undefined }
  }
  const rule = template.definitions[node.index] as TemplateRule
  const kind = calculationKind(rule)
  const names = new Map(ruleFormulaReferences(template, rule, calculators).map(item => [item.expression, item.label]))
  const conditionSource=ruleExpression(rule,'applicabilityExpression'),source=ruleExpression(rule)
  const condition = conditionSource ? expressionLabel(template, conditionSource, names) : undefined
  const timing = ruleTriggerSummary(rule,t)
  if (rule.temporalCondition) return { icon: 'ClockCircleOutlined', expression: ruleExpression(rule,'enterExpression'), condition,
    text: expressionLabel(template, ruleExpression(rule,'enterExpression'), names) || t('temporal'), detail: t('graphDwellRecovery', { dwell: simulationDuration(rule.temporalCondition.dwell, t), recovery: simulationDuration(rule.temporalCondition.recovery, t) }) }
  if (rule.calculator) {
    const descriptor=findCalculator(rule.calculator,calculators),operation=simulationOperation(rule,t)
    return {icon:calculatorIcon(descriptor),expression:undefined,condition,
      text:descriptor?.name || expressionLabel(template,operation,names),detail:timing,
      description:operation !== rule.calculator.provider ? expressionLabel(template,operation,names) : descriptor?.description}
  }
  return { icon: kind === 'statistics' ? 'BarChartOutlined' : 'FunctionOutlined', expression: source, condition,
    text: kind === 'statistics' ? simulationOperation(rule, t) : expressionLabel(template, source, names) || t('expression'),
    detail: kind === 'statistics' && source ? `${simulationOperation(rule, t)} · ${timing}` : timing }
}

/** 只合并相邻、同层且统计时间口径一致的节点；分组不成为执行容器。 */
export function graphTimeGroups(template: MetricTemplate, graph: Graph, t: Translate) {
  const groups: { key: string; label: string; x: number; y: number; width: number }[] = []
  let run: Graph['nodes'] = []
  let previous = ''
  const flush = () => {
    if (run.length > 1) {
      const first = run[0]; const last = run[run.length - 1]
      const rule = template.definitions[first.index] as TemplateRule
      groups.push({ key: first.key, label: rule.window?.mode === 'time'
        ? `${t('recentDuration')} ${simulationDuration(rule.window.size, t)}`
        : `${t('recentDuration')} ${rule.window?.size} ${t('readings')}`, x: first.x - 6, y: first.y - 20, width: last.x - first.x + templateGraphLayout.nodeWidth + 12 })
    }
    run = []
  }
  for (const node of graph.nodes) {
    const rule = node.kind === 'rule' ? template.definitions[node.index] as TemplateRule : undefined
    const window = rule?.window
    const key = rule && !rule.windowFamily && rule.aggregation && (window?.mode === 'time' || window?.mode === 'latestN')
      ? JSON.stringify([node.level, window.mode, window.mode === 'time' ? durationSeconds(window.size) ?? window.size : window.size,
        window.timeMode || 'processing', window.emitPolicy || 'onEvent', window.emitInterval, window.step, window.allowedLateness]) : ''
    if (!key || key !== previous) flush()
    if (key) run.push(node)
    previous = key
  }
  flush()
  return groups
}
