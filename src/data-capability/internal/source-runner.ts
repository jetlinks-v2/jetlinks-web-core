import { ReplaySubject, Subject, type Subscription, timeout as rxTimeout } from 'rxjs'
import type {
  CapabilitySchema,
  CapabilityPreviewRequest,
  CapabilityPreviewResult,
  DataConnection,
  DataConnectionEvent,
  DataConnectionRequest,
  DataSource,
  DataSourceCreateContext,
  DataSourceDefinition,
  DataSourceResult,
  PersistedDataBinding,
  ResolvedDataSourceRequest,
  RuntimeContext,
  RuntimeQueryOptions,
} from '../types'
import { applyOutputMapping } from '../mapping'
import { createCapabilityError } from '../utils'
import { capabilitySchemaValidator } from '../validation'
import { assertExecutable } from './availability'
import { CancellationResource } from './cancellation-resource'
import type {
  CapabilityMountStamp,
  ProviderDefinitionIds,
  ProviderDefinitionKind,
  RuntimeRegistryAccess,
} from './contracts'
import { sameMount } from './contracts'
import { assertDataBindingVersion } from './version-guards'
import {
  nextRuntimeResourceId,
  safeDispose,
  safeDisposeAsync,
  safeUnsubscribe,
} from './resource-lifecycle'

type QueryResource = CancellationResource & {
  capabilityId: string
  registration?: CapabilityMountStamp
  dataSource?: DataSource
  subscription?: Subscription
}

interface SharedConnection {
  events$: Subject<DataConnectionEvent>
  refCount: number
  consumers: Set<string>
  abortController: AbortController
  subscription?: Subscription
  dataSource?: DataSource
  disposed: boolean
  capabilityId: string
  registration?: CapabilityMountStamp
  lastStatus?: DataConnectionEvent
  lastData?: DataConnectionEvent
}

interface QueryRunResult<T> {
  result: DataSourceResult<T>
  outputSchema?: CapabilitySchema
  warnings?: CapabilityPreviewResult['warnings']
}

export interface SourceRunnerHost {
  readonly registry: RuntimeRegistryAccess
  readonly disposed: boolean
  ensureReady(capabilityId: string, signal?: AbortSignal): Promise<void>
  assertActive(): void
  assertRegistrationActive(
    registration: CapabilityMountStamp | undefined,
    kind: ProviderDefinitionKind,
    capabilityId?: string,
  ): void
  resolveRecord(values: PersistedDataBinding['query'], signal?: AbortSignal): Promise<Record<string, unknown> | undefined>
  resolveFilter(values: PersistedDataBinding['filter'], signal?: AbortSignal): Promise<PersistedDataBinding['filter']>
  toRuntimeContext(signal?: AbortSignal): RuntimeContext
  toDataSourceCreateContext(signal?: AbortSignal): DataSourceCreateContext
  requireSource(ref: { capabilityId: string; version: number }): DataSourceDefinition
}

export class DataSourceRunner {
  private readonly disposers = new Set<() => void>()
  private readonly sharedConnections = new Map<string, SharedConnection>()
  private readonly queryResources = new Set<QueryResource>()

  constructor(private readonly runtime: SourceRunnerHost) {}

  private get registry(): RuntimeRegistryAccess {
    return this.runtime.registry
  }

  private get disposed(): boolean {
    return this.runtime.disposed
  }

  private assertActive(): void {
    this.runtime.assertActive()
  }

  private assertRegistrationActive(
    registration: CapabilityMountStamp | undefined,
    kind: ProviderDefinitionKind,
    capabilityId?: string,
  ): void {
    this.runtime.assertRegistrationActive(registration, kind, capabilityId)
  }

  private resolveRecord(values: PersistedDataBinding['query'], signal?: AbortSignal) {
    return this.runtime.resolveRecord(values, signal)
  }

  private resolveFilter(values: PersistedDataBinding['filter'], signal?: AbortSignal) {
    return this.runtime.resolveFilter(values, signal)
  }

