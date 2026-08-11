import { cloneDeep } from 'lodash-es'
import {
  getParameterPropertyKey,
  getRawParameterProperties
} from './modelParameterUtils'
import { asRecord, writePath } from './parameterPathUtils'

export type TargetInferenceValue = Record<string, any>
export type TargetInferenceOperationKind = 'vector' | 'features' | 'parts'

export interface TargetInferenceOperationDraft {
  present: boolean
  enabled: boolean
  userSelectable: boolean
  enabledProperty: string
  parameterName: string
  parameterDescription: string
  model: string
  vectorProfile: string
  params: Record<string, any>
  paramsText: string
  paramsInvalid: boolean
}

// A user-selectable capability still needs its model metadata when its default value is off.
export function isTargetInferenceOperationActive(
  operation: Pick<TargetInferenceOperationDraft, 'enabled' | 'userSelectable'>
) {
  return operation.enabled || operation.userSelectable
}

export interface TargetInferencePartDraft {
  id: string
  created: boolean
  label: string
  detector: TargetInferenceOperationDraft
  vector: TargetInferenceOperationDraft
  features: TargetInferenceOperationDraft
}

export interface TargetInferenceGroupDraft {
  id: string
  created: boolean
  label: string
  vector: TargetInferenceOperationDraft
  features: TargetInferenceOperationDraft
  parts: TargetInferencePartDraft[]
}

export interface TargetInferenceOperationErrors {
  parameterName?: string
  model?: string
  vectorProfile?: string
  params?: string
}

export interface TargetInferencePartErrors {
  label?: string
  capability?: string
  detector?: TargetInferenceOperationErrors
  vector?: TargetInferenceOperationErrors
  features?: TargetInferenceOperationErrors
}

export interface TargetInferenceGroupErrors {
  label?: string
  capability?: string
  vector?: TargetInferenceOperationErrors
  features?: TargetInferenceOperationErrors
  parts?: Record<string, TargetInferencePartErrors>
}

export type TargetInferenceValidationErrors = Record<string, TargetInferenceGroupErrors>

export interface TargetInferenceParameterDefinition {
  property: string
  name: string
  description: string
  type: { type: 'int' }
}

export interface TargetInferenceEditorValue {
  targetInference: TargetInferenceValue
  parameterDefinitions: TargetInferenceParameterDefinition[]
}

const TARGET_INFERENCE_PREFIX = 'targetInference.'
const TARGET_INFERENCE_SCENES = ['setupTranscode', 'processImage', 'processVideo'] as const

let draftSequence = 0

function getSceneTargetInference(
  definition: Record<string, any>,
  scene: (typeof TARGET_INFERENCE_SCENES)[number]
) {
  const sceneDefinition = asRecord(definition[scene]) || {}
  const targetInference = cloneDeep(asRecord(sceneDefinition.targetInference) || {})

  // Model definitions may still contain flattened targetInference paths. Read them into
  // the same tree as the structured value so the editor can preserve both released shapes.
  Object.entries(sceneDefinition)
    .filter(([key]) => key.startsWith(TARGET_INFERENCE_PREFIX))
    .forEach(([key, value]) => {
      writePath(targetInference, key.slice(TARGET_INFERENCE_PREFIX.length), cloneDeep(value))
    })

  return targetInference
}

export function getTargetInference(definition: Record<string, any>): TargetInferenceValue {
  for (const scene of TARGET_INFERENCE_SCENES) {
    const targetInference = getSceneTargetInference(definition, scene)
    if (Object.keys(targetInference).length) return targetInference
  }
  return {}
}

export function setTargetInference(
  definition: Record<string, any>,
  targetInference: TargetInferenceValue,
  parameterDefinitions: TargetInferenceParameterDefinition[] = []
) {
  const next = cloneDeep(definition)
  const hasTargetInference = Object.keys(targetInference).length > 0

  TARGET_INFERENCE_SCENES.forEach(scene => {
    const currentScene = asRecord(next[scene])
    const sceneDefinition = cloneDeep(currentScene || {})

    Object.keys(sceneDefinition)
      .filter(key => key === 'targetInference' || key.startsWith(TARGET_INFERENCE_PREFIX))
      .forEach(key => delete sceneDefinition[key])

    if (hasTargetInference) {
      sceneDefinition.targetInference = cloneDeep(targetInference)
    }
    if (currentScene || hasTargetInference) {
      next[scene] = sceneDefinition
    }
  })

  setTargetInferenceParameterDefinitions(next, parameterDefinitions)

  return next
}

