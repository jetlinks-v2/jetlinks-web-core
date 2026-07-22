import type { Component } from 'vue'
import type { Observable } from 'rxjs'

export type CapabilityKind =
  | 'data-source'
  | 'operation'
  | 'context-value'
  | 'value-editor'
  | 'option-source'

export type DataSourceMode = 'snapshot' | 'page' | 'poll' | 'stream'
export type OperationAction = 'create' | 'update' | 'delete' | 'invoke' | 'control' | 'trigger'
export type CapabilityAccessPhase = 'discover' | 'configure' | 'execute'
export type DataPath = Array<string | number>

export interface CapabilityOwner {
  moduleId: string
  providerId: string
}

export interface CapabilityAvailability {
  discoverable: boolean
  configurable: boolean
  executable: boolean
  reason?: string
  retryable?: boolean
}

export interface CapabilityContext {
  parameters?: Record<string, unknown>
  attributes?: Record<string, unknown>
}

export interface RuntimeCreateContext extends CapabilityContext {
  runtimeId: string
}

export type CapabilityAvailabilityResolver = (
  context: CapabilityContext,
  phase?: CapabilityAccessPhase,
) => CapabilityAvailability | Promise<CapabilityAvailability>

export interface CapabilityDefinitionBase {
  id: string
  kind: CapabilityKind
  version: number
  name: string
  description?: string
  owner: CapabilityOwner
  tags?: string[]
  facets?: Record<string, unknown>
  order?: number
  availability?: CapabilityAvailabilityResolver
}

export interface CapabilityQuery {
  kinds?: CapabilityKind[]
  ids?: string[]
  ownerModuleId?: string
  providerId?: string
  category?: string
  tags?: string[]
  keyword?: string
  facets?: Record<string, unknown>
  includeUnavailable?: boolean
  sourceModes?: DataSourceMode[]
  operationActions?: OperationAction[]
}

export interface ResolvedCapability<T> {
  definition: T
  availability: CapabilityAvailability
}

export interface ResolvedCapabilityCatalog {
  sources: Array<ResolvedCapability<DataSourceDefinition>>
  operations: Array<ResolvedCapability<OperationDefinition>>
  contexts: Array<ResolvedCapability<ContextValueDefinition>>
  valueEditors: Array<ResolvedCapability<ValueEditorDefinition>>
  optionSources: Array<ResolvedCapability<OptionSourceDefinition>>
}

export interface CapabilitySchema {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null'
  title?: string
  description?: string
  required?: string[]
  properties?: Record<string, CapabilitySchema>
  items?: CapabilitySchema
  enum?: unknown[]
  const?: unknown
  default?: unknown
  format?: string
  sensitive?: boolean
  readOnly?: boolean
  bindable?: boolean
  binding?: FieldBindingPolicy
  optionSource?: OptionSourceRef
}

export interface FieldBindingPolicy {
  allowedKinds?: ValueBinding['kind'][]
  required?: boolean
  sensitive?: boolean
}

export interface CapabilityUiSchema {
  widget?: string
  placeholder?: string
  help?: string
  order?: string[]
  hidden?: boolean
  disabled?: boolean
  props?: Record<string, unknown>
}

export interface LazyComponentDefinition {
  loader: () => Promise<{ default: Component } | Component>
  props?: Record<string, unknown>
}

export interface CapabilityFormDefinition {
  schema: CapabilitySchema
  uiSchema?: CapabilityUiSchema
  editor?: LazyComponentDefinition
}

export interface DataSourceUiDefinition {
  config?: CapabilityFormDefinition
  query?: CapabilityFormDefinition
  preview?: LazyComponentDefinition
}

export interface OperationUiDefinition {
  config?: CapabilityFormDefinition
  input?: CapabilityFormDefinition
  confirmation?: LazyComponentDefinition
}

export interface RuntimeContext extends RuntimeCreateContext {
  contexts?: Record<string, unknown>
  signal?: AbortSignal
}

