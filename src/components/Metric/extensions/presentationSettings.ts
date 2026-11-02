import { metricValueText } from '../presentation'
import { copy, parameterOverrides } from '../service'
import type { MetricConfig, MetricConfigFieldsPatch, MetricTemplate } from '../types'

/** Absence, null and an empty map represent the same empty instance override. */
export function normalizePresentation(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}
}
/** Settings merge shallowly: nested values replace a whole key and 0/false remain explicit overrides. */
export function presentationSettings(template?: Pick<MetricTemplate, 'options'>, config?: Pick<MetricConfig, 'presentation'>): Record<string, unknown> {
  return { ...normalizePresentation(template?.options?.presentation?.settings), ...normalizePresentation(config?.presentation) }
}
export function formatMetricValue(value: unknown, settings: Record<string, unknown> = {}): string {
  const decimals = settings.decimals
  return typeof value === 'number' && Number.isFinite(value) && typeof decimals === 'number' && Number.isInteger(decimals) && decimals >= 0 && decimals <= 8
    ? new Intl.NumberFormat(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value) : metricValueText(value)
}
/** Specialized forms may change bindings and editable parameters, never identity, revision or presentation. */
export function applyMetricConfigFields(draft: MetricConfig, template: MetricTemplate, patch: MetricConfigFieldsPatch): MetricConfig {
  return { ...copy(draft),
    inputMappings: patch.inputMappings === undefined ? draft.inputMappings : copy(patch.inputMappings),
    parameters: patch.parameters === undefined ? draft.parameters : parameterOverrides(template, patch.parameters),
  }
}