  private toRuntimeContext(signal?: AbortSignal): RuntimeContext {
    return this.runtime.toRuntimeContext(signal)
  }

  private toDataSourceCreateContext(signal?: AbortSignal): DataSourceCreateContext {
    return this.runtime.toDataSourceCreateContext(signal)
  }

  private requireSource(ref: { capabilityId: string; version: number }): DataSourceDefinition {
    return this.runtime.requireSource(ref)
  }
  connect<T = unknown>(request: DataConnectionRequest): DataConnection<T> {
    this.assertActive()
    assertDataBindingVersion(request.binding)
    assertPlanSupported(request.binding)
    const id = request.id || nextRuntimeResourceId(`connection:${request.consumerId}`)
    const events$ = new ReplaySubject<DataConnectionEvent<T>>(1)
    let stopped = false
    let sharedKey: string | undefined
    let sharedSubscription: Subscription | undefined
    let joinedShared = false
    let forwardedShared = false
    const leaseId = nextRuntimeResourceId(`connection:${request.consumerId}:lease`)

    const forwardShared = (shared: SharedConnection) => {
      if (forwardedShared) return
      forwardedShared = true
      if (!shared.disposed && !joinedShared) {
        joinedShared = true
        shared.consumers.add(leaseId)
        shared.refCount = shared.consumers.size
      }
      if (shared.lastStatus?.type === 'status' && shared.lastStatus.status === 'completed') {
        shared.lastData && events$.next(shared.lastData as DataConnectionEvent<T>)
        events$.next(shared.lastStatus as DataConnectionEvent<T>)
      } else {
        shared.lastStatus && events$.next(shared.lastStatus as DataConnectionEvent<T>)
        shared.lastData && events$.next(shared.lastData as DataConnectionEvent<T>)
      }
      if (shared.disposed) {
        events$.complete()
        return
      }
      sharedSubscription = shared.events$.subscribe({
        next: event => events$.next(event as DataConnectionEvent<T>),
        error: error => events$.error(error),
        complete: () => events$.complete(),
      })
    }

    void (async () => {
      events$.next({ type: 'status', status: 'connecting' })
      try {
        const binding = request.binding
        const signal = request.options?.signal
        await this.runtime.ensureReady(binding.source.capabilityId, signal)
        this.assertActive()
        if (stopped || signal?.aborted) return
        const definition = this.requireSource(binding.source)
        const registration = this.registry.getDefinitionRegistration(definition)
        this.assertRegistrationActive(registration, 'sources', definition.id)
        const config = normalizeOmittedObject(definition.configSchema, binding.source.config)
        capabilitySchemaValidator.assert(definition.configSchema, config, {
          phase: 'config',
          capabilityId: definition.id,
        })
        const runtimeContext = this.toRuntimeContext(signal)
        await assertExecutable(definition, runtimeContext)
        this.assertActive()
        this.assertRegistrationActive(registration, 'sources', definition.id)
        if (stopped || signal?.aborted) return
        const query = normalizeOmittedObject(
          definition.querySchema,
          await this.resolveRecord(binding.query, signal),
        )
        this.assertActive()
        this.assertRegistrationActive(registration, 'sources', definition.id)
        if (stopped || signal?.aborted) return
        capabilitySchemaValidator.assert(definition.querySchema, query, {
          phase: 'query',
          capabilityId: definition.id,
        })
        const filter = await this.resolveFilter(binding.filter, signal)
        this.assertActive()
        this.assertRegistrationActive(registration, 'sources', definition.id)
        if (stopped || signal?.aborted) return
        assertCapabilityFilter(definition, filter)
        const resolvedRequest = normalizeDataSourceRequest(definition, {
          capabilityId: binding.source.capabilityId,
          version: binding.source.version,
          config,
          query,
          filter,
          signal,
          limit: resolveLimit(request.options?.limit, definition.defaults?.limit),
          timeout: request.options?.timeout || definition.defaults?.timeout,
        }, runtimeContext)
        sharedKey = getExecutionKey(resolvedRequest, binding, request.options?.targetSchema, registration)
        if (stopped || signal?.aborted) return
        const shared = this.sharedConnections.get(sharedKey)
        if (shared && !shared.disposed) {
          forwardShared(shared)
          return
        }
        if (stopped || signal?.aborted) return
        const createSharedPromise = this.createSharedConnection(
          definition,
          registration,
          resolvedRequest,
          binding,
          request.options?.targetSchema,
          sharedKey,
          leaseId,
        )
        joinedShared = true
        const created = await createSharedPromise
        if (stopped || signal?.aborted) {
          this.releaseSharedConnection(sharedKey, leaseId)
          return
        }
        forwardShared(created)
      } catch (error) {
        if (!stopped) {
          events$.next({ type: 'status', status: 'failed', error: toCapabilityError(error, request.binding.source.capabilityId) })
          events$.complete()
        }
      }
    })()

    const unsubscribe = () => {
      if (stopped) return
      stopped = true
      request.options?.signal?.removeEventListener('abort', unsubscribe)
      safeUnsubscribe(sharedSubscription, `connection:${id}:shared`)
      events$.complete()
      if (sharedKey && joinedShared) this.releaseSharedConnection(sharedKey, leaseId)
      this.disposers.delete(unsubscribe)
    }
    if (request.options?.signal?.aborted) {
      unsubscribe()
    } else {
      request.options?.signal?.addEventListener('abort', unsubscribe, { once: true })
    }
    this.disposers.add(unsubscribe)

    return { id, events$: events$.asObservable(), unsubscribe }
  }

