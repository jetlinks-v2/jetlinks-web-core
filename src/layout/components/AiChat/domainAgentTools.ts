import i18n from '@jetlinks-web-core/locales'
import {
  createAiClientToolFailureResult,
  normalizeAiClientToolCardinality,
  withAiClientToolEvidence,
  type AiClientToolEvidence,
  type AiClientToolCardinality,
  type AiClientToolClaim,
  type AiClientToolOutputBinding,
} from './clientToolResult'
import type {
  AiClientToolInput,
  AiClientToolParameterSchema,
} from './clientTools'

export {
  searchDomainAgentItems,
  type DomainAgentSearchResult,
} from './domainAgentSearch'

export type DomainAgentStatus = 'ok' | 'empty' | 'partial' | 'forbidden' | 'unavailable'

export type DomainAgentName = 'device' | 'video' | 'alarm' | 'visual-search'

export interface DomainAgentTimeRange {
  start: number
  end: number
  label?: string
}

export interface DomainAgentNavigation {
  kind: 'menu' | 'detail' | 'workspace' | 'handoff'
  label: string
  path: string
  menuCode: string
  link?: string
  markdownLink?: string
  subject?: {
    type: string
    id: string
    name?: string
  }
  requiresConfirmation?: boolean
}

export interface DomainAgentToolResult<T> {
  success: boolean
  complete: boolean
  status: DomainAgentStatus
  domain: DomainAgentName
  scope: {
    type: 'project'
    name?: string
  }
  timeRange?: DomainAgentTimeRange
  filters?: Record<string, unknown>
  summary: Record<string, unknown>
  data: T
  total?: number
  truncated: boolean
  nextPage?: number
  warnings?: string[]
  navigation?: DomainAgentNavigation[]
  evidence?: AiClientToolEvidence
  outputBindings?: AiClientToolOutputBinding[]
}

export type DomainAgentCardinality = AiClientToolCardinality

/** Returns a finite numeric measurement while preserving null/blank values as missing data. */
export const normalizeDomainAgentMeasurement = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

export const createDomainAgentRecordSetCardinality = (input: {
  returnedCount: number
  totalCount?: number
}): Extract<DomainAgentCardinality, { kind: 'record-set' }> => (
  normalizeAiClientToolCardinality({
    kind: 'record-set',
    recordCount: input.totalCount ?? input.returnedCount,
    returnedCount: input.returnedCount,
    totalCount: input.totalCount ?? input.returnedCount,
  })
)

export const createDomainAgentAggregateCardinality = (input: {
  bucketCount: number
  populatedBucketCount: number
  measurementCount: number
}): Extract<DomainAgentCardinality, { kind: 'aggregate-series' }> => (
  normalizeAiClientToolCardinality({
    kind: 'aggregate-series',
    ...input,
  })
)

export const createDomainAgentPreviewCardinality = (input: {
  displayedCount: number
  totalCount?: number
  modelSampleCount?: number
}): Extract<DomainAgentCardinality, { kind: 'preview' }> => (
  normalizeAiClientToolCardinality({
    kind: 'preview',
    displayedCount: input.displayedCount,
    ...(input.totalCount === undefined ? {} : { totalCount: input.totalCount }),
    ...(input.modelSampleCount === undefined ? {} : {
      modelSample: { count: input.modelSampleCount, userVisible: false },
    }),
  })
)

export interface ResolveDomainAgentTimeRangeOptions {
  defaultPreset?: 'today' | '24h' | '7d' | '30d'
  maxDays?: number
  now?: number
}

export class DomainAgentInputError extends Error {
  readonly code: string
  readonly failureDisposition = 'request' as const
  readonly recoveryAction = 'repair' as const
  readonly retryable = true
  readonly repair = { maxAttempts: 1 }

  constructor(code: string, message: string) {
    super(message)
    this.name = 'DomainAgentInputError'
    this.code = code
  }
}

type DomainAgentMessageValue = string | number
type DomainAgentMessageParams = Record<string, DomainAgentMessageValue> | DomainAgentMessageValue[]

/** Client tool metadata is sent as JetLinks DataType, not raw JSON Schema. */
export type DomainAgentDataType = Record<string, unknown>
export interface DomainAgentValueType extends DomainAgentDataType {
  type: string
}

