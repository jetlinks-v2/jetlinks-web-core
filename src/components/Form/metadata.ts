import dayjs from 'dayjs'
import { compareNumber, isNumber } from 'lossless-json'
import { cloneDeep } from 'lodash-es'
import type { I18nMessages } from '../I18n/types'
import type { FormAccess, FormField, FormOption, FormValidate, FormValues } from './types'

export interface FormValueTypeMetadata {
  type: string
  format?: string
  unit?: string
  multi?: boolean
  elements?: Array<{ value: FormOption['value']; text: string }>
  elementType?: FormValueTypeMetadata
  [key: string]: unknown
}

/** 接受平台原属性模型的结构投影，未知语义保留在原对象，不复制另一套物模型。 */
export interface FormPropertyMetadata {
  id: string
  name?: string
  description?: string
  valueType: FormValueTypeMetadata
  expands?: Record<string, unknown>
}

export interface FormMetadataBinding {
  /** 宿主分配的稳定标识；多来源应包含来源身份，不能只用展示名或同名字段。 */
  key: string
  property: FormPropertyMetadata
  /** 精确的数据段；含点字段名作为一个段传入，不解析字符串表达式。 */
  path: readonly string[]
  /** 本绑定所属记录的实际写入阶段，由宿主确定；缺省使用整张表单的 operation。 */
  operation?: 'create' | 'update'
  options?: FormOption[]
  renderer?: string
  decode?: (value: unknown) => unknown
  encode?: (value: unknown) => unknown
}

export type FormMetadataIssue = 'invalidNumber' | 'invalidDate' | 'invalidOption' | 'minimum' | 'maximum' | 'maxLength'
export interface FormMetadataOptions {
  /** 当前会话的明确授权；缺省仅查看，布局和列能力不能提升它。 */
  access?: FormAccess
  operation?: 'create' | 'update'
  message: (issue: FormMetadataIssue, params?: { value: string }) => string
}

const numericTypes = new Set(['int', 'long', 'float', 'double', 'number'])
const optionValues = (value: unknown, multiple?: boolean) => multiple ? Array.isArray(value) ? value : [] : [value]

function enumeration(valueType: FormValueTypeMetadata) {
  return valueType.type === 'enum' ? valueType : valueType.type === 'array' && valueType.elementType?.type === 'enum' ? valueType.elementType : undefined
}

function enumValue(binding: FormMetadataBinding, value: unknown): unknown {
  const scalar = value && typeof value === 'object' && 'value' in value ? value.value : value
  const elements = enumeration(binding.property.valueType)?.elements
  // 平台 EnumType 的代码为字符串，EnumDict 响应的 value 也可能是数字；以声明的选项协议为准。
  // 宿主显式提供的 typed options 保持严格身份，不合并 1、'1' 和 false。
  return !binding.options && elements?.every(item => typeof item.value === 'string')
    ? elements.find(item => item.value === String(scalar))?.value ?? scalar : scalar
}

