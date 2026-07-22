import { ReplaySubject, type Subscription } from 'rxjs'
import type {
  ConfirmedOperation,
  OperationConfirmationProof,
  OperationContext,
  OperationCreateContext,
  OperationDefinition,
  OperationEvent,
  OperationExecution,
  OperationPolicy,
  PersistedOperationBinding,
  PreparedOperation,
} from '../types'
import { createCapabilityError } from '../utils'
import { resolveAvailability } from './availability'
import type {
  CapabilityMountStamp,
  ProviderDefinitionIds,
  ProviderDefinitionKind,
  RuntimeRegistryAccess,
} from './contracts'
import { sameMount } from './contracts'
import {
  nextRuntimeResourceId,
  safeDispose,
  safeDisposeAsync,
  safeUnsubscribe,
} from './resource-lifecycle'

interface PreparedOperationEntry {
  definition: OperationDefinition
  registration?: CapabilityMountStamp
  operation: Awaited<ReturnType<OperationDefinition['create']>>
  prepared: PreparedOperation
  providerPrepared: PreparedOperation
  providerPreparedId?: string
  createdAt: number
  lastUsedAt: number
}

interface OperationExecutionEntry {
  execution: OperationExecution
  events$: ReplaySubject<OperationEvent>
  dispatched: boolean
  cancelled?: boolean
  subscription?: Subscription
}

interface PendingPrepareResource {
  abortController: AbortController
  capabilityId: string
  registration?: CapabilityMountStamp
  operation?: Awaited<ReturnType<OperationDefinition['create']>>
  preparedId?: string
  cancelPromise: Promise<never>
  cancelHandlers: Set<(error: unknown) => void>
  settled?: boolean
  cancel?: (error: unknown) => void
}

export interface OperationRunnerHost {
  readonly registry: RuntimeRegistryAccess
  readonly disposed: boolean
  assertActive(): void
  assertRegistrationActive(
    registration: CapabilityMountStamp | undefined,
    kind: ProviderDefinitionKind,
    capabilityId?: string,
  ): void
  resolveRecord(
    values: PersistedOperationBinding['input'],
    signal?: AbortSignal,
  ): Promise<Record<string, unknown> | undefined>
  toRuntimeContext(signal?: AbortSignal): OperationContext
  toOperationCreateContext(signal?: AbortSignal): OperationCreateContext
  toOperationContext(signal?: AbortSignal): OperationContext
  requireOperation(ref: { capabilityId: string; version: number }): OperationDefinition
}

const RISK_ORDER: OperationPolicy['risk'][] = ['low', 'medium', 'high', 'critical']
const CONFIRMATION_ORDER: OperationPolicy['confirmation'][] = ['none', 'destructive', 'provider', 'always']
const RETRY_ORDER: OperationPolicy['retry'][] = ['never', 'idempotent-only', 'provider']
const CANCELLATION_ORDER: OperationPolicy['cancellation'][] = ['unsupported', 'before-dispatch', 'best-effort', 'compensatable']
const DEFAULT_PREPARED_OPERATION_TTL = 5 * 60 * 1000
const DEFAULT_MAX_PREPARED_OPERATIONS = 100

export class OperationRunner {
  private readonly preparedOperations = new Map<string, PreparedOperationEntry>()
  private readonly confirmedOperations = new Map<string, ConfirmedOperation>()
  private readonly operationExecutions = new Map<string, OperationExecutionEntry>()
  private readonly pendingPrepareResources = new Set<PendingPrepareResource>()

  constructor(private readonly runtime: OperationRunnerHost) {}

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

  private resolveRecord(values: PersistedOperationBinding['input'], signal?: AbortSignal) {
    return this.runtime.resolveRecord(values, signal)
  }

  private toRuntimeContext(signal?: AbortSignal): OperationContext {
    return this.runtime.toRuntimeContext(signal)
  }

  private toOperationCreateContext(signal?: AbortSignal): OperationCreateContext {
    return this.runtime.toOperationCreateContext(signal)
  }