  async query<T = unknown>(
    binding: PersistedDataBinding,
    options: RuntimeQueryOptions = {},
    expectedRegistration?: CapabilityMountStamp,
  ): Promise<DataSourceResult<T>> {
    return (await this.runQuery<T>(binding, options, false, expectedRegistration)).result
  }

  private async runQuery<T>(
    binding: PersistedDataBinding,
    options: RuntimeQueryOptions,
    validateOutput: boolean,
    expectedRegistration?: CapabilityMountStamp,
  ): Promise<QueryRunResult<T>> {
    this.assertActive()
    assertDataBindingVersion(binding)
    assertPlanSupported(binding)
    const capabilityId = binding.source.capabilityId
    const externalSignal = options.signal
    let queryResource!: QueryResource
    queryResource = Object.assign(new CancellationResource(() => {
      safeUnsubscribe(queryResource.subscription, `query:${capabilityId}`)
    }), {
      capabilityId,
    })
    const abortByExternal = () => {
      queryResource.cancel(createCapabilityError('runtime.aborted', 'Runtime query has been aborted', {
        capabilityId: binding.source.capabilityId,
      }))
    }
    externalSignal?.addEventListener('abort', abortByExternal, { once: true })
    if (externalSignal?.aborted) abortByExternal()
    this.queryResources.add(queryResource)
    const runtimeContext = this.toRuntimeContext(queryResource.abortController.signal)
    try {
      await raceQueryCancel(
        this.runtime.ensureReady(capabilityId, queryResource.abortController.signal),
        queryResource,
      )
      this.assertActive()
      this.assertQueryNotAborted(queryResource, capabilityId)
      const definition = this.requireSource(binding.source)
      const registration = this.registry.getDefinitionRegistration(definition)
      // OptionSource configure and DataSource execute must never cross an effective mount replacement.
      if (expectedRegistration && !sameMount(expectedRegistration, registration)) {
        throw createCapabilityError('provider.unregistered', 'Capability provider has been replaced', {
          capabilityId: definition.id,
          retryable: true,
        })
      }
      queryResource.registration = registration
      this.assertRegistrationActive(registration, 'sources', definition.id)
      const config = normalizeOmittedObject(definition.configSchema, binding.source.config)
      capabilitySchemaValidator.assert(definition.configSchema, config, {
        phase: 'config',
        capabilityId: definition.id,
      })
      await raceQueryCancel(assertExecutable(definition, runtimeContext), queryResource)
      this.assertActive()
      this.assertQueryNotAborted(queryResource, definition.id)
      this.assertRegistrationActive(registration, 'sources', definition.id)
      const query = normalizeOmittedObject(
        definition.querySchema,
        await raceQueryCancel(
          this.resolveRecord(binding.query, queryResource.abortController.signal),
          queryResource,
        ),
      )
      this.assertActive()
      this.assertQueryNotAborted(queryResource, definition.id)
      this.assertRegistrationActive(registration, 'sources', definition.id)
      capabilitySchemaValidator.assert(definition.querySchema, query, {
        phase: 'query',
        capabilityId: definition.id,
      })
      const filter = await raceQueryCancel(
        this.resolveFilter(binding.filter, queryResource.abortController.signal),
        queryResource,
      )
      this.assertActive()
      this.assertQueryNotAborted(queryResource, definition.id)
      this.assertRegistrationActive(registration, 'sources', definition.id)
      assertCapabilityFilter(definition, filter)
      const resolvedRequest = normalizeDataSourceRequest(definition, {
        capabilityId: binding.source.capabilityId,
        version: binding.source.version,
        config,
        query,
        filter,
        signal: queryResource.abortController.signal,
        limit: resolveLimit(options.limit, definition.defaults?.limit),
        timeout: options.timeout || definition.defaults?.timeout,
      }, runtimeContext)
      let dataSourceAssigned = false
      const createPromise = Promise.resolve(definition.create(resolvedRequest.config, this.toDataSourceCreateContext(queryResource.abortController.signal)))
      createPromise.then((lateDataSource) => {
        if (!dataSourceAssigned && queryResource.abortController.signal.aborted) {
          safeDispose(lateDataSource, `query:${definition.id}:late`)
        }
      }).catch(() => undefined)
      const dataSource = await raceQueryCancel(createPromise, queryResource)
      dataSourceAssigned = true
      queryResource.dataSource = dataSource
      this.assertActive()
      this.assertQueryNotAborted(queryResource, definition.id)
      this.assertRegistrationActive(registration, 'sources', definition.id)
      const result = await raceQueryCancel(firstDataSourceResult<T>(
        dataSource.query<T>(resolvedRequest, runtimeContext)
          .pipe(resolvedRequest.timeout ? rxTimeout({ first: resolvedRequest.timeout }) : source => source),
        queryResource,
      ), queryResource)
      this.assertActive()
      this.assertQueryNotAborted(queryResource, definition.id)
      this.assertRegistrationActive(registration, 'sources', definition.id)
      queryResource.settled = true
      const sourceOutputSchema = result.outputSchema || definition.outputSchema
      const warnings = validateOutput
        ? capabilitySchemaValidator
            .validate(sourceOutputSchema, result.data, 'output')
            .map(issue => capabilitySchemaValidator.toError(issue, definition.id))
        : undefined
      const mapped = applyOutputMapping(result.data, binding.mapping, {
        targetSchema: options.targetSchema,
        capabilityId: definition.id,
      }) as T
      return {
        result: limitDataSourceResult({
          ...result,
          data: mapped,
          outputSchema: options.targetSchema || result.outputSchema,
        }, resolvedRequest.limit),
        outputSchema: options.targetSchema || sourceOutputSchema,
        warnings: warnings?.length ? warnings : undefined,
      }
    } finally {
      externalSignal?.removeEventListener('abort', abortByExternal)
      this.queryResources.delete(queryResource)
      queryResource.cancel(createCapabilityError('runtime.disposed', 'Runtime query has been disposed', { capabilityId }))
      const dataSource = queryResource.dataSource
      queryResource.dataSource = undefined
      await safeDisposeAsync(dataSource, `query:${capabilityId}`)
    }
  }