interface DomainAgentPropertyMetadata {
  id: string
  name: string
  valueType: DomainAgentValueType
  expands?: {
    required?: boolean
  }
}

export const DOMAIN_AGENT_TIME_PRESETS = ['today', '24h', '7d', '30d', 'custom'] as const
export const DOMAIN_AGENT_RELATIVE_TIME_PRESETS = ['today', '24h', '7d', '30d'] as const

export const resolveDomainAgentMessage = (
  key: string,
  params?: DomainAgentMessageParams,
) => {
  if (!params) return String(i18n.global.t(key))
  return String(Array.isArray(params)
    ? i18n.global.t(key, params)
    : i18n.global.t(key, params))
}

export const createDomainAgentInputError = (
  code: string,
  messageKey: string,
  params?: DomainAgentMessageParams,
) => new DomainAgentInputError(code, resolveDomainAgentMessage(messageKey, params))

export const createDomainAgentClaim = (
  id: string,
  label: string,
  value: string | number | boolean,
  format?: string,
): AiClientToolClaim => ({
  id,
  label,
  value,
  ...(format ? { format } : {}),
  visibility: 'user',
})

export const domainAgentEnumValueType = <T extends string>(values: readonly T[]): DomainAgentValueType => ({
  type: 'enum',
  valueType: { type: 'string' },
  elements: values.map(value => ({ value, text: value })),
})

export const domainAgentIntegerValueType = (
  minimum: number,
  maximum: number,
): DomainAgentValueType => ({
  type: 'int',
  min: minimum,
  max: maximum,
})

export const domainAgentStringArrayValueType = (maxItems: number): DomainAgentValueType => ({
  type: 'array',
  elementType: { type: 'string' },
  expands: { maxItems, uniqueItems: true },
})

export const domainAgentEnumArrayValueType = <T extends string>(
  values: readonly T[],
  maxItems = values.length,
): DomainAgentValueType => ({
  type: 'array',
  elementType: domainAgentEnumValueType(values),
  expands: { maxItems, uniqueItems: true },
})

export const domainAgentDateTimeValueType = (): DomainAgentValueType => ({
  type: 'date',
})

export interface DomainAgentTimeScopeDescriptions {
  timeRange: string
  startTime: string
  endTime: string
}

/**
 * Defines one discriminated time scope for model-facing question-data tools.
 * The root constraint is serialized by the shared client-tool adapter, so owning modules never handle `_schema`.
 */
export const createDomainAgentTimeScopeContract = (
  descriptions: DomainAgentTimeScopeDescriptions,
): { inputs: AiClientToolInput[]; parameterSchema: AiClientToolParameterSchema } => ({
  inputs: [
    {
      id: 'timeRange',
      name: 'timeRange',
      description: descriptions.timeRange,
      required: true,
      valueType: domainAgentEnumValueType(DOMAIN_AGENT_TIME_PRESETS),
    },
    {
      id: 'startTime',
      name: 'startTime',
      description: descriptions.startTime,
      valueType: domainAgentDateTimeValueType(),
    },
    {
      id: 'endTime',
      name: 'endTime',
      description: descriptions.endTime,
      valueType: domainAgentDateTimeValueType(),
    },
  ],
  parameterSchema: {
    type: 'object',
    oneOf: [
      {
        title: 'Preset time range',
        required: ['timeRange'],
        properties: {
          timeRange: {
            type: 'string',
            enum: [...DOMAIN_AGENT_RELATIVE_TIME_PRESETS],
            description: descriptions.timeRange,
          },
        },
        not: {
          anyOf: [
            { required: ['startTime'] },
            { required: ['endTime'] },
          ],
        },
      },
      {
        title: 'Custom time range',
        required: ['timeRange', 'startTime', 'endTime'],
        properties: {
          timeRange: { const: 'custom', description: descriptions.timeRange },
          // Branch-local declarations keep the composed schema self-contained for fail-closed tool audits.
          // The generated root properties remain authoritative for the actual date-time constraints.
          startTime: { description: descriptions.startTime },
          endTime: { description: descriptions.endTime },
        },
      },
    ],
  },
})

