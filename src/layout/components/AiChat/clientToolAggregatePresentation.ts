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

const resolveTrendFields = (fields: readonly AiClientToolOutputField[]) => {
  const dimensions = fields.filter(field => (
    field.semanticRole === 'category' || field.semanticRole === 'timestamp'
  ))
  const measures = fields.filter(field => field.semanticRole === 'number')
  if (dimensions.length + measures.length !== fields.length) return undefined
  if (dimensions.length !== 1
    || measures.length < 1
    || measures.length > MAX_SERIES
    || !uniqueFieldNames([dimensions[0], ...measures])) return undefined
  return { kind: 'trend' as const, dimension: dimensions[0], measures }
}

const resolveOrderedPathFields = (fields: readonly AiClientToolOutputField[]) => {
  const timestamps = fields.filter(field => field.semanticRole === 'timestamp')
  const longitudes = fields.filter(field => field.semanticRole === 'longitude')
  const latitudes = fields.filter(field => field.semanticRole === 'latitude')
  if (timestamps.length + longitudes.length + latitudes.length !== fields.length
    || timestamps.length !== 1
    || longitudes.length !== 1
    || latitudes.length !== 1
    || !uniqueFieldNames(fields)) return undefined
  const [longitude] = longitudes
  const [latitude] = latitudes
  const measure = normalizedText(longitude.measure)
  const longitudeAggregation = normalizedText(longitude.aggregation).toLowerCase()
  const latitudeAggregation = normalizedText(latitude.aggregation).toLowerCase()
  if (!measure
    || measure !== normalizedText(latitude.measure)
    || longitudeAggregation !== latitudeAggregation
    || !['first', 'last'].includes(longitudeAggregation)) return undefined
  return {
    kind: 'ordered-path' as const,
    timestamp: timestamps[0],
    longitude,
    latitude,
  }
}

const resolveFields = (fields: readonly AiClientToolOutputField[] = []) => (
  resolveTrendFields(fields) || resolveOrderedPathFields(fields)
)

const resolveCoordinateValue = (value: unknown, min: number, max: number) => (
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined
)

const coordinateAxis = (field: AiClientToolOutputField) => ({
  type: 'value',
  scale: true,
  ...(normalizedText(field.label, 120) ? { name: normalizedText(field.label, 120) } : {}),
})

const createOrderedPathOption = (
  value: readonly unknown[],
  descriptor: ClientToolAggregatePresentationDescriptor,
  resolved: ReturnType<typeof resolveOrderedPathFields> & {},
) => {
  const { timestamp, longitude, latitude } = resolved
  const source: unknown[][] = []
  for (const item of value) {
    if (!isRecord(item)) return undefined
    const timestampValue = resolveDimensionValue(item[timestamp.name])
    const longitudeValue = resolveCoordinateValue(item[longitude.name], -180, 180)
    const latitudeValue = resolveCoordinateValue(item[latitude.name], -90, 90)
    if (timestampValue === undefined || longitudeValue === undefined || latitudeValue === undefined) return undefined
    source.push([longitudeValue, latitudeValue, timestampValue])
  }
  const name = normalizedText(descriptor.label, 120)
  return {
    option: {
      animation: false,
      tooltip: { trigger: 'item' },
      grid: {
        left: 24,
        right: 24,
        top: 48,
        bottom: 24,
        containLabel: true,
      },
      toolbox: {
        right: 8,
        feature: {
          dataZoom: { xAxisIndex: 0, yAxisIndex: 0 },
          restore: {},
        },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        { type: 'inside', yAxisIndex: 0, filterMode: 'none' },
      ],
      dataset: {
        dimensions: [longitude.name, latitude.name, timestamp.name],
        source,
      },
      xAxis: coordinateAxis(longitude),
      yAxis: coordinateAxis(latitude),
      series: [{
        type: 'line',
        ...(name ? { name } : {}),
        encode: {
          x: longitude.name,
          y: latitude.name,
          tooltip: [timestamp.name, longitude.name, latitude.name],
        },
        showSymbol: source.length <= 48,
        connectNulls: false,
      }],
    },
    populatedBucketCount: source.length,
    measurementCount: source.length * 2,
    bucketCount: source.length,
    seriesCount: 1,
  }
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
  if (resolved.kind === 'ordered-path') {
    // FIRST/LAST coordinate fields from one measure retain producer order; other coordinate sets stay ambiguous.
    const path = createOrderedPathOption(value, descriptor, resolved)
    if (!path) return undefined
    const content = JSON.stringify(path.option)
    if (sourceByteLength(content) > MAX_SOURCE_BYTES) return undefined
    return createAiClientToolArtifact({
      content,
      mimeType: CLIENT_TOOL_ECHARTS_MEDIA_TYPE,
      fileExtension: 'json',
      modelSafeInline: path.option,
      maxInlineBytes: MAX_INLINE_BYTES,
      maxBytes: MAX_SOURCE_BYTES,
      preview: {
        label: normalizedText(descriptor.label || descriptor.name, 120),
        bucketCount: path.bucketCount,
        seriesCount: path.seriesCount,
      },
      cardinality: {
        kind: 'aggregate-series',
        bucketCount: path.bucketCount,
        populatedBucketCount: path.populatedBucketCount,
        measurementCount: path.measurementCount,
      },
      requestedRange: context.requestedRange,
      observedRange: context.observedRange,
      complete: true,
      truncated: false,
    })
  }
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