export interface DataSourceCreateContext extends CapabilityContext {
  runtime?: RuntimeContext
  /** @deprecated read cancellation from runtime.signal; kept for legacy providers. */
  signal?: AbortSignal
}

export interface DataSourceRequest {
  config?: unknown
  query?: Record<string, unknown>
  signal?: AbortSignal
  limit?: number
  timeout?: number
}

export interface DataSourceResult<T = unknown> {
  data: T
  total?: number
  pageIndex?: number
  pageSize?: number
  outputSchema?: CapabilitySchema
  diagnostics?: Record<string, unknown>
}

export interface DataSource {
  query<T = unknown>(request: DataSourceRequest, context: RuntimeContext): Observable<DataSourceResult<T>>
  dispose?(): void | Promise<void>
}

export interface DataSourceDefinition extends CapabilityDefinitionBase {
  kind: 'data-source'
  configSchema?: CapabilitySchema
  querySchema?: CapabilitySchema
  outputSchema?: CapabilitySchema
  modes: DataSourceMode[]
  ui?: DataSourceUiDefinition
  defaults?: DataSourceRuntimeDefaults
  optimizer?: DataSourceOptimizer
  create(config: unknown, context: DataSourceCreateContext): Promise<DataSource> | DataSource
}

export interface DataSourceRuntimeDefaults {
  timeout?: number
  pollInterval?: number
  limit?: number
}

export interface ResolvedDataSourceRequest extends DataSourceRequest {
  capabilityId: string
  version: number
}

export interface MergedDataSourceRequest extends DataSourceRequest {
  requests: ResolvedDataSourceRequest[]
}

export interface DataSourceOptimizer {
  normalize?(request: ResolvedDataSourceRequest, context: RuntimeContext): ResolvedDataSourceRequest
  getGroupKey?(request: ResolvedDataSourceRequest, context: RuntimeContext): string | undefined
  canMerge?(requests: ResolvedDataSourceRequest[], context: RuntimeContext): boolean
  merge?(requests: ResolvedDataSourceRequest[], context: RuntimeContext): MergedDataSourceRequest
  split?(
    result: DataSourceResult,
    requests: ResolvedDataSourceRequest[],
    context: RuntimeContext,
  ): ReadonlyMap<string, DataSourceResult>
}

export interface OperationPolicy {
  risk: 'low' | 'medium' | 'high' | 'critical'
  confirmation: 'none' | 'always' | 'destructive' | 'provider'
  idempotency: 'none' | 'natural' | 'keyed'
  cancellation: 'unsupported' | 'before-dispatch' | 'best-effort' | 'compensatable'
  retry: 'never' | 'idempotent-only' | 'provider'
  concurrency: 'parallel' | 'serial' | 'drop-while-running' | 'queue'
  batch?: boolean
  audit?: boolean
}

export interface OperationPolicyOverride {
  risk?: OperationPolicy['risk']
  confirmation?: OperationPolicy['confirmation']
  cancellation?: OperationPolicy['cancellation']
  retry?: OperationPolicy['retry']
  batch?: boolean
  audit?: boolean
}

export interface OperationDefinition extends CapabilityDefinitionBase {
  kind: 'operation'
  action: OperationAction
  configSchema?: CapabilitySchema
  inputSchema?: CapabilitySchema
  outputSchema?: CapabilitySchema
  policy: OperationPolicy
  ui?: OperationUiDefinition
  create(config: unknown, context: OperationCreateContext): Promise<Operation> | Operation
}

export interface OperationCreateContext extends CapabilityContext {
  runtime?: RuntimeContext
  /** @deprecated read cancellation from runtime.signal; kept for legacy providers. */
  signal?: AbortSignal
}

export interface OperationContext extends RuntimeContext {
  runtime?: RuntimeContext
}

export interface OperationRequest {
  config?: unknown
  input?: Record<string, unknown>
  signal?: AbortSignal
}