  private toOperationContext(signal?: AbortSignal): OperationContext {
    return this.runtime.toOperationContext(signal)
  }

  private requireOperation(ref: { capabilityId: string; version: number }): OperationDefinition {
    return this.runtime.requireOperation(ref)
  }
  async prepareOperation(binding: PersistedOperationBinding): Promise<PreparedOperation> {
    this.assertActive()
    const definition = this.requireOperation(binding.operation)
    const registration = this.registry.getDefinitionRegistration(definition)
    this.assertRegistrationActive(registration, 'operations', definition.id)
    const prepareResource = this.createPendingPrepareResource(definition.id, registration)
    this.pendingPrepareResources.add(prepareResource)
    let operationAssigned = false
    try {
      const createPromise = Promise.resolve(definition.create(binding.operation.config, this.toOperationCreateContext(prepareResource.abortController.signal)))
      createPromise.then((lateOperation) => {
        if (!operationAssigned && prepareResource.abortController.signal.aborted) {
          safeDispose(lateOperation, `operation:${definition.id}:late-create`)
        }
      }).catch(() => undefined)
      const operation = await racePrepareCancel(createPromise, prepareResource)
      operationAssigned = true
      prepareResource.operation = operation
      this.assertActive()
      this.assertPrepareNotAborted(prepareResource, definition.id)
      this.assertRegistrationActive(registration, 'operations', definition.id)
      const input = await racePrepareCancel(this.resolveRecord(binding.input, prepareResource.abortController.signal), prepareResource)
      this.assertActive()
      this.assertPrepareNotAborted(prepareResource, definition.id)
      this.assertRegistrationActive(registration, 'operations', definition.id)
      const policy = mergeOperationPolicy(definition.policy, binding.policyOverride)
      const request = { config: binding.operation.config, input }
      const hasProviderPrepare = !!operation.prepare
      const prepared: PreparedOperation = hasProviderPrepare
        ? await racePrepareCancel(operation.prepare!(request, this.toOperationContext(prepareResource.abortController.signal)), prepareResource)
        : {
            id: nextRuntimeResourceId(`operation:${definition.id}:prepared`),
            capabilityId: definition.id,
            request,
            policy,
          }
      this.assertActive()
      this.assertPrepareNotAborted(prepareResource, definition.id)
      this.assertRegistrationActive(registration, 'operations', definition.id)
      const providerPreparedId = hasProviderPrepare ? prepared.id : undefined
      const runtimePreparedId = nextRuntimeResourceId(`operation:${definition.id}:prepared`)
      const canonicalPrepared = freezePreparedOperation({
        ...prepared,
        id: runtimePreparedId,
        capabilityId: definition.id,
        policy: mergeOperationPolicy(policy, prepared.policy),
        diagnostics: {
          ...(prepared.diagnostics || {}),
          ...(providerPreparedId ? { providerPreparedId } : {}),
        },
      })
      prepareResource.preparedId = canonicalPrepared.id
      this.sweepPreparedOperations()
      const preparedAt = Date.now()
      this.preparedOperations.set(canonicalPrepared.id, {
        definition,
        registration,
        operation,
        prepared: canonicalPrepared,
        providerPrepared: hasProviderPrepare ? freezePreparedOperation(prepared) : canonicalPrepared,
        providerPreparedId,
        createdAt: preparedAt,
        lastUsedAt: preparedAt,
      })
      this.sweepPreparedOperations()
      prepareResource.settled = true
      return cloneCapabilityValue(canonicalPrepared)
    } catch (error) {
      await safeDisposeAsync(prepareResource.operation, `operation:${definition.id}:prepare-failed`)
      throw error
    } finally {
      this.pendingPrepareResources.delete(prepareResource)
      prepareResource.cancel?.(createCapabilityError('runtime.disposed', 'Runtime prepare has been disposed', { capabilityId: definition.id }))
    }
  }

