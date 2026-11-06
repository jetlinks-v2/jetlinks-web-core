import type { Component, Ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

/** 与通用指标 JSON 契约一致；业务宿主仅提供对象及来源选择。 */
export interface MetricInputMapping {
  kind: 'property' | 'metric' | 'builtin'
  thingType?: string
  thingId?: string
  ruleId?: string
  configId?: string
  sourceDataVersion?: string
  includeChildren?: boolean
  statistics?: MetricScopeStatistics
  id: string
}
/** 范围内成员公开结果的最新快照统计，来源配置沿用 configId/id。 */
export interface MetricScopeStatistics {
  memberType: string
  sourceType: string
  sourceId: string
  operation: 'count' | 'sum'
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  value?: string | number | boolean
  maxAge: string
  period: 'current' | 'day' | 'week' | 'month'
  zone: string
  periodMetricId?: string
  coverageMetricId?: string
}
export interface MetricTemplateInput {
  id: string
  name?: string
  metricId?: string
  unit?: string
  presence?: 'required' | 'optional' | 'defaultValue'
  maxAge?: string
  minSamples?: number
  maxGap?: string
  defaultValue?: unknown
  source?: { kind?: 'property' | 'metric' | 'builtin'; lookback?: string; maxPoints?: number; [key: string]: unknown }
  valueType?: Record<string, unknown>
  [key: string]: unknown
}
export interface MetricParameter {
  id: string
  name?: string
  description?: string
  valueType?: { type: string; [key: string]: unknown }
  expands?: { editable?: boolean; [key: string]: unknown }
  [key: string]: unknown
}
/** 与后端计算器唯一声明一致；类型使用平台 canonical metadata。 */
export interface MetricCalculatorSpec {
  provider?: string
  providerVersion?: string
  inputTypes?: Record<string, Record<string, unknown>>
  outputType?: Record<string, unknown>
  parameters?: Record<string, unknown>
  [key: string]: unknown
}
export interface MetricCalculatorDescriptor {
  id: string
  name: string
  description?: string
  configuration: MetricCalculatorSpec
  inputNames: Record<string, string>
  parameterDefinitions: MetricParameter[]
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
  options?: Record<string, unknown> & { readAggregation?: import('./collection/types').MetricReadAggregation }
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
  options?: Record<string, unknown> & { category?: string; presentation?: MetricTemplatePresentation | null }
  enabled?: boolean
}
export interface MetricTemplateEntity {
  id: string
  name: string
  released: boolean
  available: boolean
  template: MetricTemplate
  draft?: MetricTemplate | null
  revision?: number
  editRevision?: number
}
export interface MetricTemplateRevision { revision: number; publishedAt: number }
/** 字典值用于保存，label 为平台字典按当前语言返回的 text。 */
export interface MetricTemplateCategory { value:string; label:string }
export interface MetricConfig {
  id?: string
  name?: string
  ownerType: string
  ownerId: string
  slot: string
  targetType: string
  targetId: string
  scope?: 'single' | 'children'
  templateId: string
  templateVersion: string
  templateRevision?: number | null
  inputMappings: Record<string, MetricInputMapping>
  parameters: Record<string, unknown>
  presentation?: Record<string, unknown> | null
  state: 'enabled' | 'disabled'
  revision: number
  enabledAt?: number
  dataVersion?: string
}
export interface MetricStateInterval {
  id: string
  value: string | number | boolean
  startTime: number
  endTime?: number | null
  startKnown: boolean
  endKnown: boolean
  observedUntil: number
  validUntil: number
}
export interface MetricTemporalResult {
  phase: 'normal' | 'pending' | 'active' | 'recovering' | 'unknown'
  phaseSince: number
  transition?: { id: string; from: string; to: string; time: number }
}
export interface MetricStateResult {
  currentInterval?: MetricStateInterval | null
  previousInterval?: MetricStateInterval | null
  closedInterval?: MetricStateInterval | null
  duration?: number | null
  /** Latest-read view; the evaluation facts above remain unchanged. */
  readView?: { time: number; duration: number | null }
}
export interface MetricStateLabel {
  value: string | number | boolean
  name: string
  nameI18n?: Record<string, string>
  /** Platform IconValue string: color, font icon or image. Presentation only. */
  icon?: string
}
export interface MetricValue {
  resultId?: string
  metricId: string
  thingType?: string
  thingId?: string
  tags?: Record<string, unknown>
  value?: unknown
  unit?: string
  status?: 'success' | 'partial' | 'fallback' | 'invalid'
  reason?: string
  quality?: {
    valid?: boolean | null; stale?: boolean | null; estimated?: boolean | null
    coverage?: number; completeness?: number; freshness?: number; attributes?: Record<string, unknown>
  }
  eventTime?: number
  ingestTime?: number
  processTime?: number
  evaluationTime?: number
  timestamp?: number
  inputTimeStart?: number
  inputTimeEnd?: number
  dataVersion?: string
  temporal?: MetricTemporalResult
  state?: MetricStateResult
  [key: string]: unknown
}
export interface MetricLatest {
  configId: string
  outputs: Record<string, MetricValue>
  runtime?: MetricRuntime
  inaccessible?: boolean
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
  /** Caller-supplied user/project/tenant identity for browser preferences. Omit to disable persistence. */
  preferenceScope?: string
  ownerType: string
  ownerId: string
  targetType?: string
  targetId?: string
  label?: string
  editable?: boolean
  scope?: 'single' | 'children'
  inheritance?: { targetType: string; label: string }
  readScopes?: import('./collection/types').MetricReadScopeOption[]
}
export interface MetricDataTarget { targetType: string; targetId: string }
export interface MetricSourceSelection {
  mapping: MetricInputMapping
  label?: string
}
export interface MetricSourceDescription {
  label?: string
  detail?: string
  unit?: string
  valueType?: Record<string, unknown>
  error?: string
}
export interface MetricSourceRequest {
  configId?: string
  context: MetricContext
  input: MetricTemplateInput
  mapping?: MetricInputMapping
  inline?: boolean
  /** 内置快照及成员统计只适用于直接下游均为定时计算的最新输入。 */
  scheduled?: boolean
}
/** 旧 picker 仍可独立使用；有内嵌编辑器的业务模块在同一属性面板完成来源选择。 */
export interface MetricSourcePicker {
  (request: MetricSourceRequest): Promise<MetricSourceSelection | undefined>
  editor?: Component
  cancel?: () => void
  describe?: (context: MetricContext, mappings: Record<string, MetricInputMapping>) => Promise<Record<string, MetricSourceDescription>>
}
export interface MetricReference { configId: string; outputId: string; targetType?: string; targetId?: string }
export interface MetricAlarmReference extends MetricReference { ownerType: string; ownerId: string }
export interface MetricHistoryRequest {
  outputs: string[]
  query: Record<string, unknown>
  intervalsOnly?: boolean
  targetType?: string
  targetId?: string
}
export interface MetricSimulationRequest {
  template: MetricTemplate
  configuration: MetricConfig
  samples: Record<string, unknown>[]
  includeIntermediate?: boolean
  includeRecords?: boolean
  endAt?: number
}
export type MetricConfigSimulationRequest = Omit<MetricSimulationRequest, 'template'>
/** 业务模块提供创建起点；复制后仍使用普通模板与真实试算契约。 */
export interface MetricTemplateStarter {
  id: string
  name: string
  description: string
  /** 起点的默认分类编码；显示名称和可选项来自平台字典。 */
  groupId?: string
  icon?: string
  template: MetricTemplate
  simulation?: Omit<MetricSimulationRequest, 'template' | 'includeIntermediate' | 'includeRecords'>
}
/** 后端 monitor.recorder 原生记录；值由 results 提供，resultIndex 只引用本次响应。 */
export interface MetricInputReadSummary {
  id: string
  metricId?: string
  kind?: 'property' | 'metric' | 'builtin'
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
  collectionOverview?(query: import('./collection/types').MetricScopeOverviewRequest): Promise<import('./collection/types').MetricScopeOverview>
  aggregate?(query: import('./collection/types').MetricAggregateQuery): Promise<import('./collection/types').MetricAggregateResult>
  collection?(query: import('./collection/types').MetricCollectionQuery): Promise<import('./collection/types').MetricCollectionResult>
  builtinSources(type: string, id: string): Promise<MetricBuiltinItem[]>
  templateCategories(): Promise<MetricTemplateCategory[]>
  calculators(): Promise<MetricCalculatorDescriptor[]>
  simulateConfig(request: MetricConfigSimulationRequest): Promise<MetricSimulationResponse>
  getConfig(id: string, target?: MetricDataTarget): Promise<MetricConfig>
  byOwner(type: string, id: string): Promise<MetricConfig[]>
  selectable(): Promise<MetricTemplateEntity[]>
  configTemplate(id: string, target?: MetricDataTarget): Promise<MetricTemplate>
  saveConfig(config: MetricConfig): Promise<MetricConfig>
  removeConfig(id: string): Promise<void>
  latest(ids: string[], target?: MetricDataTarget): Promise<MetricLatest[]>
  watchLatest?(ids: string[], target: MetricDataTarget | undefined, interval: number, onValue: (value: MetricLatest) => void, onError: (cause: unknown) => void): () => void
  subscribe?(target: MetricDataTarget, interval: number, onValue: (value: MetricValue) => void, onError: () => void): () => void
  history(id: string, request: MetricHistoryRequest): Promise<MetricValue[]>
  queryTemplates(query: Record<string, unknown>): Promise<{ data: MetricTemplateEntity[]; total: number }>
  saveTemplate(template: MetricTemplate, editRevision?: number): Promise<MetricTemplateEntity>
  releaseTemplate(id: string, editRevision?: number): Promise<MetricTemplateEntity | void>
  discardTemplateDraft(id: string, editRevision: number): Promise<MetricTemplateEntity>
  templateRevisions(id: string, before?: number): Promise<MetricTemplateRevision[]>
  templateReferences(id: string, cursor?: string): Promise<MetricConfig[]>
  applyTemplateRevision(id: string, revision: number, expectedRevision: number): Promise<MetricConfig>
  setAvailable(id: string, available: boolean): Promise<void>
  removeTemplate(id: string): Promise<void>
  simulate(request: MetricSimulationRequest): Promise<MetricSimulationResponse>
}

export interface MetricBuiltinItem {
  id: string
  name: string
  description: string
  unit?: string
  supportsChildren: boolean
  valueType?: string
  icon?: string
  configurationRequired?: boolean
}

export type MetricLabel = string | (() => string)
export interface MetricObjectSelection { ownerId: string; label: string; targetType?: string; targetId?: string }
/** navigator 的 select 事件可附带来源，自动授权确认不应关闭用户正在操作的面板。 */
export type MetricSelectionOrigin = 'user' | 'validation'
export interface MetricWorkspaceSelection { ownerType: string; ownerId: string }
export interface MetricNavigatorProps { selectedId?: string }
export interface MetricSourcePickerBinding { pickSource: MetricSourcePicker; host?: Component }

/** 范围必须由 navigator 的授权查询确认；来源弹窗在当前 scope 的 setup 创建和卸载。 */
export interface MetricDimensionProvider {
  ownerType: string
  label: MetricLabel
  icon?: string
  inheritance?: () => MetricContext['inheritance']
  readScopes?: () => NonNullable<MetricContext['readScopes']>
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