function read(source: unknown, path: readonly string[]): unknown {
  let current = source
  for (const key of path) {
    if (!current || typeof current !== 'object' || !Object.hasOwn(current, key)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function write(target: FormValues, path: readonly string[], value: unknown) {
  for (const key of path.slice(0, -1)) {
    if (!Object.hasOwn(target, key)) Object.defineProperty(target, key, { value: {}, enumerable: true, writable: true })
    const nested = target[key]
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) throw new Error('Overlapping form binding paths')
    target = nested as FormValues
  }
  Object.defineProperty(target, path.at(-1)!, { value: cloneDeep(value), enumerable: true, writable: true, configurable: true })
}

/** 名称与选项文字沿平台 name/text 键读取，页面覆盖仍使用 Form 的 label。 */
function messages(value: unknown, labelKey: string): I18nMessages | undefined {
  if (!value || typeof value !== 'object') return undefined
  const source = value as I18nMessages
  return { ...source, label: source[labelKey] }
}

function field(binding: FormMetadataBinding, operation: 'create' | 'update', value: unknown): FormField {
  const property = binding.property
  const attributes = property.expands ?? {}
  const valueType = property.valueType
  const enumType = enumeration(valueType)
  const multiple = (valueType.type === 'array' && !!enumType) || valueType.multi === true
  let type: FormField['type'] = 'custom'
  switch (valueType.type) {
    case 'string': case 'text': type = attributes.fieldType === 'TEXT' || valueType.type === 'text' ? 'textarea' : 'text'; break
    case 'boolean': type = 'boolean'; break
    case 'enum': type = 'enum'; break
    case 'array': if (enumType) type = 'enum'; break
    case 'date': type = attributes.fieldType === 'DATE' || valueType.format === 'yyyy-MM-dd' ? 'date' : 'datetime'; break
    default:
      if (numericTypes.has(valueType.type)) type = attributes.numericRepresentation === 'decimal' || valueType.type === 'long' ? 'text' : 'number'
  }
  // 引用只提供展示线索，编辑器和关系维护由宿主原能力提供，不能凭引用生成写操作。
  const renderer = binding.renderer ?? (attributes.reference ? 'reference' : undefined)
  if (renderer) type = 'custom'
  const source = attributes.optionSource as { items?: Array<{ value: FormOption['value']; text: string; i18nMessages?: unknown }> } | undefined
  const selectable = Array.isArray(attributes.selectableOptions) ? attributes.selectableOptions : undefined
  const pool: FormOption[] | undefined = binding.options ?? enumType?.elements?.map(option => {
    const original = source?.items?.find(item => Object.is(item.value, option.value))
    return { value: option.value, label: option.text, i18nMessages: messages(original?.i18nMessages, 'text') }
  })
  const options = pool?.map(option => ({ ...option, disabled: !!option.disabled || !!selectable && !selectable.some(value => Object.is(value, option.value)) }))
  // EnumDict 响应的当前语言文案优先；未知历史项只能保留或移除，不能变成新的可选项。
  const enumOptions = options ?? []
  if (type === 'enum') for (const item of optionValues(value, multiple)) {
    if (!item || typeof item !== 'object' || !('value' in item) || !('text' in item) || typeof item.text !== 'string') continue
    const identity = enumValue(binding, item)
    if (typeof identity !== 'string' && typeof identity !== 'number' && typeof identity !== 'boolean') continue
    const existing = enumOptions.find(option => Object.is(option.value, identity))
    if (existing) { existing.label = item.text; existing.i18nMessages = undefined }
    else enumOptions.push({ value: identity, label: item.text, disabled: true })
  }
  return {
    key: binding.key, label: property.name || property.id, type, renderer,
    description: property.description,
    unit: typeof attributes.unit === 'string' ? attributes.unit : valueType.unit,
    i18nMessages: messages(attributes.i18nMessages, 'name'),
    required: attributes.required === true,
    readonly: attributes.readOnly === true || attributes.writable === false || attributes[operation === 'create' ? 'insertable' : 'updatable'] === false,
    multiple, options: type === 'enum' ? enumOptions : options,
  }
}

function decode(binding: FormMetadataBinding, field: FormField, value: unknown): unknown {
  if (binding.decode) return binding.decode(value)
  if (value == null) return value
  if (field.type === 'enum') {
    const scalar = (item: unknown) => enumValue(binding, item)
    return cloneDeep(field.multiple && Array.isArray(value) ? value.map(scalar) : scalar(value))
  }
  if (field.type === 'date' || field.type === 'datetime') {
    const time = dayjs(value as string | number)
    return time.isValid() ? time.format(field.type === 'date' ? 'YYYY-MM-DD' : time.millisecond() ? 'YYYY-MM-DDTHH:mm:ss.SSS' : 'YYYY-MM-DDTHH:mm:ss') : value
  }
  if (field.type === 'text' && numericTypes.has(binding.property.valueType.type)) return String(value)
  return cloneDeep(value)
}

function encode(binding: FormMetadataBinding, field: FormField, value: unknown): unknown {
  if (binding.encode) return binding.encode(value)
  if (value == null) return value
  if (value === '' && (numericTypes.has(binding.property.valueType.type) || field.type === 'date' || field.type === 'datetime')) return null
  if (field.type === 'datetime') {
    const time = dayjs(value as string)
    return binding.property.expands?.fieldType === 'DATETIME' || binding.property.valueType.format !== 'timestamp'
      ? time.toISOString() : time.valueOf()
  }
  // 日期不经过 UTC 转换；高精度数字以原字符串提交，后端按原声明类型转换。
  return cloneDeep(value)
}

/**
 * 纯元数据适配：宿主提供原模型、精确路径和会话能力，返回 Form 所需投影及差异回写。
 * HTTP、字典加载、时区策略、布局发布和本体路由仍由宿主处理。
 * 原模型及相对路径上下文保存在 bindings，供引用、观测质量等业务表现读取。
 */
export function createMetadataForm(bindings: readonly FormMetadataBinding[], source: FormValues, options: FormMetadataOptions) {
  const registry = new Map<string, FormMetadataBinding>()
  for (const binding of bindings) {
    if (registry.has(binding.key) || !binding.path.length) throw new Error('Form bindings require unique keys and nonempty paths')
    registry.set(binding.key, binding)
  }
  const fields: FormField[] = []
  const access: FormAccess = {}
  const values: FormValues = {}
  for (const binding of bindings) {
    const allowed = options.access?.[binding.key] ?? 'read'
    const readable = allowed !== 'denied' && allowed !== 'hidden'
    const value = readable ? read(source, binding.path) : undefined
    const current = field(binding, binding.operation ?? options.operation ?? 'update', value)
    fields.push(current)
    access[current.key] = allowed === 'write' && current.readonly ? 'read' : allowed
    if (readable) {
      Object.defineProperty(values, current.key, { value: decode(binding, current, value), enumerable: true })
    }
  }
  const fieldByKey = new Map(fields.map(field => [field.key, field]))
  const validate: FormValidate = (value, current) => {
    if (value == null || value === '') return
    const binding = registry.get(current.key)!
    const attributes = binding.property.expands ?? {}
    const issue = (code: FormMetadataIssue, bound?: unknown) => options.message(code, bound === undefined ? undefined : { value: String(bound) })
    if (numericTypes.has(binding.property.valueType.type)) {
      if (!isNumber(String(value))) return issue('invalidNumber')
      if (attributes.minimum != null && compareNumber(String(value), String(attributes.minimum)) < 0) return issue('minimum', attributes.minimum)
      if (attributes.maximum != null && compareNumber(String(value), String(attributes.maximum)) > 0) return issue('maximum', attributes.maximum)
    }
    if ((current.type === 'date' || current.type === 'datetime') && !dayjs(value as string).isValid()) return issue('invalidDate')
    if (typeof value === 'string' && typeof attributes.maxLength === 'number' && value.length > attributes.maxLength) return issue('maxLength', attributes.maxLength)
    if (current.type === 'enum') {
      const previous = optionValues(values[current.key], current.multiple)
      const valid = optionValues(value, current.multiple).every(value => {
        const option = current.options?.find(option => Object.is(option.value, value))
        return option && !option.disabled || previous.some(old => Object.is(old, value))
      })
      if (!valid) return issue('invalidOption')
    }
  }
  function toPatch(changes: FormValues): FormValues {
    const patch: FormValues = {}
    for (const [key, value] of Object.entries(changes)) {
      const binding = registry.get(key)
      const current = fieldByKey.get(key)
      if (binding && current && access[key] === 'write') write(patch, binding.path, encode(binding, current, value))
    }
    return patch
  }
  return { fields, values, access, bindings: registry, validate, toPatch }
}