  private createPendingPrepareResource(
    capabilityId: string,
    registration?: CapabilityMountStamp,
  ): PendingPrepareResource {
    const cancelHandlers = new Set<(error: unknown) => void>()
    const resource: PendingPrepareResource = {
      abortController: new AbortController(),
      capabilityId,
      registration,
      cancelHandlers,
      cancelPromise: new Promise<never>((_, reject) => {
        cancelHandlers.add(reject)
      }),
    }
    resource.cancel = (error: unknown) => {
      if (resource.settled || resource.abortController.signal.aborted) return
      resource.abortController.abort()
      const operation = resource.operation
      resource.operation = undefined
      safeDispose(operation, `operation:${capabilityId}:pending`)
      resource.cancelHandlers.forEach(handler => handler(error))
      resource.cancelHandlers.clear()
    }
    return resource
  }

  confirmOperation(preparedId: string, proof: OperationConfirmationProof): ConfirmedOperation {
    this.assertActive()
    const cached = this.preparedOperations.get(preparedId)
    if (!cached) {
      throw createCapabilityError('operation.not_prepared', 'Operation has not been prepared')
    }
    cached.lastUsedAt = Date.now()
    const confirmed = deepFreeze({
      id: nextRuntimeResourceId(`${preparedId}:confirmed`),
      preparedId,
      capabilityId: cached.prepared.capabilityId,
      proof: {
        ...proof,
        confirmedAt: proof.confirmedAt || Date.now(),
      },
    })
    this.confirmedOperations.set(confirmed.id, confirmed)
    return cloneCapabilityValue(confirmed)
  }

  executeOperation(operation: ConfirmedOperation | PreparedOperation): OperationExecution {
    this.assertActive()
    const confirmed = this.resolveConfirmedOperation(operation)
    const existed = this.operationExecutions.get(confirmed.preparedId)
    if (existed) return existed.execution

    const cached = this.preparedOperations.get(confirmed.preparedId)
    if (!cached) {
      throw createCapabilityError('operation.not_prepared', 'Operation has not been prepared', {
        capabilityId: confirmed.capabilityId,
      })
    }
    cached.lastUsedAt = Date.now()

    const events$ = new ReplaySubject<OperationEvent>(100)
    const execution: OperationExecution = {
      id: confirmed.preparedId,
      events$: events$.asObservable(),
    }
    const entry: OperationExecutionEntry = { execution, events$, dispatched: false }
    if (cached.prepared.policy.cancellation === 'before-dispatch') {
      execution.cancel = () => {
        if (this.operationExecutions.get(confirmed.preparedId) !== entry || entry.cancelled) return
        if (entry.dispatched) {
          throw createCapabilityError(
            'operation.cancellation_unsupported',
            'Operation can only be cancelled before dispatch',
            { capabilityId: confirmed.capabilityId },
          )
        }
        events$.next({ type: 'cancelled', phase: 'before-dispatch' })
        events$.complete()
        this.cleanupOperationExecution(confirmed.preparedId, entry, true)
      }
    }
    this.operationExecutions.set(confirmed.preparedId, entry)

    void (async () => {
      try {
        this.assertActive()
        const availability = await resolveAvailability(cached.definition, this.toRuntimeContext(), 'execute')
        this.assertActive()
        if (this.operationExecutions.get(confirmed.preparedId) !== entry || entry.cancelled) return
        if (this.preparedOperations.get(confirmed.preparedId) !== cached) return
        this.assertRegistrationActive(cached.registration, 'operations', cached.definition.id)
        if (!availability.executable) {
          throw createCapabilityError('operation.unavailable', availability.reason || 'Operation is unavailable', {
            capabilityId: confirmed.capabilityId,
            retryable: availability.retryable,
          })
        }
        this.assertActive()
        if (this.operationExecutions.get(confirmed.preparedId) !== entry || entry.cancelled) return
        if (this.preparedOperations.get(confirmed.preparedId) !== cached) return
        this.assertRegistrationActive(cached.registration, 'operations', cached.definition.id)
        entry.dispatched = true
        delete execution.cancel
        const subscription = cached.operation.execute(cached.providerPrepared, this.toOperationContext()).subscribe({
          next: (event) => {
            events$.next(event)
            if (event.type === 'completed') {
              events$.complete()
              // Provider may emit the semantic completed event synchronously before subscribe() returns.
              // Defer cleanup one microtask so the upstream Subscription is captured and can be released.
              queueMicrotask(() => this.cleanupOperationExecution(confirmed.preparedId, entry, true))
            }
          },
          error: (error) => {
            events$.error(error)
            this.cleanupOperationExecution(confirmed.preparedId, entry, true)
          },
          complete: () => {
            events$.complete()
            this.cleanupOperationExecution(confirmed.preparedId, entry, true)
          },
        })
        entry.subscription = subscription
      } catch (error) {
        events$.error(error)
        this.cleanupOperationExecution(confirmed.preparedId, entry, true)
      }
    })()

    return execution
  }