export interface PreparedOperation {
  id: string
  capabilityId: string
  request: OperationRequest
  policy: OperationPolicy
  summary?: string
  impacts?: unknown[]
  diagnostics?: Record<string, unknown>
}

export interface OperationConfirmationProof {
  confirmedAt?: number
  actor?: string
  method?: 'ui' | 'policy' | 'provider' | 'external'
  token?: string
  reason?: string
  metadata?: Record<string, unknown>
}

export interface ConfirmedOperation {
  id: string
  preparedId: string
  capabilityId: string
  proof: OperationConfirmationProof
}

export type OperationEvent =
  | { type: 'prepared'; prepared: PreparedOperation }
  | { type: 'progress'; progress: number; message?: string }
  | { type: 'result'; result: unknown }
  | { type: 'warning'; error: CapabilityError }
  | { type: 'cancelled'; phase: 'before-dispatch' }
  | { type: 'completed' }

export interface OperationExecution {
  id: string
  events$: Observable<OperationEvent>
  /** Present only while Runtime can honor cancellation without dispatching the side effect. */
  cancel?(): void
}

export interface Operation {
  prepare?(request: OperationRequest, context: OperationContext): Promise<PreparedOperation>
  execute(prepared: PreparedOperation, context: OperationContext): Observable<OperationEvent>
  dispose?(): void | Promise<void>
}

export type SimpleValueBinding<T = unknown> =
  | LiteralBinding<T>
  | ParameterBinding
  | ContextBinding
  | OutputBinding

export type ValueBinding<T = unknown> = SimpleValueBinding<T> | ExpressionBinding

export interface LiteralBinding<T = unknown> {
  kind: 'literal'
  value: T
}

export interface ParameterBinding {
  kind: 'parameter'
  parameterId: string
  path?: DataPath
}

export interface ContextBinding {
  kind: 'context'
  providerId: string
  instanceId?: string
  outputId: string
  path?: DataPath
}

export interface OutputBinding {
  kind: 'output'
  nodeId: string
  port?: string
  path?: DataPath
}

/** Identifies either a node's default output or one named output port. */
export interface RuntimeOutputRef {
  nodeId: string
  port?: string
}

/**
 * Runtime-only output snapshot used while resolving ValueBinding.
 * Property presence is significant: an own property with value undefined is still a registered output.
 */
export interface RuntimeOutputSnapshot {
  readonly default?: unknown
  readonly ports?: Readonly<Record<string, unknown>>
}

export interface ExpressionBinding {
  kind: 'expression'
  language: 'cel'
  expression: string
  inputs: Record<string, SimpleValueBinding>
}

export interface ContextValueDefinition extends CapabilityDefinitionBase {
  kind: 'context-value'
  outputSchema: CapabilitySchema
  resolve(reference: ContextBinding, context: BindingRuntimeContext): unknown | Promise<unknown> | Observable<unknown>
}

export interface BindingRuntimeContext extends RuntimeContext {
  outputs?: Readonly<Record<string, RuntimeOutputSnapshot>>
  contexts?: Record<string, unknown>
}

export interface ValueEditorDefinition extends CapabilityDefinitionBase {
  kind: 'value-editor'
  schema?: CapabilitySchema
  editor: LazyComponentDefinition
}

export interface OptionSourceDefinition extends CapabilityDefinitionBase {
  kind: 'option-source'
  querySchema?: CapabilitySchema
  /** Validates each normalized CapabilityOption returned by this Provider. */
  optionSchema?: CapabilitySchema
  /**
   * Resolves configuration options without side effects.
   * Implementations should observe request.signal or context.signal and return serializable option data.
   */
  query(request: OptionSourceRequest, context: RuntimeContext): OptionSourceResult | Promise<OptionSourceResult>
}

export interface OptionSourceRequest {
  query?: Record<string, unknown>
  keyword?: string
  pageIndex?: number
  pageSize?: number
  signal?: AbortSignal
}

