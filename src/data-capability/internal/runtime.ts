import type {
  BindingRuntimeContext,
  CapabilityFilterExpression,
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
  OptionSourceDefinition,
  OptionSourceRef,
  OptionSourceResult,
  PersistedDataBinding,
  PersistedOperationBinding,
  PreparedOperation,
  RuntimeOptionRequest,
  RuntimeOutputRef,
  RuntimeOutputSnapshot,
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
import { OptionSourceRunner } from './option-source-runner'
import { DataSourceRunner } from './source-runner'

export class DefaultDataCapabilityRuntime implements DataCapabilityRuntime {
  private disposedState = false
  private readonly bindingResolver: BindingResolver
  private readonly parameters: Record<string, unknown>
  private readonly contexts = new Map<string, unknown>()
  private readonly outputs = new Map<string, RuntimeOutputState>()
  private readonly sourceRunner: DataSourceRunner
  private readonly operationRunner: OperationRunner
  private readonly optionSourceRunner: OptionSourceRunner

  constructor(
    readonly registry: RuntimeRegistryAccess,
    private readonly runtimeContext: RuntimeCreateContext,
    private readonly onDispose: () => void,
  ) {
    this.parameters = { ...(runtimeContext.parameters || {}) }
    this.bindingResolver = new BindingResolver(registry.contexts)
    this.sourceRunner = new DataSourceRunner(this)
    this.operationRunner = new OperationRunner(this)
    this.optionSourceRunner = new OptionSourceRunner(this, this.sourceRunner)
  }

  get disposed(): boolean {
    return this.disposedState
  }

  ensureReady(capabilityId: string, signal?: AbortSignal): Promise<void> {
    return this.registry.ensureReady(this.toRuntimeContext(signal), capabilityId)
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

  resolveOptions(ref: OptionSourceRef, request?: RuntimeOptionRequest): Promise<OptionSourceResult> {
    return this.optionSourceRunner.resolve(ref, request)
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

  updateOutput(ref: RuntimeOutputRef, value: unknown): void {
    this.assertActive()
    const output = this.outputs.get(ref.nodeId) || { hasDefault: false, ports: new Map<string, unknown>() }
    if (ref.port === undefined) {
      output.hasDefault = true
      output.defaultValue = value
    } else {
      output.ports.set(ref.port, value)
    }
    this.outputs.set(ref.nodeId, output)
  }

  removeOutput(ref: RuntimeOutputRef): void {
    this.assertActive()
    const output = this.outputs.get(ref.nodeId)
    if (!output) return
    if (ref.port === undefined) {
      output.hasDefault = false
      output.defaultValue = undefined
    } else {
      output.ports.delete(ref.port)
    }
    if (!output.hasDefault && output.ports.size === 0) {
      this.outputs.delete(ref.nodeId)
    }
  }

  async dispose(): Promise<void> {
    if (this.disposedState) return
    this.disposedState = true
    this.onDispose()
    this.optionSourceRunner.dispose()
    await this.sourceRunner.dispose()
    await this.operationRunner.dispose()
    this.contexts.clear()
    this.outputs.clear()
  }

  disposeProviderCapabilities(affected: ProviderDefinitionIds): void {
    if (this.disposedState) return
    this.optionSourceRunner.disposeProviderCapabilities(affected)
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

  resolveFilter(
    filter: CapabilityFilterExpression | undefined,
    signal?: AbortSignal,
  ): Promise<CapabilityFilterExpression | undefined> {
    return this.bindingResolver.resolveFilter(filter, this.toRuntimeContext(signal))
  }

  toRuntimeContext(signal?: AbortSignal): BindingRuntimeContext {
    return {
      ...this.runtimeContext,
      parameters: this.parameters,
      contexts: Object.fromEntries(this.contexts),
      outputs: this.createOutputSnapshot(),
      signal,
    }
  }

  private createOutputSnapshot(): Record<string, RuntimeOutputSnapshot> {
    return Object.fromEntries([...this.outputs].map(([nodeId, output]) => {
      const snapshot: RuntimeOutputSnapshot = {
        ...(output.hasDefault ? { default: output.defaultValue } : {}),
        ...(output.ports.size ? { ports: Object.fromEntries(output.ports) } : {}),
      }
      return [nodeId, snapshot]
    }))
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

  requireOptionSource(ref: { capabilityId: string; version: number }): OptionSourceDefinition {
    const definition = this.registry.optionSources.get(ref.capabilityId)
    if (!definition) {
      throw createCapabilityError('option_source.not_found', `OptionSource ${ref.capabilityId} is not registered`, {
        capabilityId: ref.capabilityId,
      })
    }
    assertCapabilityVersion(definition, ref.version)
    return definition
  }
}

interface RuntimeOutputState {
  hasDefault: boolean
  defaultValue?: unknown
  ports: Map<string, unknown>
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