  private cleanupOperationExecution(preparedId: string, entry: OperationExecutionEntry, releasePrepared: boolean): void {
    if (this.operationExecutions.get(preparedId) === entry) {
      this.operationExecutions.delete(preparedId)
    }
    entry.cancelled = true
    safeUnsubscribe(entry.subscription, `operation:${preparedId}`)
    if (releasePrepared) this.releasePreparedOperation(preparedId)
  }

  private releasePreparedOperation(preparedId: string): void {
    const entry = this.preparedOperations.get(preparedId)
    if (!entry) return
    safeDispose(entry.operation, `operation:${entry.definition.id}`)
    this.preparedOperations.delete(preparedId)
    for (const [confirmedId, confirmed] of [...this.confirmedOperations.entries()]) {
      if (confirmed.preparedId === preparedId) this.confirmedOperations.delete(confirmedId)
    }
  }

  private sweepPreparedOperations(): void {
    const now = Date.now()
    const expired = [...this.preparedOperations.entries()]
      .filter(([preparedId, entry]) => (
        !this.operationExecutions.has(preparedId)
        && now - entry.lastUsedAt > DEFAULT_PREPARED_OPERATION_TTL
      ))
      .map(([preparedId]) => preparedId)
    expired.forEach(preparedId => this.releasePreparedOperation(preparedId))

    const overflow = this.preparedOperations.size - DEFAULT_MAX_PREPARED_OPERATIONS
    if (overflow > 0) {
      [...this.preparedOperations.entries()]
        .filter(([preparedId]) => !this.operationExecutions.has(preparedId))
        .sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt)
        .slice(0, overflow)
        .forEach(([preparedId]) => this.releasePreparedOperation(preparedId))
    }
  }

  private resolveConfirmedOperation(operation: ConfirmedOperation | PreparedOperation): ConfirmedOperation {
    if ('preparedId' in operation) {
      const cached = this.confirmedOperations.get(operation.id)
      if (!cached || cached.preparedId !== operation.preparedId) {
        throw createCapabilityError('operation.confirmation_invalid', 'Operation confirmation is invalid', {
          capabilityId: operation.capabilityId,
        })
      }
      return cached
    }
    const cached = this.preparedOperations.get(operation.id)
    if (!cached) {
      throw createCapabilityError('operation.not_prepared', 'Operation has not been prepared', {
        capabilityId: operation.capabilityId,
      })
    }
    cached.lastUsedAt = Date.now()
    if (cached.prepared.policy.confirmation !== 'none') {
      throw createCapabilityError('operation.confirmation_required', 'Operation confirmation is required', {
        capabilityId: cached.prepared.capabilityId,
      })
    }
    return {
      id: `${operation.id}:implicit`,
      preparedId: operation.id,
      capabilityId: operation.capabilityId,
      proof: { method: 'policy', confirmedAt: Date.now() },
    }
  }


  async dispose(): Promise<void> {
    this.pendingPrepareResources.forEach((resource) => {
      resource.cancel?.(createCapabilityError('runtime.disposed', 'Runtime has been disposed'))
    })
    this.pendingPrepareResources.clear()
    this.operationExecutions.forEach((entry) => {
      entry.cancelled = true
      safeUnsubscribe(entry.subscription, `operation:${entry.execution.id}`)
    })
    this.operationExecutions.clear()
    for (const entry of this.preparedOperations.values()) {
      await safeDisposeAsync(entry.operation, `operation:${entry.definition.id}`)
    }
    this.preparedOperations.clear()
    this.confirmedOperations.clear()
  }

  disposeProviderCapabilities(affected: ProviderDefinitionIds): void {
    if (this.disposed) return
    this.pendingPrepareResources.forEach((resource) => {
      if (!affected.operations.has(resource.capabilityId) || !sameMount(resource.registration, affected.mount)) return
      resource.cancel?.(createCapabilityError('capability.unavailable', 'Capability provider has been unregistered', {
        capabilityId: resource.capabilityId,
        retryable: true,
      }))
      this.pendingPrepareResources.delete(resource)
    })
    for (const [preparedId, entry] of [...this.preparedOperations.entries()]) {
      if (!affected.operations.has(entry.definition.id) || !sameMount(entry.registration, affected.mount)) continue
      const execution = this.operationExecutions.get(preparedId)
      if (execution?.dispatched) continue
      execution?.events$.error(createCapabilityError('capability.unavailable', 'Capability provider has been unregistered', {
        capabilityId: entry.definition.id,
        retryable: true,
      }))
      if (execution) execution.cancelled = true
      safeUnsubscribe(execution?.subscription, `operation:${preparedId}`)
      this.operationExecutions.delete(preparedId)
      this.releasePreparedOperation(preparedId)
    }
  }

  private assertPrepareNotAborted(resource: PendingPrepareResource, capabilityId?: string): void {
    if (resource.abortController.signal.aborted) {
      throw createCapabilityError('runtime.aborted', 'Runtime prepare has been aborted', { capabilityId })
    }
  }
}


