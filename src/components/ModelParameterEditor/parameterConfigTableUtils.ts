import { cloneDeep } from 'lodash-es'
import {
  asRecord,
  buildParameterDefinition,
  hasPath,
  normalizeValueType,
  readPath,
  removePath,
  resolveInputType,
  writePath,
  type ParameterRecord
} from './modelParameterUtils'
import type {
  ModelParameterDefinitionSource,
  ModelParameterProperty,
  ModelParameterPropertyField,
  ModelParameterScene
} from './types'

export interface ParameterRow extends ModelParameterProperty {
  rowId: string
  originalProperty?: string
  draft?: boolean
  paramsChecked: boolean
  testParamsChecked: boolean
}

export type ParameterValidationField = ModelParameterPropertyField | 'applicability'
export type ParameterValidationErrors = Partial<Record<ParameterValidationField, true>>

export const parameterTypeOptions = ['int', 'long', 'float', 'double', 'string', 'boolean']
  .map(type => ({ label: type, value: type }))

export function toEditableRow(property: ModelParameterProperty): ParameterRow {
  return {
    ...cloneDeep(property),
    rowId: `property:${property.property}`,
    originalProperty: property.property,
    paramsChecked: Boolean(property.paramsDefinition),
    testParamsChecked: Boolean(property.testParamsDefinition)
  }
}

export function validateParameterRows(rowsToValidate: ParameterRow[]) {
  const errors: Record<string, ParameterValidationErrors> = {}
  rowsToValidate.forEach(property => {
    const rowErrors: ParameterValidationErrors = {}
    if (!property.name.trim()) rowErrors.name = true
    if (!property.property.trim()) rowErrors.property = true
    if (!property.typeName.trim()) rowErrors.type = true
    if (!property.paramsChecked && !property.testParamsChecked) rowErrors.applicability = true
    if (Object.keys(rowErrors).length) errors[property.rowId] = rowErrors
  })
  return errors
}

export function buildParameterDefinitionFromRows(
  definition: ParameterRecord,
  rowsToSave: ParameterRow[],
  initialRows: ParameterRow[]
) {
  // Rebuild both definition lists only at save time, keeping draft row order independent from parent updates.
  const next = cloneDeep(definition)
  const currentOriginalProperties = new Set(
    rowsToSave.map(row => row.originalProperty).filter(Boolean)
  )

  initialRows.forEach(row => {
    if (row.originalProperty && !currentOriginalProperties.has(row.originalProperty)) {
      removeParameterValues(next, row.originalProperty)
    }
  })

  rowsToSave.forEach(row => {
    if (row.originalProperty && row.originalProperty !== row.property) {
      moveParameterValue(next, 'setupTranscode', row.originalProperty, row.property)
      moveParameterValue(next, 'processImage', row.originalProperty, row.property)
    }
    if (!row.paramsChecked) removePathForScene(next, 'setupTranscode', row.property)
    if (!row.testParamsChecked) removePathForScene(next, 'processImage', row.property)
  })

  for (const source of ['params', 'testParams'] as ModelParameterDefinitionSource[]) {
    const targetDefinition = asRecord(next[source]) || {}
    targetDefinition.properties = rowsToSave
      .filter(row => source === 'params' ? row.paramsChecked : row.testParamsChecked)
      .map(row => buildParameterDefinition(row, source))
    next[source] = targetDefinition
  }
  return next
}

export function buildParameterPreviewFromRows(
  definition: ParameterRecord,
  rowsToPreview: ParameterRow[]
) {
  const next = cloneDeep(definition)

  // Preview definition edits in the scene tabs without applying save-time value removal.
  for (const source of ['params', 'testParams'] as ModelParameterDefinitionSource[]) {
    const rows = rowsToPreview
      .filter(row => (source === 'params' ? row.paramsChecked : row.testParamsChecked) && row.property.trim())
    const current = asRecord(next[source])
    if (!current && !rows.length) continue
    const targetDefinition = cloneDeep(current || {})
    targetDefinition.properties = rows.map(row => buildParameterDefinition(row, source))
    next[source] = targetDefinition
  }

  return next
}

function removeParameterValues(definition: ParameterRecord, property: string) {
  removePathForScene(definition, 'setupTranscode', property)
  removePathForScene(definition, 'processImage', property)
}

function removePathForScene(definition: ParameterRecord, scene: ModelParameterScene, property: string) {
  const sceneParams = asRecord(definition[scene])
  if (sceneParams) removePath(sceneParams, property)
}

function moveParameterValue(
  definition: ParameterRecord,
  scene: ModelParameterScene,
  sourcePath: string,
  targetPath: string
) {
  const sceneParams = asRecord(definition[scene])
  if (!sceneParams || !hasPath(sceneParams, sourcePath)) return
  const value = cloneDeep(readPath(sceneParams, sourcePath))
  removePath(sceneParams, sourcePath)
  writePath(sceneParams, targetPath, value)
}

export function updateEditableProperty(
  property: ParameterRow,
  field: ModelParameterPropertyField,
  value: string
) {
  if (field !== 'type') return { ...property, [field]: value }
  const valueType = { ...normalizeValueType(property.valueType), type: value }
  return {
    ...property,
    typeName: value,
    valueType,
    inputType: resolveInputType(valueType)
  }
}
