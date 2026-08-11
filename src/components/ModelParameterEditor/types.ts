export type ModelParameterScene = 'setupTranscode' | 'processImage'

export type ModelParameterSceneMode = 'user' | 'default'

export type ModelParameterDefinitionSource = 'params' | 'testParams'

export type ModelParameterInputType = 'number' | 'boolean' | 'select' | 'json' | 'text'

export type ModelParameterPropertyField = 'name' | 'property' | 'description' | 'type'

export interface ModelParameterOption {
  label: string
  value: any
}

export interface ModelParameterProperty {
  property: string
  name: string
  typeName: string
  description?: string
  valueType: Record<string, unknown>
  inputType: ModelParameterInputType
  options?: ModelParameterOption[]
  paramsDefinition?: Record<string, unknown>
  testParamsDefinition?: Record<string, unknown>
}

export interface ModelParameterFile {
  id?: string
  name: string
  path?: string
  format?: string[]
}

export interface ModelParameterLocale {
  parameterConfig: string
  parameterConfigDescription: string
  addParameter: string
  realtime: string
  imageTest: string
  userParameters: string
  defaultParameters: string
  others: string
  othersDescription: string
  realtimeUserDescription: string
  realtimeDefaultDescription: string
  imageUserDescription: string
  imageDefaultDescription: string
  parameterName: string
  parameterPath: string
  parameterType: string
  parameterDescription: string
  parameterValue: string
  actions: string
  deleteParameter: string
  noParameters: string
  noSceneParameters: string
  pleaseEnter: string
  pleaseSelect: string
  invalidJson: string
  targetInference: string
  targetInferenceDescription: string
  addTargetLabel: string
  targetLabel: string
  addPartLabel: string
  partLabel: string
  vector: string
  features: string
  parts: string
  targetDetection: string
  model: string
  vectorProfile: string
  additionalParams: string
  defaultEnabled: string
  userSelectable: string
  targetParameterName: string
  targetParameterDescription: string
  configure: string
  deleteTargetLabel: string
  deletePartLabel: string
  noTargetInference: string
  targetLabelRequired: string
  targetLabelDuplicate: string
  partLabelRequired: string
  partLabelDuplicate: string
  capabilityRequired: string
  modelRequired: string
  vectorProfileRequired: string
  targetParameterNameRequired: string
}