function findTargetInferenceParameterDefinition(
  definition: Record<string, any>,
  source: 'params' | 'testParams',
  property: string
) {
  return getRawParameterProperties(definition[source])
    .find(item => getParameterPropertyKey(item) === property)
}

function getTargetInferenceParameterMetadata(
  definition: Record<string, any>,
  property: string
) {
  const paramsDefinition = findTargetInferenceParameterDefinition(definition, 'params', property)
  const testParamsDefinition = findTargetInferenceParameterDefinition(definition, 'testParams', property)
  const source = paramsDefinition || testParamsDefinition

  return {
    userSelectable: Boolean(paramsDefinition || testParamsDefinition),
    parameterName: source ? String(source.name ?? source.label ?? '') : '',
    parameterDescription: source?.description == null ? '' : String(source.description)
  }
}

function isTargetInferenceEnabledProperty(property: string) {
  return property.startsWith(TARGET_INFERENCE_PREFIX) && property.endsWith('.enabled')
}

function setTargetInferenceParameterDefinitions(
  definition: Record<string, any>,
  parameterDefinitions: TargetInferenceParameterDefinition[]
) {
  const uniqueDefinitions = new Map<string, TargetInferenceParameterDefinition>()
  parameterDefinitions.forEach(parameter => {
    if (parameter.property) uniqueDefinitions.set(parameter.property, cloneDeep(parameter))
  })
  const definitions = [...uniqueDefinitions.values()]

  for (const source of ['params', 'testParams'] as const) {
    const current = asRecord(definition[source])
    const nextSource = cloneDeep(current || {})
    const hasProperties = nextSource.properties !== undefined
    const retained = getRawParameterProperties(nextSource)
      .filter(parameter => !isTargetInferenceEnabledProperty(getParameterPropertyKey(parameter)))

    if (hasProperties || definitions.length) {
      nextSource.properties = [...retained, ...cloneDeep(definitions)]
    }
    if (current || definitions.length) definition[source] = nextSource
  }
}

function nextDraftId(prefix: string) {
  draftSequence += 1
  return `${prefix}:${draftSequence}`
}

function isEnabled(value: unknown) {
  return value === true || value === 1 || value === '1'
}

function stringifyParams(value: Record<string, any>) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '{}'
  }
}

export function createEmptyOperation(enabledProperty = ''): TargetInferenceOperationDraft {
  return {
    present: false,
    enabled: false,
    userSelectable: false,
    enabledProperty,
    parameterName: '',
    parameterDescription: '',
    model: '',
    vectorProfile: '',
    params: {},
    paramsText: '{}',
    paramsInvalid: false
  }
}

function createOperation(
  value: unknown,
  enabledProperty: string,
  definition: Record<string, any>
): TargetInferenceOperationDraft {
  const source = asRecord(value)
  const sourceParams = asRecord(source?.params) || {}
  const params = cloneDeep(sourceParams)
  const model = params.model_file
  delete params.model_file
  delete params.model
  const metadata = getTargetInferenceParameterMetadata(definition, enabledProperty)

  return {
    present: !!source || metadata.userSelectable,
    enabled: isEnabled(source?.enabled),
    ...metadata,
    enabledProperty,
    model: model == null ? '' : String(model),
    vectorProfile: source?.vectorProfile == null ? '' : String(source.vectorProfile),
    params,
    paramsText: stringifyParams(params),
    paramsInvalid: false
  }
}

export function createTargetInferenceDraft(
  value: TargetInferenceValue,
  definition: Record<string, any> = {}
): TargetInferenceGroupDraft[] {
  return Object.entries(value).map(([label, rawGroup]) => {
    const group = asRecord(rawGroup) || {}
    const parts = asRecord(group.parts) || {}
    const targetPath = `targetInference.${label}`
    return {
      id: nextDraftId('target'),
      created: false,
      label,
      vector: createOperation(group.vector, `${targetPath}.vector.enabled`, definition),
      features: createOperation(group.features, `${targetPath}.features.enabled`, definition),
      parts: Object.entries(parts).map(([partLabel, rawPart]) => {
        const part = asRecord(rawPart) || {}
        const partPath = `${targetPath}.parts.${partLabel}`
        return {
          id: nextDraftId('part'),
          created: false,
          label: partLabel,
          detector: createOperation(part, `${partPath}.enabled`, definition),
          vector: createOperation(part.vector, `${partPath}.vector.enabled`, definition),
          features: createOperation(part.features, `${partPath}.features.enabled`, definition)
        }
      })
    }
  })
}