  async preview<T = unknown>(request: CapabilityPreviewRequest): Promise<CapabilityPreviewResult<T>> {
    this.assertActive()
    assertPlanSupported(request.binding)
    const { result, outputSchema, warnings } = await this.runQuery<T>(
      request.binding,
      { timeout: request.timeout, limit: request.limit, targetSchema: request.targetSchema },
      true,
    )
    return {
      data: limitData(result.data, request.limit) as T,
      outputSchema,
      warnings,
      diagnostics: result.diagnostics,
    }
  }


  private async createSharedConnection<T>(
    definition: DataSourceDefinition,
    registration: CapabilityMountStamp | undefined,
    request: ResolvedDataSourceRequest,
    binding: PersistedDataBinding,
    targetSchema: CapabilitySchema | undefined,
    key: string,
    initialConsumerId: string,
  ): Promise<SharedConnection> {
    const abortController = new AbortController()
    const shared: SharedConnection = {
      events$: new Subject<DataConnectionEvent>(),
      refCount: 1,
      consumers: new Set([initialConsumerId]),
      abortController,
      disposed: false,
      capabilityId: definition.id,
      registration,
    }
    this.sharedConnections.set(key, shared)
    let createdDataSource: DataSource | undefined

    try {
      const runtimeContext = this.toRuntimeContext(abortController.signal)
      await assertExecutable(definition, runtimeContext)
      this.assertActive()
      this.assertRegistrationActive(registration, 'sources', definition.id)
      const dataSource = await definition.create(request.config, this.toDataSourceCreateContext(abortController.signal))
      createdDataSource = dataSource
      if (shared.disposed || this.disposed || !this.registry.isMountActive(registration, 'sources', definition.id)) {
        await safeDisposeAsync(dataSource, `connection:${definition.id}:late`)
        createdDataSource = undefined
        this.assertActive()
        this.assertRegistrationActive(registration, 'sources', definition.id)
        return shared
      }
      shared.dataSource = dataSource
      this.emitSharedConnection(shared, { type: 'status', status: 'connected' })
      shared.subscription = dataSource.query<T>({ ...request, signal: abortController.signal }, runtimeContext)
        .pipe(request.timeout ? rxTimeout({ first: request.timeout }) : source => source)
        .subscribe({
          next: (result) => {
            if (shared.disposed) return
            try {
              const mapped = applyOutputMapping(result.data, binding.mapping, {
                targetSchema,
                capabilityId: definition.id,
              })
              this.emitSharedConnection(shared, {
                type: 'data',
                result: limitDataSourceResult({
                  ...result,
                  data: mapped as T,
                  outputSchema: targetSchema || result.outputSchema,
                }, request.limit),
              })
            } catch (error) {
              this.emitSharedConnection(shared, {
                type: 'status',
                status: 'failed',
                error: toCapabilityError(error, binding.source.capabilityId),
              })
              shared.events$.complete()
              this.disposeSharedConnection(key)
            }
          },
          error: (error) => {
            this.emitSharedConnection(shared, { type: 'status', status: 'failed', error: toCapabilityError(error, binding.source.capabilityId) })
            shared.events$.complete()
            this.disposeSharedConnection(key)
          },
          complete: () => {
            this.emitSharedConnection(shared, { type: 'status', status: 'completed' })
            shared.events$.complete()
            this.disposeSharedConnection(key)
          },
        })
    } catch (error) {
      if (!shared.dataSource) safeDispose(createdDataSource, `connection:${definition.id}:failed`)
      this.emitSharedConnection(shared, { type: 'status', status: 'failed', error: toCapabilityError(error, binding.source.capabilityId) })
      shared.events$.complete()
      this.disposeSharedConnection(key)
    }
    return shared
  }

