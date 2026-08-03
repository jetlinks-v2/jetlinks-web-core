import type {
  CapabilityOption,
  DataPath,
  DataSourceResult,
  OptionSourceDefinition,
  OptionSourceRef,
  OptionSourceResult,
  RuntimeOptionRequest,
} from '../types'
import { createCapabilityError } from '../utils'
import { capabilitySchemaValidator } from '../validation'

type DynamicOptionSourceRef = Extract<OptionSourceRef, { type: 'provider' | 'data-source' }>
type DataSourceOptionRef = Extract<OptionSourceRef, { type: 'data-source' }>

export function assertOptionRequest(request: RuntimeOptionRequest): void {
  if (request.keyword !== undefined && typeof request.keyword !== 'string') {
    throw invalidOptionRequest('keyword')
  }
  if (request.pageIndex !== undefined && (!Number.isInteger(request.pageIndex) || request.pageIndex < 0)) {
    throw invalidOptionRequest('pageIndex')
  }
  if (request.pageSize !== undefined && (!Number.isInteger(request.pageSize) || request.pageSize <= 0)) {
    throw invalidOptionRequest('pageSize')
  }
}

export function mergeOptionQuery(
  ref: DynamicOptionSourceRef,
  query: Record<string, unknown> | undefined,
  request: RuntimeOptionRequest,
): Record<string, unknown> | undefined {
  const result = { ...(query || {}) }
  if (ref.keywordParam && request.keyword !== undefined) {
    result[ref.keywordParam] = request.keyword
  }
  if (ref.pagination) {
    if (request.pageIndex !== undefined) result.pageIndex = request.pageIndex
    if (request.pageSize !== undefined) result.pageSize = request.pageSize
  }
  return Object.keys(result).length ? result : undefined
}

export function assertProjectionRef(ref: DataSourceOptionRef): void {
  const hasLabel = ref.labelPath !== undefined
  const hasValue = ref.valuePath !== undefined
  if (hasLabel !== hasValue || (ref.childrenPath !== undefined && !hasLabel)) {
    throw createCapabilityError('option_source.invalid_ref', 'Option projection is incomplete', {
      capabilityId: ref.capability.capabilityId,
      details: { reason: 'labelPath_and_valuePath_required' },
    })
  }
}

export function normalizeStaticOptions(value: unknown): CapabilityOption[] {
  return normalizeOptions(value)
}

export function normalizeProviderOptionResult(
  result: unknown,
  definition: OptionSourceDefinition,
): OptionSourceResult {
  if (!isPlainRecord(result)) throw invalidOptionResult([], 'result_not_object', definition.id)
  const options = normalizeOptions(result.options, definition.id)
  options.forEach((option) => capabilitySchemaValidator.assert(definition.optionSchema, option, {
    phase: 'output',
    capabilityId: definition.id,
  }))
  return normalizeResultMetadata(options, result.total, result.diagnostics, definition.id)
}

export function normalizeDataSourceOptionResult(
  result: DataSourceResult,
  ref: DataSourceOptionRef,
): OptionSourceResult {
  const options = projectDataSourceOptions(result.data, ref)
  return normalizeResultMetadata(options, result.total, result.diagnostics, ref.capability.capabilityId)
}

function invalidOptionRequest(field: string) {
  return createCapabilityError('option_source.invalid_request', 'Option request is invalid', {
    details: { field },
  })
}

function projectDataSourceOptions(value: unknown, ref: DataSourceOptionRef): CapabilityOption[] {
  if (!ref.labelPath || !ref.valuePath) return normalizeOptions(value, ref.capability.capabilityId)
  if (!Array.isArray(value)) throw invalidOptionResult([], 'options_not_array', ref.capability.capabilityId)
  return value.map((item, index) => projectOption(item, ref, [index]))
}

function projectOption(item: unknown, ref: DataSourceOptionRef, path: DataPath): CapabilityOption {
  const label = readPath(item, ref.labelPath || [])
  const value = readPath(item, ref.valuePath || [])
  if (!label.found || typeof label.value !== 'string') {
    throw invalidOptionResult([...path, ...(ref.labelPath || [])], 'label_not_string', ref.capability.capabilityId)
  }
  if (!value.found) {
    throw invalidOptionResult([...path, ...(ref.valuePath || [])], 'value_missing', ref.capability.capabilityId)
  }
  const option: CapabilityOption = {
    label: label.value,
    value: cloneSerializable(value.value, [...path, ...(ref.valuePath || [])], ref.capability.capabilityId),
  }
  copyStandardOptionMetadata(item, option, path, ref.capability.capabilityId)
  if (ref.childrenPath) {
    const children = readPath(item, ref.childrenPath)
    if (children.found) {
      if (!Array.isArray(children.value)) {
        throw invalidOptionResult([...path, ...ref.childrenPath], 'children_not_array', ref.capability.capabilityId)
      }
      option.children = children.value.map((child, index) => (
        projectOption(child, ref, [...path, ...ref.childrenPath!, index])
      ))
    }
  }
  return option
}