const domainAgentProperty = (
  id: string,
  valueType: DomainAgentValueType,
  required = false,
): DomainAgentPropertyMetadata => ({
  id,
  name: id,
  valueType,
  ...(required ? { expands: { required: true } } : {}),
})

export const domainAgentResultValueType = (
  data: DomainAgentValueType = { type: 'object' },
): DomainAgentValueType => ({
  type: 'object',
  properties: [
    domainAgentProperty('success', { type: 'boolean' }, true),
    domainAgentProperty('complete', { type: 'boolean' }, true),
    domainAgentProperty('status', domainAgentEnumValueType([
      'ok',
      'empty',
      'partial',
      'forbidden',
      'unavailable',
    ]), true),
    domainAgentProperty('domain', domainAgentEnumValueType([
      'device',
      'video',
      'alarm',
      'visual-search',
    ]), true),
    domainAgentProperty('scope', {
      type: 'object',
      properties: [
        domainAgentProperty('type', domainAgentEnumValueType(['project']), true),
        domainAgentProperty('name', { type: 'string' }),
      ],
    }, true),
    domainAgentProperty('timeRange', {
      type: 'object',
      properties: [
        domainAgentProperty('start', { type: 'long' }, true),
        domainAgentProperty('end', { type: 'long' }, true),
        domainAgentProperty('label', { type: 'string' }),
      ],
    }),
    domainAgentProperty('filters', { type: 'object' }),
    domainAgentProperty('summary', { type: 'object' }, true),
    domainAgentProperty('data', data, true),
    domainAgentProperty('total', { type: 'long', min: 0 }),
    domainAgentProperty('truncated', { type: 'boolean' }, true),
    domainAgentProperty('nextPage', { type: 'int', min: 0 }),
    domainAgentProperty('warnings', {
      type: 'array',
      elementType: { type: 'string' },
    }),
    domainAgentProperty('navigation', {
      type: 'array',
      elementType: {
        type: 'object',
        properties: [
          domainAgentProperty('kind', domainAgentEnumValueType(['menu', 'detail', 'workspace', 'handoff']), true),
          domainAgentProperty('label', { type: 'string' }, true),
          domainAgentProperty('path', { type: 'string' }, true),
          domainAgentProperty('menuCode', { type: 'string' }, true),
          domainAgentProperty('link', { type: 'string' }),
          domainAgentProperty('markdownLink', { type: 'string' }),
          domainAgentProperty('requiresConfirmation', { type: 'boolean' }),
        ],
      },
    }),
    domainAgentProperty('evidence', { type: 'object' }),
    domainAgentProperty('outputBindings', {
      type: 'array',
      elementType: { type: 'object' },
    }),
  ],
})

/** Creates a controlled menu receipt that models can quote without guessing routes. */
export const createDomainAgentMenuNavigation = (input: {
  label: string
  menuCode: string
  path?: string
  requiresConfirmation?: boolean
}): DomainAgentNavigation => {
  const link = `#menu=${encodeURIComponent(input.menuCode)}`
  return {
    kind: 'menu',
    label: input.label,
    path: input.path || '',
    menuCode: input.menuCode,
    link,
    markdownLink: `[${input.label}](${link})`,
    requiresConfirmation: input.requiresConfirmation,
  }
}

const PRESET_DURATION: Record<'24h' | '7d' | '30d', number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

const parseTimestamp = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  const text = String(value).trim()
  const numeric = typeof value === 'number' || /^-?\d+(?:\.\d+)?$/.test(text)
    ? Number(value)
    : undefined
  const timestamp = Number.isFinite(numeric) ? Number(numeric) : new Date(text).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

const hasTimeValue = (value: unknown) => value !== undefined && value !== null && value !== ''