  private releaseSharedConnection(key: string, consumerId: string): void {
    const shared = this.sharedConnections.get(key)
    if (!shared) return
    shared.consumers.delete(consumerId)
    shared.refCount = shared.consumers.size
    if (shared.refCount <= 0) {
      this.disposeSharedConnection(key)
    }
  }

  private emitSharedConnection(shared: SharedConnection, event: DataConnectionEvent): void {
    if (event.type === 'status') {
      shared.lastStatus = event
    } else if (event.type === 'data') {
      shared.lastData = event
    }
    shared.events$.next(event)
  }

  private disposeSharedConnection(key: string, unavailable?: ReturnType<typeof createCapabilityError>): void {
    const shared = this.sharedConnections.get(key)
    if (!shared || shared.disposed) return
    shared.disposed = true
    if (unavailable) {
      this.emitSharedConnection(shared, { type: 'status', status: 'unavailable', error: unavailable })
    }
    shared.abortController.abort()
    safeUnsubscribe(shared.subscription, `connection:${shared.capabilityId}`)
    safeDispose(shared.dataSource, `connection:${shared.capabilityId}`)
    shared.events$.complete()
    this.sharedConnections.delete(key)
  }


  async dispose(): Promise<void> {
    this.disposers.forEach(disposer => disposer())
    this.disposers.clear()
    this.queryResources.forEach((resource) => {
      resource.cancel(createCapabilityError('runtime.disposed', 'Runtime has been disposed'))
      const dataSource = resource.dataSource
      resource.dataSource = undefined
      safeDispose(dataSource, `query:${resource.capabilityId}`)
    })
    this.queryResources.clear()
    for (const key of [...this.sharedConnections.keys()]) {
      this.disposeSharedConnection(key)
    }
  }

