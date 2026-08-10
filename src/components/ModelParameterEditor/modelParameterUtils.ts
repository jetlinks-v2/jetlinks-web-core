import { cloneDeep } from 'lodash-es'
import type {
  ModelParameterDefinitionSource,
  ModelParameterInputType,
  ModelParameterOption,
  ModelParameterProperty,
  ModelParameterScene
} from './types'
import {
  asRecord,
  hasOwn
} from './parameterPathUtils'

export { asRecord, hasOwn, hasPath, readPath, removePath, writePath } from './parameterPathUtils'

export type ParameterRecord = Record<string, any>

export function isTargetInferenceProperty(property: string) {
  return property === 'targetInference' || property.startsWith('targetInference.')
}

export function getRawParameterProperties(value: unknown): ParameterRecord[] {
  const definition = asRecord(value)
  const rawProperties = definition?.properties
  const properties = Array.isArray(rawProperties)
    ? rawProperties
    : Object.values(asRecord(rawProperties) || {})

  return properties
    .map(asRecord)
    .filter((property): property is ParameterRecord => !!property)
}

export function getParameterPropertyKey(value: unknown) {
  const property = asRecord(value)?.property
  return property === undefined || property === null ? '' : String(property)
}

export function buildParameterDefinition(
  property: ModelParameterProperty,
  source: ModelParameterDefinitionSource
) {
  const sourceDefinition = source === 'params'
    ? property.paramsDefinition || property.testParamsDefinition
    : property.testParamsDefinition || property.paramsDefinition
  const nextProperty = cloneDeep(sourceDefinition || {})
  nextProperty.property = property.property
  nextProperty.name = property.name
  nextProperty.description = property.description ?? ''
  updateRawParameterType(nextProperty, property.typeName)
  return nextProperty
}

function updateRawParameterType(property: ParameterRecord, value: string) {
  const type = asRecord(property.type)
  if (type) {
    property.type = { ...type, type: value }
    return
  }
  if (hasOwn(property, 'type')) {
    property.type = value
    return
  }
  const valueType = asRecord(property.valueType)
  if (valueType) {
    property.valueType = { ...valueType, type: value }
    return
  }
  property.type = { type: value }
}

export function getDefinitionSourceForScene(scene: ModelParameterScene): ModelParameterDefinitionSource {
  return scene === 'processImage' ? 'testParams' : 'params'
}

export function stringifyJson(value: unknown) {
  if (value === undefined || value === null) return '{}'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '{}'
  }
}

export function normalizeParameterProperties(definition: ParameterRecord): ModelParameterProperty[] {
  const merged = new Map<string, {
    paramsDefinition?: ParameterRecord
    testParamsDefinition?: ParameterRecord
  }>()

  for (const [source, value] of [
    ['params', definition.params],
    ['testParams', definition.testParams]
  ] as const) {
    for (const propertyDefinition of getRawParameterProperties(value)) {
      const property = getParameterPropertyKey(propertyDefinition)
      if (!property) continue

      const current = merged.get(property) || {}
      current[source === 'params' ? 'paramsDefinition' : 'testParamsDefinition'] = propertyDefinition
      merged.set(property, current)
    }
  }

  return Array.from(merged, ([property, definitions]) => {
    const valueType = normalizeValueType(
      firstDefined(
        [definitions.paramsDefinition, definitions.testParamsDefinition],
        ['valueType']
      ) ?? firstDefined(
        [definitions.paramsDefinition, definitions.testParamsDefinition],
        ['type']
      )
    )
    const inputType = resolveInputType(valueType)
    const name = firstDefined(
      [definitions.paramsDefinition, definitions.testParamsDefinition],
      ['name']
    ) ?? firstDefined(
      [definitions.paramsDefinition, definitions.testParamsDefinition],
      ['label']
    ) ?? property
    const description = firstDefined(
      [definitions.paramsDefinition, definitions.testParamsDefinition],
      ['description']
    )

    return {
      property,
      name: String(name),
      typeName: String(valueType.type ?? ''),
      description: description === undefined || description === null ? undefined : String(description),
      valueType,
      inputType,
      options: inputType === 'select' ? normalizeOptions(valueType.elements) : undefined,
      ...definitions
    }
  })
}

function firstDefined(sources: Array<ParameterRecord | undefined>, keys: string[]) {
  for (const source of sources) {
    if (!source) continue
    for (const key of keys) {
      if (hasOwn(source, key) && source[key] !== undefined && source[key] !== null) {
        return source[key]
      }
    }
  }
  return undefined
}

export function normalizeValueType(valueType: unknown): ParameterRecord {
  if (typeof valueType === 'string') return { type: valueType }
  return asRecord(valueType) || { type: 'string' }
}

export function resolveInputType(valueType: ParameterRecord): ModelParameterInputType {
  const type = String(valueType.type || '').toLowerCase()
  if (['int', 'integer', 'long', 'float', 'double', 'number'].includes(type)) return 'number'
  if (type === 'boolean') return 'boolean'
  if (type === 'enum') return 'select'
  if (['array', 'object'].includes(type)) return 'json'
  return 'text'
}

export function normalizeOptions(elements: unknown): ModelParameterOption[] {
  if (!Array.isArray(elements)) return []
  return elements.map(element => {
    const item = asRecord(element)
    if (!item) return { label: String(element), value: element }
    const value = hasOwn(item, 'value') ? item.value : item.id
    return {
      label: String(item.text ?? item.label ?? item.name ?? value ?? ''),
      value
    }
  })
}

export function getModelFileValue(path: string | undefined, name: string) {
  const normalizedPath = String(path || '').replace(/^\/+|\/+$/g, '')
  if (!normalizedPath || normalizedPath === 'models') return name
  return normalizedPath.startsWith('models/')
    ? `${normalizedPath.slice('models/'.length)}/${name}`
    : `${normalizedPath}/${name}`
}

export function getModelFileLabel(path: string | undefined, name: string) {
  const normalizedPath = String(path || '').replace(/^\/+|\/+$/g, '')
  return normalizedPath ? `${normalizedPath}/${name}` : name
}
