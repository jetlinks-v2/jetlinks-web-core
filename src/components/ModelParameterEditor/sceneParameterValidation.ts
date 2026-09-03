import {
  asRecord,
  isTargetInferenceProperty,
  normalizeParameterProperties,
  readPath,
  type ParameterRecord
} from './modelParameterUtils'

function isEmptyParameterValue(value: unknown) {
  if (value === undefined || value === null) return true
  if (typeof value === 'number') return Number.isNaN(value)
  return typeof value === 'string' && !value.trim()
}

export function validateImageUserParameters(definition: ParameterRecord) {
  const values = asRecord(definition.processImage) || {}
  // Image user parameters are required only when they are declared in testParams.
  const imageProperties = normalizeParameterProperties(definition).filter(property => (
    !isTargetInferenceProperty(property.property) && Boolean(property.testParamsDefinition)
  ))
  return imageProperties
    .filter(property => isEmptyParameterValue(readPath(values, property.property)))
    .map(property => property.property)
}