function normalizeResultMetadata(
  options: CapabilityOption[],
  totalValue: unknown,
  diagnosticsValue: unknown,
  capabilityId?: string,
): OptionSourceResult {
  if (totalValue !== undefined
    && (typeof totalValue !== 'number' || !Number.isFinite(totalValue) || totalValue < 0)) {
    throw invalidOptionResult(['total'], 'total_not_non_negative_number', capabilityId)
  }
  const diagnostics = diagnosticsValue === undefined
    ? undefined
    : cloneSerializable(diagnosticsValue, ['diagnostics'], capabilityId)
  if (diagnostics !== undefined && !isPlainRecord(diagnostics)) {
    throw invalidOptionResult(['diagnostics'], 'diagnostics_not_object', capabilityId)
  }
  return {
    options,
    total: totalValue as number | undefined,
    diagnostics,
  }
}

function normalizeOptions(value: unknown, capabilityId?: string): CapabilityOption[] {
  if (!Array.isArray(value)) throw invalidOptionResult([], 'options_not_array', capabilityId)
  return value.map((option, index) => normalizeOption(option, [index], capabilityId))
}

function normalizeOption(value: unknown, path: DataPath, capabilityId?: string): CapabilityOption {
  if (!isPlainRecord(value)) throw invalidOptionResult(path, 'option_not_object', capabilityId)
  if (typeof value.label !== 'string') throw invalidOptionResult([...path, 'label'], 'label_not_string', capabilityId)
  if (!Object.prototype.hasOwnProperty.call(value, 'value')) {
    throw invalidOptionResult([...path, 'value'], 'value_missing', capabilityId)
  }
  const option: CapabilityOption = {
    label: value.label,
    value: cloneSerializable(value.value, [...path, 'value'], capabilityId),
  }
  copyStandardOptionMetadata(value, option, path, capabilityId)
  if (Object.prototype.hasOwnProperty.call(value, 'children')) {
    if (!Array.isArray(value.children)) {
      throw invalidOptionResult([...path, 'children'], 'children_not_array', capabilityId)
    }
    option.children = value.children.map((child, index) => (
      normalizeOption(child, [...path, 'children', index], capabilityId)
    ))
  }
  return option
}

function copyStandardOptionMetadata(
  value: unknown,
  option: CapabilityOption,
  path: DataPath,
  capabilityId?: string,
): void {
  if (!isPlainRecord(value)) return
  if (Object.prototype.hasOwnProperty.call(value, 'disabled')) {
    if (typeof value.disabled !== 'boolean') {
      throw invalidOptionResult([...path, 'disabled'], 'disabled_not_boolean', capabilityId)
    }
    option.disabled = value.disabled
  }
  if (Object.prototype.hasOwnProperty.call(value, 'metadata')) {
    const metadata = cloneSerializable(value.metadata, [...path, 'metadata'], capabilityId)
    if (!isPlainRecord(metadata)) {
      throw invalidOptionResult([...path, 'metadata'], 'metadata_not_object', capabilityId)
    }
    option.metadata = metadata
  }
}

function cloneSerializable(
  value: unknown,
  path: DataPath,
  capabilityId?: string,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) {
    if (seen.has(value)) throw invalidOptionResult(path, 'cyclic_value', capabilityId)
    seen.add(value)
    const result = value.map((item, index) => cloneSerializable(item, [...path, index], capabilityId, seen))
    seen.delete(value)
    return result
  }
  if (isPlainRecord(value)) {
    if (seen.has(value)) throw invalidOptionResult(path, 'cyclic_value', capabilityId)
    seen.add(value)
    const result: Record<string, unknown> = {}
    Object.entries(value).forEach(([key, item]) => {
      // Define an own data property so values such as "__proto__" cannot mutate the clone prototype.
      Object.defineProperty(result, key, {
        value: cloneSerializable(item, [...path, key], capabilityId, seen),
        enumerable: true,
        configurable: true,
        writable: true,
      })
    })
    seen.delete(value)
    return result
  }
  throw invalidOptionResult(path, 'value_not_serializable', capabilityId)
}

function readPath(value: unknown, path: DataPath): { found: boolean; value?: unknown } {
  let current = value
  for (const key of path) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, key)) {
      return { found: false }
    }
    current = (current as Record<string | number, unknown>)[key]
  }
  return { found: true, value: current }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function invalidOptionResult(path: DataPath, reason: string, capabilityId?: string) {
  return createCapabilityError('option_source.invalid_result', 'Option source returned an invalid result', {
    capabilityId,
    details: { path, reason },
  })
}