  disposeProviderCapabilities(affected: ProviderDefinitionIds): void {
    if (this.disposed) return
    this.queryResources.forEach((resource) => {
      if (!affected.sources.has(resource.capabilityId) || !sameMount(resource.registration, affected.mount)) return
      resource.cancel(createCapabilityError('capability.unavailable', 'Capability provider has been unregistered', {
        capabilityId: resource.capabilityId,
        retryable: true,
      }))
      const dataSource = resource.dataSource
      resource.dataSource = undefined
      safeDispose(dataSource, `query:${resource.capabilityId}`)
      this.queryResources.delete(resource)
    })
    for (const [key, shared] of [...this.sharedConnections.entries()]) {
      if (affected.sources.has(shared.capabilityId) && sameMount(shared.registration, affected.mount)) {
        this.disposeSharedConnection(key, createCapabilityError('capability.unavailable', 'Capability provider has been unregistered', {
          capabilityId: shared.capabilityId,
          retryable: true,
        }))
      }
    }
  }

  private assertQueryNotAborted(resource: QueryResource, capabilityId?: string): void {
    if (resource.abortController.signal.aborted) {
      throw createCapabilityError('runtime.aborted', 'Runtime query has been aborted', { capabilityId })
    }
  }
}


function resolveLimit(...values: Array<number | undefined>): number | undefined {
  const candidates = values.filter((value): value is number => (
    typeof value === 'number' && Number.isInteger(value) && value > 0
  ))
  if (!candidates.length) return undefined
  return Math.min(...candidates)
}

// config/query 在持久化契约中可省略；对象 Schema 仍应以空对象进入 required 校验和 Provider。
function normalizeOmittedObject<T>(
  schema: CapabilitySchema | undefined,
  value: T,
): T | Record<string, never> {
  return value === undefined && schema?.type === 'object' ? {} : value
}

function limitDataSourceResult<T>(result: DataSourceResult<T>, limit?: number): DataSourceResult<T> {
  if (!limit) return result
  const data = limitData(result.data, limit) as T
  const next: DataSourceResult<T> = { ...result, data }
  if (Array.isArray(data)) {
    next.pageSize = typeof result.pageSize === 'number' ? Math.min(result.pageSize, limit) : data.length
  }
  return next
}

function limitData(data: unknown, limit?: number): unknown {
  if (!limit || !Array.isArray(data)) return data
  return data.slice(0, limit)
}

function normalizeDataSourceRequest(
  definition: DataSourceDefinition,
  request: ResolvedDataSourceRequest,
  context: RuntimeContext,
): ResolvedDataSourceRequest {
  return definition.optimizer?.normalize?.(request, context) || request
}

