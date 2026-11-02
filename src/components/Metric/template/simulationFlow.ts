import type { MetricTemplate, MetricValue, MetricActionRecord } from '../types'
import { templateGraph, ruleDependencies, type TemplateRule } from './designer'
import { calculationKind, durationParts } from './window'

export const simulationShape = (index: number) => ['circle', 'square', 'diamond', 'triangle'][index % 4]
export const evaluationTime = (value: MetricValue) => value.evaluationTime ?? value.eventTime ?? value.timestamp

/** 只对齐时间轴，不把时间相同的输入、分支或结果推断为因果关系。 */
export function simulationTimes(samples: { eventTime?: number }[], results: MetricValue[]): number[] {
  return [...new Set([...samples.map(sample => sample.eventTime), ...results.map(evaluationTime)]
    .filter((time): time is number => typeof time === 'number' && Number.isFinite(time)))].sort((a, b) => a - b)
}

export function simulationSteps(template: MetricTemplate, results: MetricValue[]) {
  const byMetric = new Map<string, MetricValue[]>()
  for (const result of results) {
    const values = byMetric.get(result.metricId) || []
    values.push(result); byMetric.set(result.metricId, values)
  }
  const nodes = templateGraph(template).nodes.filter(node => node.kind === 'rule').sort((a, b) => a.column - b.column || a.index - b.index)
  return nodes.flatMap(node => {
    const rule = template.definitions[node.index] as TemplateRule
    const family = rule.windowFamily as { ranges?: { size?: string; mode?: string; outputs?: { id?: string; aggregation?: string }[] }[] } | undefined
    const outputs = family ? (family.ranges || []).flatMap(range => (range.outputs || []).map(output => ({ id: output.id, rule: { ...rule, windowFamily: undefined, window: { ...rule.window, mode: range.mode, size: range.size }, aggregation: output.aggregation } as TemplateRule })))
      : [{ id: rule.id, rule }]
    return outputs.map((output, index) => ({ id: output.id || '', rule: output.rule, index: node.index,
      shape: simulationShape(template.inputDefinitions.length + node.index + index),
      definitionId: rule.id || '', output: template.outputs.find(item => item.metricId === output.id), values: byMetric.get(output.id || '') || [], dependencies: ruleDependencies(rule),
    }))
  })
}

type Translate = (key: string, values?: Record<string, unknown>) => string
/** 使用后端本次响应的结果序号和父子 ID 关联，不按时间或数值猜测。 */
export function simulationProcessForResult(records: MetricActionRecord[], index: number) {
  const output = records.find(record => record.action === 'metric.output' && record.attributes.resultIndex === index)
  return output && { output, node: records.find(record => record.id === output.parentId) }
}
export function simulationNodeRecords(records: MetricActionRecord[], definitionId: string) {
  return records.filter(record => record.action === 'metric.node' && record.attributes.definitionId === definitionId)
}
export function simulationDuration(value: string | undefined, t: Translate): string {
  const duration = durationParts(value)
  return duration ? `${duration.amount} ${t(duration.unit)}` : value || '—'
}

/** 文案读取实际规则；不在前端复制公式、窗口或算法计算。 */
export function simulationOperation(rule: TemplateRule, t: Translate): string {
  const kind = calculationKind(rule)
  if (kind === 'statistics') {
    const range = rule.window?.mode === 'time' ? `${t('recentDuration')} ${simulationDuration(rule.window.size, t)}`
      : rule.window?.mode === 'latestN' ? `${t('recentDuration')} ${rule.window.size} ${t('readings')}` : t('latestReading')
    return rule.window?.mode === 'none' || rule.type === 'raw' ? range : `${range} · ${t(`statistic_${rule.aggregation || 'avg'}`)}`
  }
  if (rule.temporalCondition) return `${rule.temporalCondition.enterExpression || '—'} · ${t('dwell')} ${simulationDuration(rule.temporalCondition.dwell, t)} · ${t('recovery')} ${simulationDuration(rule.temporalCondition.recovery, t)}`
  return rule.expression || rule.calculator?.provider || t('calculation')
}

/** 同一时刻可有多个结果，保留服务端返回次序，不能用 Map<time,value> 覆盖。 */
export function simulationResultCells(values: MetricValue[], columns: Map<number, number>) {
  return simulationCells(values, columns, evaluationTime)
}
export function simulationRecordCells(values: MetricActionRecord[], columns: Map<number, number>) {
  return simulationCells(values, columns, record => Number(record.attributes.evaluationTime))
}
function simulationCells<T>(values: T[], columns: Map<number, number>, timeOf: (value: T) => number | undefined) {
  const cells = new Map<number, { column: number; values: { value: T; index: number }[] }>()
  values.forEach((value, index) => {
    const time = timeOf(value)
    if (time === undefined || !columns.has(time)) return
    const cell = cells.get(time) || { column: columns.get(time)!, values: [] }
    cell.values.push({ value, index }); cells.set(time, cell)
  })
  return [...cells.values()]
}
