import type { Component, Ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

/** 与通用指标 JSON 契约一致；业务宿主仅提供对象及来源选择。 */
export interface MetricInputMapping {
  kind: 'property' | 'metric'
  thingType?: string
  thingId?: string
  ruleId?: string
  id: string
}
export interface MetricTemplateInput {
  id: string
  name?: string
  metricId?: string
  unit?: string
  presence?: 'required' | 'optional' | 'defaultValue'
  source?: { kind?: 'property' | 'metric'; lookback?: string; maxPoints?: number; [key: string]: unknown }
  valueType?: Record<string, unknown>
  [key: string]: unknown
}
export interface MetricParameter {
  id: string
  name?: string
  valueType?: { type: string; [key: string]: unknown }
  expands?: { editable?: boolean; [key: string]: unknown }
  [key: string]: unknown
}
export interface MetricTemplateOutput {
  metricId: string
  property?: string
  label?: string
  labelI18nKey?: string
  unit?: string
  metricKind?: string
  persist?: boolean
  latestOnly?: boolean
  publish?: boolean
  valueType?: string
  [key: string]: unknown
}
export interface MetricTemplate {
  id: string
  version: string
  name: string
  thingType?: string
  source?: string
  inputDefinitions: MetricTemplateInput[]
  parameterDefinitions: MetricParameter[]
  parameters: Record<string, unknown>
  definitions: Record<string, unknown>[]
  outputs: MetricTemplateOutput[]
  options?: Record<string, unknown> & { presentation?: MetricTemplatePresentation | null }
  enabled?: boolean
}
export interface MetricTemplateEntity {
  id: string
  name: string
  released: boolean
  available: boolean
  template: MetricTemplate
}
export interface MetricConfig {
  id?: string
  name?: string
  ownerType: string
  ownerId: string
  slot: string
  targetType: string
  targetId: string
  templateId: string
  templateVersion: string
  inputMappings: Record<string, MetricInputMapping>
  parameters: Record<string, unknown>
  presentation?: Record<string, unknown> | null
  state: 'enabled' | 'disabled'
  revision: number
  enabledAt?: number
  dataVersion?: string
}
export interface MetricValue {
  resultId?: string
  metricId: string
  value?: unknown
  unit?: string
  status?: 'success' | 'partial' | 'fallback' | 'invalid'
  reason?: string
  quality?: {
    valid?: boolean | null; stale?: boolean | null; estimated?: boolean | null
    coverage?: number; completeness?: number; attributes?: Record<string, unknown>
  }
  eventTime?: number
  ingestTime?: number
  processTime?: number
  evaluationTime?: number
  timestamp?: number
  inputTimeStart?: number
  inputTimeEnd?: number
  dataVersion?: string
  [key: string]: unknown
}
export interface MetricLatest {
  configId: string
  outputs: Record<string, MetricValue>
  runtime?: MetricRuntime
}
/** 本节点当前配置的装载反馈，与输出质量和计算健康相互独立。 */
export interface MetricRuntime {
  nodeId: string
  state: 'pending' | 'loaded' | 'failed'
  lastSuccessTime?: number
  lastFailureTime?: number
  errorCode?: string
}
export interface MetricContext {
  ownerType: string
  ownerId: string
  targetType?: string
  targetId?: string
  label?: string
  editable?: boolean
  alarmEnabled?: boolean
}
export interface MetricSourceSelection {
  mapping: MetricInputMapping
  label?: string
}
export type MetricSourcePicker = (request: {
  context: MetricContext
  input: MetricTemplateInput
  mapping?: MetricInputMapping
}) => Promise<MetricSourceSelection | undefined>
export interface MetricReference { configId: string; outputId: string }
export interface MetricAlarmReference extends MetricReference { ownerType: string; ownerId: string }
export interface MetricHistoryRequest {
  outputs: string[]
  query: Record<string, unknown>
}
export interface MetricSimulationRequest {
  template: MetricTemplate
  configuration: MetricConfig
  samples: Record<string, unknown>[]
  includeIntermediate?: boolean
  includeRecords?: boolean
  endAt?: number
}
/** 后端 monitor.recorder 原生记录；值由 results 提供，resultIndex 只引用本次响应。 */
export interface MetricInputReadSummary {
  id: string
  metricId?: string
  kind?: 'property' | 'metric'
  thingType?: string
  thingId?: string
  ruleId?: string
  evaluationTime: number
  /** 本轮读取条数；窗口参与量以对应结果的 quality.attributes.actualCount 为准。 */
  count: number
  from?: number
  to?: number
  value?: unknown
}
export interface MetricRecordAttributes {
  definitionId?: string
  metricId?: string
  evaluationTime?: number
  state?: 'produced' | 'skipped' | 'noOutput'
  reason?: string
  expression?: string
  calculator?: string
  inputFailure?: string
  inputs?: MetricInputReadSummary[]
  inputsTruncated?: boolean
  resultIndex?: number
  [key: string]: unknown
}
export interface MetricActionRecord {
  id: string
  parentId?: string
  action: string
  attributes: MetricRecordAttributes
  tags?: Record<string, unknown>
  timestamp: number
  useNanos: number
  valueCount: number
  hasError: boolean
  cancel: boolean
  errorType?: string
  errorDetail?: string
  traceId?: string
  spanId?: string
}
export interface MetricSimulationResponse {
  status: 'success' | 'failed'
  results: MetricValue[]
  records: MetricActionRecord[]
  recordsTruncated: boolean
  error?: string
}
export interface MetricApi {
  getConfig(id: string): Promise<MetricConfig>
  byOwner(type: string, id: string): Promise<MetricConfig[]>
  selectable(): Promise<MetricTemplateEntity[]>
  configTemplate(id: string): Promise<MetricTemplate>
  saveConfig(config: MetricConfig): Promise<MetricConfig>
  removeConfig(id: string): Promise<void>
  latest(ids: string[]): Promise<MetricLatest[]>
  history(id: string, request: MetricHistoryRequest): Promise<MetricValue[]>
  queryTemplates(query: Record<string, unknown>): Promise<{ data: MetricTemplateEntity[]; total: number }>
  saveTemplate(template: MetricTemplate): Promise<MetricTemplateEntity>
  releaseTemplate(id: string): Promise<void>
  setAvailable(id: string, available: boolean): Promise<void>
  removeTemplate(id: string): Promise<void>
  simulate(request: MetricSimulationRequest): Promise<MetricSimulationResponse>
}

export type MetricLabel = string | (() => string)
export interface MetricObjectSelection { ownerId: string; label: string; targetType?: string; targetId?: string }
export interface MetricWorkspaceSelection { ownerType: string; ownerId: string }
export interface MetricNavigatorProps { selectedId?: string }
export interface MetricSourcePickerBinding { pickSource: MetricSourcePicker; host?: Component }

/** 范围必须由 navigator 的授权查询确认；来源弹窗在当前 scope 的 setup 创建和卸载。 */
export interface MetricDimensionProvider {
  ownerType: string
  label: MetricLabel
  order?: number
  available?: () => boolean
  navigator: Component<MetricNavigatorProps>
  useSourcePicker: (context: Ref<MetricContext>) => MetricSourcePickerBinding
  canEdit?: (selection: MetricObjectSelection) => boolean
  toBusiness?: (selection: MetricObjectSelection) => RouteLocationRaw | undefined
}
export interface MetricTemplatePresentation { provider?: string; settings?: Record<string, unknown> | null }
export interface MetricCardContentProps {
  context: MetricContext
  configuration: MetricConfig
  template: MetricTemplate
  output: MetricTemplateOutput
  value?: MetricValue
  settings: Readonly<Record<string, unknown>>
}
export interface MetricDetailContentProps extends MetricCardContentProps {
  values: MetricValue[]
  loading: boolean
  error: string
}
export type MetricConfigFieldsPatch = Partial<Pick<MetricConfig, 'inputMappings' | 'parameters'>>
export interface MetricConfigFieldsProps {
  context: MetricContext
  template: MetricTemplate
  draft: Readonly<MetricConfig>
  pickSource?: MetricSourcePicker
}
export interface MetricPresentationFieldsProps {
  modelValue: Readonly<Record<string, unknown>>
  defaults: Readonly<Record<string, unknown>>
  disabled?: boolean
}
/** 完整标识由 moduleId/注册短键派生；组件只消费既有结果或编辑受限字段，不持久化或查询。 */
export interface MetricPresentationProvider {
  label: MetricLabel
  card?: Component<MetricCardContentProps>
  detail?: Component<MetricDetailContentProps>
  configFields?: Component<MetricConfigFieldsProps>
  presentationFields?: Component<MetricPresentationFieldsProps>
}