function freezePreparedOperation(prepared: PreparedOperation): PreparedOperation {
  return deepFreeze(cloneCapabilityValue(prepared))
}

function cloneCapabilityValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  Object.freeze(value)
  Object.values(value as Record<string, unknown>).forEach(item => deepFreeze(item))
  return value
}


function racePrepareCancel<T>(promise: Promise<T>, resource: PendingPrepareResource): Promise<T> {
  return Promise.race([promise, resource.cancelPromise])
}

function mergeOperationPolicy(
  base: OperationPolicy,
  override?: Partial<OperationPolicy>,
): OperationPolicy {
  if (!override) return { ...base }
  return {
    ...base,
    risk: maxByOrder(base.risk, override.risk, RISK_ORDER),
    confirmation: maxByOrder(base.confirmation, override.confirmation, CONFIRMATION_ORDER),
    cancellation: minByOrder(base.cancellation, override.cancellation, CANCELLATION_ORDER),
    retry: minByOrder(base.retry, override.retry, RETRY_ORDER),
    batch: mergeBatchPolicy(base.batch, override.batch),
    audit: base.audit || override.audit,
  }
}


function mergeBatchPolicy(base: boolean | undefined, override: boolean | undefined): boolean | undefined {
  assertOptionalBoolean('batch', override)
  if (override === undefined) return base
  return Boolean(base && override)
}

function assertOptionalBoolean(name: string, value: unknown): asserts value is boolean | undefined {
  if (value !== undefined && typeof value !== 'boolean') {
    throw createCapabilityError('operation.policy_invalid', `Operation policy ${name} must be boolean`, {
      details: { name, value },
    })
  }
}

function assertPolicyValue<T extends string>(name: string, value: T | undefined, order: T[]): void {
  if (value !== undefined && !order.includes(value)) {
    throw createCapabilityError('operation.policy_invalid', `Operation policy ${name} is invalid`, {
      details: { name, value },
    })
  }
}

function maxByOrder<T extends string>(base: T, override: T | undefined, order: T[]): T {
  assertPolicyValue('enum', override, order)
  if (!override) return base
  return order.indexOf(override) > order.indexOf(base) ? override : base
}

function minByOrder<T extends string>(base: T, override: T | undefined, order: T[]): T {
  assertPolicyValue('enum', override, order)
  if (!override) return base
  return order.indexOf(override) < order.indexOf(base) ? override : base
}