const startOfToday = (timestamp: number) => {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Normalizes every domain tool to the same bounded project-time contract. */
export const resolveDomainAgentTimeRange = (
  input: Record<string, unknown> = {},
  options: ResolveDomainAgentTimeRangeOptions = {},
): DomainAgentTimeRange => {
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now()
  const maxDuration = Math.max(1, options.maxDays ?? 90) * 24 * 60 * 60 * 1000
  const presetValue = input.timeRange ?? options.defaultPreset
  const preset = String(presetValue ?? '').trim()
  const startValue = input.startTime
  const endValue = input.endTime
  const startProvided = hasTimeValue(startValue)
  const endProvided = hasTimeValue(endValue)
  const customStart = parseTimestamp(startValue)
  const customEnd = parseTimestamp(endValue)

  let start: number
  let end: number
  let label: string

  if (preset === 'custom') {
    if (!startProvided || !endProvided) {
      throw createDomainAgentInputError(
        'TIME_RANGE_INCOMPLETE',
        'components.AiChat.domainAgent.errors.timeRangeIncomplete',
      )
    }
    if (customStart === undefined || customEnd === undefined) {
      throw createDomainAgentInputError(
        'TIME_RANGE_INVALID_VALUE',
        'components.AiChat.domainAgent.errors.timeRangeInvalidValue',
      )
    }
    start = customStart
    end = customEnd
    label = 'custom'
  } else if (!preset) {
    throw createDomainAgentInputError(
      'TIME_RANGE_REQUIRED',
      'components.AiChat.domainAgent.errors.timeRangeRequired',
    )
  } else if (startProvided || endProvided) {
    throw createDomainAgentInputError(
      'TIME_RANGE_CONFLICT',
      'components.AiChat.domainAgent.errors.timeRangeConflict',
    )
  } else if (preset === 'today') {
    start = startOfToday(now)
    end = now
    label = preset
  } else if (preset in PRESET_DURATION) {
    start = now - PRESET_DURATION[preset as keyof typeof PRESET_DURATION]
    end = now
    label = preset
  } else {
    throw createDomainAgentInputError(
      'TIME_RANGE_UNSUPPORTED',
      'components.AiChat.domainAgent.errors.timeRangeUnsupported',
      { value: preset },
    )
  }

  if (start >= end) {
    throw createDomainAgentInputError(
      'TIME_RANGE_INVALID',
      'components.AiChat.domainAgent.errors.timeRangeInvalid',
    )
  }
  if (end - start > maxDuration) {
    throw createDomainAgentInputError(
      'TIME_RANGE_TOO_LARGE',
      'components.AiChat.domainAgent.errors.timeRangeTooLarge',
      { days: options.maxDays ?? 90 },
    )
  }

  return { start, end, label }
}

export const resolveDomainAgentInteger = (
  value: unknown,
  options: { name: string; defaultValue: number; min: number; max: number },
) => {
  const parsed = value === undefined || value === null || value === ''
    ? options.defaultValue
    : Number(value)
  if (!Number.isFinite(parsed)) {
    throw createDomainAgentInputError(
      'INTEGER_INVALID',
      'components.AiChat.domainAgent.errors.integerInvalid',
      { name: options.name },
    )
  }
  const result = Math.floor(parsed)
  if (result < options.min || result > options.max) {
    throw createDomainAgentInputError(
      'INTEGER_OUT_OF_RANGE',
      'components.AiChat.domainAgent.errors.integerOutOfRange',
      { name: options.name, min: options.min, max: options.max },
    )
  }
  return result
}

export const resolveDomainAgentEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  options: { name: string; defaultValue?: T },
): T => {
  const normalized = String(value ?? options.defaultValue ?? '').trim() as T
  if (!allowed.includes(normalized)) {
    throw createDomainAgentInputError(
      'ENUM_UNSUPPORTED',
      'components.AiChat.domainAgent.errors.enumUnsupported',
      { name: options.name, values: allowed.join(', ') },
    )
  }
  return normalized
}

export const resolveDomainAgentStringList = (
  value: unknown,
  options: { name: string; max: number },
) => {
  const items = (Array.isArray(value) ? value : String(value || '').split(/[,，、\s]+/))
    .map(item => String(item || '').trim())
    .filter(Boolean)
  const result = Array.from(new Set(items))
  if (result.length > options.max) {
    throw createDomainAgentInputError(
      'LIST_TOO_LARGE',
      'components.AiChat.domainAgent.errors.listTooLarge',
      { name: options.name, max: options.max },
    )
  }
  return result
}

