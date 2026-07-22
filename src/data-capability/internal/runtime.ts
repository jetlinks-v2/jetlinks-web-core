import type {
  CapabilityDefinitionBase,
  CapabilityPreviewRequest,
  CapabilityPreviewResult,
  ConfirmedOperation,
  DataCapabilityRuntime,
  DataConnection,
  DataConnectionRequest,
  DataSourceDefinition,
  DataSourceResult,
  OperationConfirmationProof,
  OperationContext,
  OperationDefinition,
  OperationExecution,
  PersistedDataBinding,
  PersistedOperationBinding,
  PreparedOperation,
  RuntimeContext,
  RuntimeCreateContext,
  RuntimeQueryOptions,
  ValueBinding,
} from '../types'
import { BindingResolver } from '../binding'
import { createCapabilityError } from '../utils'
import type {
  CapabilityMountStamp,
  ProviderDefinitionIds,
  ProviderDefinitionKind,
  RuntimeRegistryAccess,
} from './contracts'
import { OperationRunner } from './operation-runner'
import { DataSourceRunner } from './source-runner'

export class DefaultDataCapabilityRuntime implements DataCapabilityRuntime {
  private disposedState = false
  private readonly bindingResolver: BindingResolver
  private readonly parameters: Record<string, unknown>
  private readonly contexts = new Map<string, unknown>()
  private readonly sourceRunner: DataSourceRunner
  private readonly operationRunner: OperationRunner

  constructor(
    readonly registry: RuntimeRegistryAccess,
    private readonly runtimeContext: RuntimeCreateContext,
    private readonly onDispose: () => void,
  ) {
    this.parameters = { ...(runtimeContext.parameters || {}) }
    this.bindingResolver = new BindingResolver(registry.contexts)
    this.sourceRunner = new DataSourceRunner(this)
    this.operationRunner = new OperationRunner(this)
  }

  get disposed(): boolean {
    return this.disposedState
  }

  ensureReady(signal?: AbortSignal): Promise<void> {
    return this.registry.ensureReady(this.toRuntimeContext(signal))
  }

  connect<T = unknown>(request: DataConnectionRequest): DataConnection<T> {
    return this.sourceRunner.connect<T>(request)
  }

  query<T = unknown>(binding: PersistedDataBinding, options?: RuntimeQueryOptions): Promise<DataSourceResult<T>> {
    return this.sourceRunner.query<T>(binding, options)
  }

  preview<T = unknown>(request: CapabilityPreviewRequest): Promise<CapabilityPreviewResult<T>> {
    return this.sourceRunner.preview<T>(request)
  }

  prepareOperation(binding: PersistedOperationBinding): Promise<PreparedOperation> {
    return this.operationRunner.prepareOperation(binding)
  }

  confirmOperation(preparedId: string, proof: OperationConfirmationProof): ConfirmedOperation {
    return this.operationRunner.confirmOperation(preparedId, proof)
  }

  executeOperation(operation: ConfirmedOperation | PreparedOperation): OperationExecution {
    return this.operationRunner.executeOperation(operation)
  }

  updateParameters(values: Record<string, unknown>): void {
    this.assertActive()
    Object.assign(this.parameters, values)
  }

  updateContext(providerId: string, instanceId: string, value: unknown): void {
    this.assertActive()
    this.contexts.set(`${providerId}:${instanceId}`, value)
  }

  async dispose(): Promise<void> {
    if (this.disposedState) return
    this.disposedState = true
    this.onDispose()
    await this.sourceRunner.dispose()
    await this.operationRunner.dispose()
    this.contexts.clear()
  }

  disposeProviderCapabilities(affected: ProviderDefinitionIds): void {
    if (this.disposedState) return
    this.sourceRunner.disposeProviderCapabilities(affected)
    this.operationRunner.disposeProviderCapabilities(affected)
  }

  assertActive(): void {
    if (this.disposedState) {
      throw createCapabilityError('runtime.disposed', 'Runtime has been disposed')
    }
  }

  assertRegistrationActive(
    registration: CapabilityMountStamp | undefined,
    kind: ProviderDefinitionKind,
    capabilityId?: string,
  ): void {
    if (!this.registry.isMountActive(registration, kind, capabilityId)) {
      throw createCapabilityError('provider.unregistered', 'Provider has been unregistered', {
        capabilityId,
        retryable: true,
      })
    }
  }

  resolveRecord(
    values: Record<string, ValueBinding | unknown> | undefined,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown> | undefined> {
    return this.bindingResolver.resolveRecord(values, this.toRuntimeContext(signal))
  }

  toRuntimeContext(signal?: AbortSignal): RuntimeContext {
    return {
      ...this.runtimeContext,
      parameters: this.parameters,
      contexts: Object.fromEntries(this.contexts),
      signal,
    }
  }

  toDataSourceCreateContext(signal?: AbortSignal) {
    const runtime = this.toRuntimeContext(signal)
    return {
      parameters: runtime.parameters,
      attributes: runtime.attributes,
      contexts: runtime.contexts,
      runtime,
      signal,
    }
  }

  toOperationCreateContext(signal?: AbortSignal) {
    const runtime = this.toRuntimeContext(signal)
    return {
      parameters: runtime.parameters,
      attributes: runtime.attributes,
      contexts: runtime.contexts,
      runtime,
      signal,
    }
  }

  toOperationContext(signal?: AbortSignal): OperationContext {
    const runtime = this.toRuntimeContext(signal)
    return {
      ...runtime,
      runtime,
    }
  }

  requireSource(ref: { capabilityId: string; version: number }): DataSourceDefinition {
    const definition = this.registry.sources.get(ref.capabilityId)
    if (!definition) {
      throw createCapabilityError('source.not_found', `DataSource ${ref.capabilityId} is not registered`, {
        capabilityId: ref.capabilityId,
      })
    }
    assertCapabilityVersion(definition, ref.version)
    return definition
  }

  requireOperation(ref: { capabilityId: string; version: number }): OperationDefinition {
    const definition = this.registry.operations.get(ref.capabilityId)
    if (!definition) {
      throw createCapabilityError('operation.not_found', `Operation ${ref.capabilityId} is not registered`, {
        capabilityId: ref.capabilityId,
      })
    }
    assertCapabilityVersion(definition, ref.version)
    return definition
  }
}

function assertCapabilityVersion(definition: CapabilityDefinitionBase, version: number): void {
  if (definition.version !== version) {
    throw createCapabilityError('capability.version_mismatch', 'Capability version mismatch', {
      capabilityId: definition.id,
      details: {
        expected: version,
        actual: definition.version,
      },
    })
  }
}