function hasOperationContent(operation: TargetInferenceOperationDraft) {
  return operation.present
    || operation.enabled
    || operation.userSelectable
    || !!operation.model.trim()
    || !!operation.vectorProfile.trim()
    || Object.keys(operation.params).length > 0
}

function serializeOperation(
  operation: TargetInferenceOperationDraft,
  kind: TargetInferenceOperationKind
) {
  const params = cloneDeep(operation.params)
  delete params.model
  if (operation.model.trim()) params.model_file = operation.model.trim()
  else delete params.model_file

  const value: Record<string, any> = {
    enabled: operation.enabled ? 1 : 0,
    params
  }
  if (kind === 'vector' && operation.vectorProfile.trim()) {
    value.vectorProfile = operation.vectorProfile.trim()
  }
  return value
}

export function serializeTargetInference(
  groups: TargetInferenceGroupDraft[]
): TargetInferenceValue {
  const targetInference: TargetInferenceValue = {}

  groups.forEach(group => {
    const label = group.label.trim()
    if (!label) return

    const target: TargetInferenceValue = {}
    if (hasOperationContent(group.vector)) {
      target.vector = serializeOperation(group.vector, 'vector')
    }
    if (hasOperationContent(group.features)) {
      target.features = serializeOperation(group.features, 'features')
    }

    if (group.parts.length) {
      const parts: TargetInferenceValue = {}
      group.parts.forEach(part => {
        const partLabel = part.label.trim()
        if (!partLabel) return
        const partValue = serializeOperation(part.detector, 'parts')
        if (hasOperationContent(part.vector)) {
          partValue.vector = serializeOperation(part.vector, 'vector')
        }
        if (hasOperationContent(part.features)) {
          partValue.features = serializeOperation(part.features, 'features')
        }
        parts[partLabel] = partValue
      })
      if (Object.keys(parts).length) target.parts = parts
    }

    targetInference[label] = target
  })

  return targetInference
}

export function serializeTargetInferenceParameterDefinitions(
  groups: TargetInferenceGroupDraft[]
): TargetInferenceParameterDefinition[] {
  const definitions = new Map<string, TargetInferenceParameterDefinition>()

  function addDefinition(
    operation: TargetInferenceOperationDraft,
    property: string,
    label: string
  ) {
    if (!label || !operation.userSelectable) return
    definitions.set(`${property}.enabled`, {
      property: `${property}.enabled`,
      name: operation.parameterName.trim(),
      description: operation.parameterDescription.trim(),
      type: { type: 'int' }
    })
  }

  groups.forEach(group => {
    const targetLabel = group.label.trim()
    if (!targetLabel) return
    const targetPath = `targetInference.${targetLabel}`
    addDefinition(group.vector, `${targetPath}.vector`, targetLabel)
    addDefinition(group.features, `${targetPath}.features`, targetLabel)

    group.parts.forEach(part => {
      const partLabel = part.label.trim()
      if (!partLabel) return
      const partPath = `${targetPath}.parts.${partLabel}`
      addDefinition(part.detector, partPath, partLabel)
      addDefinition(part.vector, `${partPath}.vector`, partLabel)
      addDefinition(part.features, `${partPath}.features`, partLabel)
    })
  })

  return [...definitions.values()]
}

export function serializeTargetInferenceEditorValue(
  groups: TargetInferenceGroupDraft[]
): TargetInferenceEditorValue {
  return {
    targetInference: serializeTargetInference(groups),
    parameterDefinitions: serializeTargetInferenceParameterDefinitions(groups)
  }
}

export function createEmptyTargetGroup(): TargetInferenceGroupDraft {
  return {
    id: nextDraftId('target'),
    created: true,
    label: '',
    vector: createEmptyOperation(),
    features: createEmptyOperation(),
    parts: []
  }
}

export function createEmptyTargetPart(): TargetInferencePartDraft {
  return {
    id: nextDraftId('part'),
    created: true,
    label: '',
    detector: { ...createEmptyOperation(), present: true },
    vector: createEmptyOperation(),
    features: createEmptyOperation()
  }
}