/** Per-call search, pagination and cancellation values supplied by a configuration UI. */
export interface RuntimeOptionRequest {
  keyword?: string
  pageIndex?: number
  pageSize?: number
  signal?: AbortSignal
}

export interface OptionSourceResult {
  options: CapabilityOption[]
  total?: number
  diagnostics?: Record<string, unknown>
}

/** Minimal stable reference used when a capability has no persisted configuration. */
export interface VersionedCapabilityRef {
  capabilityId: string
  version: number
}

export type OptionSourceRef =
  | {
      type: 'static'
      options: CapabilityOption[]
    }
  | {
      type: 'data-source'
      capability: PersistedCapabilityRef
      query?: Record<string, ValueBinding | unknown>
      labelPath?: DataPath
      valuePath?: DataPath
      childrenPath?: DataPath
      keywordParam?: string
      pagination?: boolean
    }
  | {
      type: 'provider'
      capability: VersionedCapabilityRef
      query?: Record<string, ValueBinding | unknown>
      keywordParam?: string
      pagination?: boolean
    }

export interface CapabilityOption {
  label: string
  value: unknown
  disabled?: boolean
  children?: CapabilityOption[]
  metadata?: Record<string, unknown>
}

export interface OutputMapping {
  version: number
  fields: Record<string, OutputMappingValue>
  format?: Record<string, OutputFormatRule>
}

export type OutputMappingValue = DataPathMapping | ValueBinding | NestedOutputMapping

export interface DataPathMapping {
  kind: 'path'
  path: DataPath
  defaultValue?: unknown
}

export interface NestedOutputMapping {
  kind: 'object'
  fields: Record<string, OutputMappingValue>
}

export interface OutputFormatRule {
  type: 'raw' | 'string' | 'number' | 'date' | 'boolean' | 'array' | 'object'
  format?: string
  timezone?: string
  fallback?: unknown
}

export interface DataSourcePlan {
  version: number
  nodes: DataSourcePlanNode[]
  output?: DataSourcePlanOutput
}

export interface DataSourcePlanNode {
  id: string
  source: PersistedCapabilityRef
  operator?: DataSourceOperator
}

export interface DataSourcePlanOutput {
  nodeId: string
  mapping?: OutputMapping
}

export type DataSourceOperator =
  | { type: 'merge'; inputs: string[] }
  | { type: 'combineLatest'; inputs: string[] }
  | { type: 'switchLatest'; input: string }
  | { type: 'forkJoin'; inputs: string[] }
  | { type: 'bootstrapThenStream'; bootstrap: string; stream: string }
  | { type: 'poll'; interval: number }
  | { type: 'retry'; count: number; delay?: number }
  | { type: 'timeout'; timeout: number }

export interface PersistedCapabilityRef {
  capabilityId: string
  version: number
  config?: unknown
}

export interface PersistedDataBinding {
  version: number
  source: PersistedCapabilityRef
  query?: Record<string, ValueBinding | unknown>
  mapping?: OutputMapping
  plan?: DataSourcePlan
}

export interface PersistedOperationBinding {
  version: number
  operation: PersistedCapabilityRef
  input?: Record<string, ValueBinding | unknown>
  policyOverride?: OperationPolicyOverride
}

export interface RuntimeQueryOptions {
  timeout?: number
  limit?: number
  signal?: AbortSignal
}

export interface DataConnectionRequest {
  id?: string
  consumerId: string
  binding: PersistedDataBinding
  options?: RuntimeQueryOptions
}

export type DataConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'completed'
  | 'unavailable'
  | 'failed'

export type DataConnectionEvent<T = unknown> =
  | { type: 'status'; status: DataConnectionStatus; error?: CapabilityError }
  | { type: 'data'; result: DataSourceResult<T> }
  | { type: 'warning'; error: CapabilityError }
  | { type: 'diagnostic'; value: Record<string, unknown> }