export const createDomainAgentToolResult = <T>(
  input: Omit<DomainAgentToolResult<T>,
    'success' | 'complete' | 'status' | 'truncated' | 'scope' | 'evidence' | 'outputBindings' | 'total'> & {
    status?: DomainAgentStatus
    truncated?: boolean
    /** Required whenever the compatibility `total` field is emitted. */
    cardinality?: DomainAgentCardinality
    scopeName?: string
    evidenceCoverage?: string
    supportsAbsenceClaim?: boolean
    /** Machine-verifiable fields; never inferred from the user-facing summary. */
    facts?: Record<string, unknown>
    /** Explicit scalar facts safe for canonical user-visible fallback. */
    claims?: AiClientToolClaim[]
    outputBindings?: AiClientToolOutputBinding[]
  } & ({ total?: never; cardinality?: DomainAgentCardinality } | { total: number; cardinality: DomainAgentCardinality }),
): DomainAgentToolResult<T> => {
  const {
    scopeName,
    status,
    truncated,
    evidenceCoverage,
    supportsAbsenceClaim,
    facts,
    claims,
    outputBindings,
    cardinality,
    ...result
  } = input
  const recordSet = cardinality?.kind === 'record-set' ? cardinality : undefined
  const aggregate = cardinality?.kind === 'aggregate-series' ? cardinality : undefined
  const preview = cardinality?.kind === 'preview' ? cardinality : undefined
  const cardinalityEmpty = recordSet?.totalCount === 0
    || aggregate?.measurementCount === 0
    || (preview?.displayedCount === 0 && preview.totalCount === 0)
  const incompletePage = input.nextPage !== undefined
    || (recordSet !== undefined && recordSet.totalCount > recordSet.returnedCount)
    || (preview?.totalCount !== undefined && preview.totalCount > preview.displayedCount)
  const resolvedStatus = status ?? (cardinalityEmpty
    || (!cardinality && Array.isArray(input.data) && input.data.length === 0)
    ? 'empty'
    : incompletePage
      ? 'partial'
      : 'ok')
  const complete = resolvedStatus !== 'partial' && !truncated && !incompletePage
  const base = {
    ...result,
    status: resolvedStatus,
    scope: { type: 'project', ...(scopeName ? { name: scopeName } : {}) },
    truncated: truncated ?? false,
  }
  if (resolvedStatus === 'forbidden' || resolvedStatus === 'unavailable') {
    return {
      ...base,
      ...createAiClientToolFailureResult({
        code: String(input.summary?.errorCode || `domain.${resolvedStatus}`),
        message: String(input.warnings?.[0] || resolvedStatus),
        failureDisposition: resolvedStatus === 'forbidden' ? 'permission/user' : 'dependency',
        recoveryAction: resolvedStatus === 'forbidden' ? 'terminal' : 'retry',
        retryable: resolvedStatus === 'unavailable',
      }),
      complete: false,
    } as DomainAgentToolResult<T>
  }
  return withAiClientToolEvidence(base, {
    requestedRange: input.timeRange ? { ...input.timeRange } : undefined,
    cardinality,
    complete,
    truncated: !complete,
    resultStatus: resolvedStatus,
    evidenceCoverage: evidenceCoverage || 'filtered-query',
    supportsAbsenceClaim,
    facts,
    claims,
    warnings: input.warnings,
    outputBindings,
  }) as DomainAgentToolResult<T>
}

const toRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
)

const errorStatus = (error: unknown): DomainAgentStatus => {
  const record = toRecord(error)
  const response = toRecord(record.response)
  const responseData = toRecord(response.data)
  const status = Number(record.status ?? response.status ?? responseData.status)
  return status === 401 || status === 403 ? 'forbidden' : 'unavailable'
}

export const createDomainAgentErrorResult = <T>(
  domain: DomainAgentName,
  data: T,
  error: unknown,
  summary: Record<string, unknown> = {},
): DomainAgentToolResult<T> => {
  const status = errorStatus(error)
  const record = toRecord(error)
  const response = toRecord(record.response)
  const responseData = toRecord(response.data)
  const errorCode = String(record.code ?? responseData.code ?? '').trim()
  return createDomainAgentToolResult({
    domain,
    status,
    data,
    summary: {
      ...summary,
      ...(errorCode ? { errorCode } : {}),
    },
    warnings: [resolveDomainAgentMessage(
      status === 'forbidden'
        ? 'components.AiChat.domainAgent.errors.forbidden'
        : 'components.AiChat.domainAgent.errors.unavailable',
    )],
  })
}
