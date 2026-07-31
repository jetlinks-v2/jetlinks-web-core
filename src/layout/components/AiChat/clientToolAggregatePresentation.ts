import type { AiClientToolOutputField } from './clientToolResult'
import {
  createAiClientToolArtifact,
  type AiClientToolArtifact,
} from './clientToolResultDelivery'

export const CLIENT_TOOL_ECHARTS_MEDIA_TYPE = 'application/vnd.echarts+json'
export const CLIENT_TOOL_ECHARTS_OUTPUT_SHAPE = 'presentation.echarts-option'

const MAX_SERIES = 8
const MAX_SOURCE_BYTES = 8 * 1024 * 1024
const MAX_INLINE_BYTES = 64 * 1024
const MAX_CATEGORY_TEXT = 2_048
const HTML_TEXT_PATTERN = /<\s*\/?\s*[a-z][^>]*>/i
const HTML_TEXT_REPLACE_PATTERN = /<\s*\/?\s*[a-z][^>]*>/gi
const NESTED_PRESENTATION_REFERENCE_PATTERN = /^(?:fs|container|dataset):\/\//i

type JsonRecord = Record<string, unknown>

export interface ClientToolAggregatePresentationDescriptor {
  name: string
  label?: string
  fields?: readonly AiClientToolOutputField[]
}

export interface ClientToolAggregatePresentationContext {
  requestedRange?: Record<string, unknown>
  observedRange?: Record<string, unknown>
  complete: boolean
  truncated: boolean
}

const isRecord = (value: unknown): value is JsonRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const normalizedText = (value: unknown, limit = 160) => String(value || '')
  .replace(HTML_TEXT_REPLACE_PATTERN, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, limit)

const uniqueFieldNames = (fields: readonly AiClientToolOutputField[]) => (
  fields.every(field => !!String(field.name || '').trim())
  && new Set(fields.map(field => String(field.name || '').trim())).size === fields.length
)

const resolveFields = (fields: readonly AiClientToolOutputField[] = []) => {
  const dimensions = fields.filter(field => (
    field.semanticRole === 'category' || field.semanticRole === 'timestamp'
  ))
  const measures = fields.filter(field => field.semanticRole === 'number')
  if (dimensions.length !== 1
    || measures.length < 1
    || measures.length > MAX_SERIES
    || !uniqueFieldNames([dimensions[0], ...measures])) return undefined
  return { dimension: dimensions[0], measures }
}

/** A series is auto-presentable only when its producer supplied a closed, unambiguous field contract. */
export const canCreateClientToolAggregatePresentation = (
  descriptor: ClientToolAggregatePresentationDescriptor,
) => !!resolveFields(descriptor.fields)

const resolveDimensionValue = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string'
    || value.length > MAX_CATEGORY_TEXT
    || HTML_TEXT_PATTERN.test(value)
    || NESTED_PRESENTATION_REFERENCE_PATTERN.test(value.trim())) return undefined
  return value
}

const resolveMeasureValue = (value: unknown) => (
  value === null || value === undefined
    ? null
    : typeof value === 'number' && Number.isFinite(value) ? value : undefined
)

const seriesName = (
  descriptor: ClientToolAggregatePresentationDescriptor,
  field: AiClientToolOutputField,
  measureCount: number,
) => normalizedText(
  measureCount === 1 ? descriptor.label || field.label || field.name : field.label || field.name,
  120,
) || String(field.name)

const commonMeasureUnit = (fields: readonly AiClientToolOutputField[]) => {
  const units = new Set(fields.map(field => (
    field.format === 'percent' ? '%' : normalizedText(field.unit, 32)
  )).filter(Boolean))
  return units.size === 1 ? [...units][0] : undefined
}

const sourceByteLength = (source: string) => new TextEncoder().encode(source).byteLength

/**
 * Builds a renderer-ready option from producer-selected records without inferring domain fields or
 * rewriting timestamps. Category labels stay byte-for-byte identical; timestamp dimensions use the
 * browser-local ECharts time axis.
 */
export const createClientToolAggregatePresentation = (
  value: unknown,
  descriptor: ClientToolAggregatePresentationDescriptor,
  context: ClientToolAggregatePresentationContext,
): AiClientToolArtifact<Record<string, unknown>> | undefined => {
  if (!context.complete || context.truncated || !Array.isArray(value) || value.length === 0) return undefined
  const resolved = resolveFields(descriptor.fields)
  if (!resolved) return undefined
  const { dimension, measures } = resolved
  const source: unknown[][] = []
  let populatedBucketCount = 0
  let measurementCount = 0
  for (const item of value) {
    if (!isRecord(item)) return undefined
    const dimensionValue = resolveDimensionValue(item[dimension.name])
    if (dimensionValue === undefined) return undefined
    const row: unknown[] = [dimensionValue]
    let populated = false
    for (const measure of measures) {
      const measureValue = resolveMeasureValue(item[measure.name])
      if (measureValue === undefined) return undefined
      row.push(measureValue)
      if (measureValue !== null) {
        populated = true
        measurementCount += 1
      }
    }
    if (populated) populatedBucketCount += 1
    source.push(row)
  }
  if (measurementCount === 0) return undefined

  const option = {
    animation: false,
    tooltip: { trigger: 'axis' },
    ...(measures.length > 1 ? { legend: { type: 'scroll' } } : {}),
    grid: {
      left: 24,
      right: 24,
      top: measures.length > 1 ? 56 : 24,
      bottom: 24,
      containLabel: true,
    },
    dataset: {
      dimensions: [dimension.name, ...measures.map(field => field.name)],
      source,
    },
    xAxis: {
      type: dimension.semanticRole === 'timestamp' ? 'time' : 'category',
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      ...(commonMeasureUnit(measures) ? { name: commonMeasureUnit(measures) } : {}),
      ...(measures.every(field => field.format === 'percent')
        ? { axisLabel: { formatter: '{value}%' } }
        : {}),
    },
    series: measures.map(field => ({
      type: 'line',
      name: seriesName(descriptor, field, measures.length),
      encode: { x: dimension.name, y: field.name },
      showSymbol: source.length <= 48,
      connectNulls: false,
    })),
  }
  const content = JSON.stringify(option)
  if (sourceByteLength(content) > MAX_SOURCE_BYTES) return undefined
  return createAiClientToolArtifact({
    content,
    mimeType: CLIENT_TOOL_ECHARTS_MEDIA_TYPE,
    fileExtension: 'json',
    modelSafeInline: option,
    maxInlineBytes: MAX_INLINE_BYTES,
    maxBytes: MAX_SOURCE_BYTES,
    preview: {
      label: normalizedText(descriptor.label || descriptor.name, 120),
      bucketCount: source.length,
      seriesCount: measures.length,
    },
    cardinality: {
      kind: 'aggregate-series',
      bucketCount: source.length,
      populatedBucketCount,
      measurementCount,
    },
    requestedRange: context.requestedRange,
    observedRange: context.observedRange,
    complete: true,
    truncated: false,
  })
}
