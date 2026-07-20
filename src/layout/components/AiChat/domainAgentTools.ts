import i18n from '@jetlinks-web-core/locales'
import {
  createAiClientToolFailureResult,
  withAiClientToolEvidence,
  type AiClientToolEvidence,
  type AiClientToolClaim,
  type AiClientToolOutputBinding,
} from './clientToolResult'

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
  const presetValue = input.timeRange ?? input.preset ?? options.defaultPreset
  const preset = String(presetValue ?? '').trim()
  const startValue = input.startTime ?? input.start
  const endValue = input.endTime ?? input.end
  const startProvided = hasTimeValue(startValue)
  const endProvided = hasTimeValue(endValue)
  const customStart = parseTimestamp(startValue)
  const customEnd = parseTimestamp(endValue)

  let start: number
  let end: number
  let label: string

  if (startProvided || endProvided) {
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
  } else if (preset === 'custom') {
    throw createDomainAgentInputError(
      'TIME_RANGE_INCOMPLETE',
      'components.AiChat.domainAgent.errors.timeRangeIncomplete',
    )
  } else if (!preset) {
    throw createDomainAgentInputError(
      'TIME_RANGE_REQUIRED',
      'components.AiChat.domainAgent.errors.timeRangeRequired',
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
    'success' | 'complete' | 'status' | 'truncated' | 'scope' | 'evidence' | 'outputBindings'> & {
    status?: DomainAgentStatus
    truncated?: boolean
    scopeName?: string
    evidenceCoverage?: string
    supportsAbsenceClaim?: boolean
    /** Machine-verifiable fields; never inferred from the user-facing summary. */
    facts?: Record<string, unknown>
    /** Explicit scalar facts safe for canonical user-visible fallback. */
    claims?: AiClientToolClaim[]
    outputBindings?: AiClientToolOutputBinding[]
  },
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
    ...result
  } = input
  const resolvedStatus = status ?? (Array.isArray(input.data) && input.data.length === 0 ? 'empty' : 'ok')
  const returnedCount = Array.isArray(input.data) ? input.data.length : undefined
  const incompletePage = input.nextPage !== undefined
    || (Number.isFinite(input.total) && returnedCount !== undefined && Number(input.total) > returnedCount)
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
    requestedRange: input.timeRange,
    recordCount: Number.isFinite(input.total) ? Number(input.total) : returnedCount,
    returnedCount,
    complete,
    truncated: !complete,
    resultStatus: resolvedStatus,
    evidenceCoverage: evidenceCoverage || 'filtered-query',
    supportsAbsenceClaim: supportsAbsenceClaim === true,
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
