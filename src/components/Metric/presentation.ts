import type { MetricTemplate, MetricTemplateOutput, MetricValue } from './types'
export type MetricTone = 'success' | 'warning' | 'error' | 'default'
export function metricState(value?: MetricValue): { key: string; tone: MetricTone } {
  if (!value) return { key: 'waiting', tone: 'default' }
  if (value.reason === 'notApplicable') return { key: 'notApplicable', tone: 'default' }
  if (value.status === 'invalid' || value.quality?.valid === false) return { key: value.reason || 'inputInvalid', tone: 'error' }
  if (value.quality?.stale || value.reason === 'inputExpired') return { key: 'inputExpired', tone: 'warning' }
  if (value.value === undefined || value.value === null) return { key: 'noValue', tone: 'default' }
  if (value.status === 'fallback' || value.quality?.estimated) return { key: 'estimatedInput', tone: 'warning' }
  if (value.status === 'partial') return { key: value.reason || 'optionalInputMissing', tone: 'warning' }
  if (value.quality?.valid !== true) return { key: 'unknownQuality', tone: 'default' }
  return { key: 'valid', tone: 'success' }
}
export function metricValueText(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return Number.isFinite(value) ? new Intl.NumberFormat(undefined, { maximumSignificantDigits: 8 }).format(value) : '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
export function resultTime(value: MetricValue): number | undefined {
  return value.evaluationTime ?? value.timestamp ?? value.processTime
}
/** 输出标签缺省时沿用模板计算项名称，不向业务用户展示内部输出标识。 */
export function metricOutputName(output?: MetricTemplateOutput, template?: MetricTemplate): string | undefined {
  if (output?.label) return output.label
  const definition = template?.definitions.find(item => item.id === output?.metricId)
  return typeof definition?.name === 'string' && definition.name ? definition.name : undefined
}
export function metricChartPoints(values: MetricValue[]): Array<[number, number | null]> {
  return values.filter(value => Number.isFinite(resultTime(value)))
    .map(value => [resultTime(value)!, ['valid', 'unknownQuality', 'estimatedInput', 'optionalInputMissing'].includes(metricState(value).key)
      && typeof value.value === 'number' && Number.isFinite(value.value) ? value.value : null] as [number, number | null])
    .sort((left, right) => left[0] - right[0])
}