export interface DataConnection<T = unknown> {
  id: string
  events$: Observable<DataConnectionEvent<T>>
  unsubscribe(): void
}

export interface CapabilityPreviewRequest {
  binding: PersistedDataBinding
  sampleContext?: Record<string, unknown>
  timeout?: number
  limit?: number
}

export interface CapabilityPreviewResult<T = unknown> {
  data?: T
  outputSchema?: CapabilitySchema
  warnings?: CapabilityError[]
  diagnostics?: Record<string, unknown>
}

export interface CapabilityError {
  code: string
  message: string
  capabilityId?: string
  retryable?: boolean
  cause?: unknown
  details?: Record<string, unknown>
}

export interface DataCapabilityProviderLoadedResult {
  sources?: DataSourceDefinition[]
  operations?: OperationDefinition[]
  contexts?: ContextValueDefinition[]
  valueEditors?: ValueEditorDefinition[]
  optionSources?: OptionSourceDefinition[]
}

export interface DataCapabilityProvider {
  id: string
  owner: CapabilityOwner
  order?: number
  load?(): Promise<DataCapabilityProviderLoadedResult> | DataCapabilityProviderLoadedResult
  dispose?(): void | Promise<void>
}

export type DataCapabilityProviderLoader = () =>
  | Promise<DataCapabilityProvider | { default: DataCapabilityProvider }>
  | DataCapabilityProvider
  | { default: DataCapabilityProvider }

export interface CapabilityRegistry<T extends CapabilityDefinitionBase> {
  register(definition: T, options?: CapabilityRegisterOptions): () => void
  get(id: string): T | undefined
  list(): T[]
  clear(scope?: string): void
}

export interface CapabilityRegisterOptions {
  scope?: string
  override?: boolean
}

export interface DataCapabilityRuntime {
  connect<T = unknown>(request: DataConnectionRequest): DataConnection<T>
  query<T = unknown>(binding: PersistedDataBinding, options?: RuntimeQueryOptions): Promise<DataSourceResult<T>>
  preview<T = unknown>(request: CapabilityPreviewRequest): Promise<CapabilityPreviewResult<T>>
  /** Resolves static or dynamic configuration options through Runtime lifecycle guards. */
  resolveOptions(ref: OptionSourceRef, request?: RuntimeOptionRequest): Promise<OptionSourceResult>
  prepareOperation(binding: PersistedOperationBinding): Promise<PreparedOperation>
  confirmOperation(preparedId: string, proof: OperationConfirmationProof): ConfirmedOperation
  executeOperation(operation: ConfirmedOperation | PreparedOperation): OperationExecution
  updateParameters(values: Record<string, unknown>): void
  updateContext(providerId: string, instanceId: string, value: unknown): void
  /** Registers the latest default or named-port output for subsequent binding resolution. */
  updateOutput(ref: RuntimeOutputRef, value: unknown): void
  /** Removes one default or named-port output without reconnecting existing data connections. */
  removeOutput(ref: RuntimeOutputRef): void
  dispose(): Promise<void>
}

export interface DataCapabilityRegistry {
  readonly sources: CapabilityRegistry<DataSourceDefinition>
  readonly operations: CapabilityRegistry<OperationDefinition>
  readonly contexts: CapabilityRegistry<ContextValueDefinition>
  readonly valueEditors: CapabilityRegistry<ValueEditorDefinition>
  readonly optionSources: CapabilityRegistry<OptionSourceDefinition>
  registerProvider(provider: DataCapabilityProvider, options?: CapabilityRegisterOptions): () => void
  loadModuleProviders(context?: CapabilityContext): Promise<void>
  resolveCatalog(context: CapabilityContext, query?: CapabilityQuery): Promise<ResolvedCapabilityCatalog>
  onChange(listener: () => void): () => void
  createRuntime(context: RuntimeCreateContext): DataCapabilityRuntime
}