function assertCapabilityFilter(
  definition: DataSourceDefinition,
  filter: PersistedDataBinding['filter'],
): void {
  const terms = filter?.terms || []
  const schema = definition.filterSchema
  if (!schema) {
    if (terms.length) {
      throw createCapabilityError('filter.unsupported', 'Data source does not support filter conditions', {
        capabilityId: definition.id,
      })
    }
    return
  }

  const values: Record<string, unknown> = {}
  const fields = new Set<string>()
  terms.forEach((term) => {
    if (!term.field || fields.has(term.field)) {
      throw createCapabilityError('filter.field_invalid', 'Filter fields must be unique', {
        capabilityId: definition.id,
        details: { field: term.field },
      })
    }
    const fieldSchema = resolveFilterFieldSchema(schema, term.field)
    const operators = fieldSchema?.filter?.operators || []
    if (!fieldSchema || !operators.includes(term.operator)) {
      throw createCapabilityError('filter.operator_unsupported', 'Filter operator is not supported', {
        capabilityId: definition.id,
        details: { field: term.field, operator: term.operator },
      })
    }
    fields.add(term.field)
    setFilterFieldValue(values, term.field, term.value)
  })
  capabilitySchemaValidator.assert(schema, values, {
    phase: 'query',
    capabilityId: definition.id,
  })
}

function setFilterFieldValue(
  target: Record<string, unknown>,
  field: string,
  value: unknown,
): void {
  const segments = field.split('.').filter(Boolean)
  let current = target
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value
      return
    }
    const nested = current[segment]
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) current[segment] = {}
    current = current[segment] as Record<string, unknown>
  })
}

function resolveFilterFieldSchema(
  schema: CapabilitySchema,
  field: string,
): CapabilitySchema | undefined {
  return field.split('.').filter(Boolean).reduce<CapabilitySchema | undefined>(
    (current, segment) => current?.type === 'object' ? current.properties?.[segment] : undefined,
    schema,
  )
}

// Until merge/split is implemented, only fully identical normalized requests can share upstream.
function getExecutionKey(
  request: ResolvedDataSourceRequest,
  binding: PersistedDataBinding,
  targetSchema?: CapabilitySchema,
  registration?: CapabilityMountStamp,
): string {
  const { signal: _signal, ...stableRequest } = request
  return stableStringify({
    source: stableRequest,
    mapping: binding.mapping,
    targetSchema,
    plan: binding.plan,
    registration,
  })
}




function firstDataSourceResult<T>(source: ReturnType<DataSource['query']>, resource: QueryResource): Promise<DataSourceResult<T>> {
  return new Promise((resolve, reject) => {
    let settled = false
    let subscription: Subscription | undefined
    const settleReject = (error: unknown) => {
      if (settled) return
      settled = true
      removeCancelHandler()
      reject(error)
    }
    const removeCancelHandler = resource.addCancelHandler(settleReject)
    subscription = source.subscribe({
      next: (result) => {
        if (settled) return
        settled = true
        removeCancelHandler()
        resolve(result as DataSourceResult<T>)
        queueMicrotask(() => safeUnsubscribe(subscription, `query:${resource.capabilityId}:first-result`))
      },
      error: (error) => settleReject(error),
      complete: () => settleReject(createCapabilityError('data_source.empty', 'Data source completed without data')),
    })
    resource.subscription = subscription
    if (resource.abortController.signal.aborted) {
      settleReject(createCapabilityError('runtime.aborted', 'Runtime query has been aborted'))
    }
  })
}

function raceQueryCancel<T>(promise: Promise<T>, resource: QueryResource): Promise<T> {
  return Promise.race([promise, resource.cancelPromise])
}


function assertPlanSupported(binding: PersistedDataBinding): void {
  if (binding.plan?.nodes?.length) {
    throw createCapabilityError('data_source.plan.unsupported', 'Data source plan is not supported yet', {
      capabilityId: binding.source.capabilityId,
    })
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function toCapabilityError(error: unknown, capabilityId?: string) {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    return error as ReturnType<typeof createCapabilityError>
  }
  const message = error instanceof Error ? error.message : String(error)
  return createCapabilityError('capability.runtime_error', message, { capabilityId, cause: error })
}
