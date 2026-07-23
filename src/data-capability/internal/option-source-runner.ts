import type {
  DataSourceDefinition,
  OptionSourceDefinition,
  OptionSourceRef,
  OptionSourceResult,
  PersistedDataBinding,
  RuntimeContext,
  RuntimeOptionRequest,
  ValueBinding,
} from '../types'
import { createCapabilityError } from '../utils'
import { capabilitySchemaValidator } from '../validation'
import { assertConfigurable } from './availability'
import { CancellationResource } from './cancellation-resource'
import type {
  CapabilityMountStamp,
  ProviderDefinitionIds,
  ProviderDefinitionKind,
  RuntimeRegistryAccess,
} from './contracts'
import { sameMount } from './contracts'
import {
  assertOptionRequest,
  assertProjectionRef,
  mergeOptionQuery,
  normalizeDataSourceOptionResult,
  normalizeProviderOptionResult,
  normalizeStaticOptions,
} from './option-source-values'
import type { DataSourceRunner } from './source-runner'

type OptionRequestResource = CancellationResource & {
  capabilityId: string
  kind: Extract<ProviderDefinitionKind, 'sources' | 'optionSources'>
  registration?: CapabilityMountStamp
}

export interface OptionSourceRunnerHost {
  readonly registry: RuntimeRegistryAccess
  readonly disposed: boolean
  ensureReady(signal?: AbortSignal): Promise<void>
  assertActive(): void
  assertRegistrationActive(
    registration: CapabilityMountStamp | undefined,
    kind: ProviderDefinitionKind,
    capabilityId?: string,
  ): void
  resolveRecord(
    values: Record<string, ValueBinding | unknown> | undefined,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown> | undefined>
  toRuntimeContext(signal?: AbortSignal): RuntimeContext
  requireSource(ref: { capabilityId: string; version: number }): DataSourceDefinition
  requireOptionSource(ref: { capabilityId: string; version: number }): OptionSourceDefinition
}

/** Executes every OptionSource kind through the same Runtime lifecycle and validation boundary. */
export class OptionSourceRunner {
  private readonly resources = new Set<OptionRequestResource>()

  constructor(
    private readonly runtime: OptionSourceRunnerHost,
    private readonly sourceRunner: DataSourceRunner,
  ) {}

  async resolve(ref: OptionSourceRef, request: RuntimeOptionRequest = {}): Promise<OptionSourceResult> {
    this.runtime.assertActive()
    assertOptionRequest(request)
    if (request.signal?.aborted) {
      throw createCapabilityError('runtime.aborted', 'Runtime option request has been aborted')
    }
    if (ref.type === 'static') {
      return { options: normalizeStaticOptions(ref.options) }
    }

    const resource = createOptionRequestResource(
      ref.capability.capabilityId,
      ref.type === 'provider' ? 'optionSources' : 'sources',
    )
    const abortByExternal = () => resource.cancel(createCapabilityError(
      'runtime.aborted',
      'Runtime option request has been aborted',
      { capabilityId: resource.capabilityId },
    ))
    request.signal?.addEventListener('abort', abortByExternal, { once: true })
    if (request.signal?.aborted) abortByExternal()
    this.resources.add(resource)

    try {
      await raceOptionCancel(this.runtime.ensureReady(resource.abortController.signal), resource)
      this.assertResourceActive(resource)
      const result = ref.type === 'provider'
        ? await this.resolveProvider(ref, request, resource)
        : await this.resolveDataSource(ref, request, resource)
      this.assertResourceActive(resource)
      resource.settled = true
      return result
    } catch (error) {
      throw toOptionCapabilityError(error, resource.capabilityId)
    } finally {
      request.signal?.removeEventListener('abort', abortByExternal)
      this.resources.delete(resource)
    }
  }

  disposeProviderCapabilities(affected: ProviderDefinitionIds): void {
    if (this.runtime.disposed) return
    this.resources.forEach((resource) => {
      const ids = resource.kind === 'sources' ? affected.sources : affected.optionSources
      if (!ids.has(resource.capabilityId) || !sameMount(resource.registration, affected.mount)) return
      resource.cancel(createCapabilityError('capability.unavailable', 'Capability provider has been unregistered', {
        capabilityId: resource.capabilityId,
        retryable: true,
      }))
    })
  }

  dispose(): void {
    this.resources.forEach(resource => resource.cancel(createCapabilityError(
      'runtime.disposed',
      'Runtime has been disposed',
      { capabilityId: resource.capabilityId },
    )))
    this.resources.clear()
  }

  private async resolveProvider(
    ref: Extract<OptionSourceRef, { type: 'provider' }>,
    request: RuntimeOptionRequest,
    resource: OptionRequestResource,
  ): Promise<OptionSourceResult> {
    const definition = this.runtime.requireOptionSource(ref.capability)
    const registration = this.runtime.registry.getDefinitionRegistration(definition)
    resource.registration = registration
    this.assertResourceActive(resource)

    const availabilityContext = this.runtime.toRuntimeContext(resource.abortController.signal)
    await raceOptionCancel(assertConfigurable(definition, availabilityContext), resource)
    this.assertResourceActive(resource)
    const query = await raceOptionCancel(this.runtime.resolveRecord(ref.query, resource.abortController.signal), resource)
    this.assertResourceActive(resource)
    const resolvedQuery = mergeOptionQuery(ref, query, request)
    capabilitySchemaValidator.assert(definition.querySchema, resolvedQuery, {
      phase: 'option-query',
      capabilityId: definition.id,
    })
    const queryContext = this.runtime.toRuntimeContext(resource.abortController.signal)
    const result = await raceOptionCancel(Promise.resolve(definition.query({
      query: resolvedQuery,
      keyword: request.keyword,
      pageIndex: ref.pagination ? request.pageIndex : undefined,
      pageSize: ref.pagination ? request.pageSize : undefined,
      signal: resource.abortController.signal,
    }, queryContext)), resource)
    this.assertResourceActive(resource)
    return normalizeProviderOptionResult(result, definition)
  }

  private async resolveDataSource(
    ref: Extract<OptionSourceRef, { type: 'data-source' }>,
    request: RuntimeOptionRequest,
    resource: OptionRequestResource,
  ): Promise<OptionSourceResult> {
    assertProjectionRef(ref)
    const definition = this.runtime.requireSource(ref.capability)
    const registration = this.runtime.registry.getDefinitionRegistration(definition)
    resource.registration = registration
    this.assertResourceActive(resource)

    const context = this.runtime.toRuntimeContext(resource.abortController.signal)
    await raceOptionCancel(assertConfigurable(definition, context), resource)
    this.assertResourceActive(resource)
    const query = await raceOptionCancel(this.runtime.resolveRecord(ref.query, resource.abortController.signal), resource)
    this.assertResourceActive(resource)
    const resolvedQuery = mergeOptionQuery(ref, query, request)
    const binding: PersistedDataBinding = {
      version: 1,
      source: ref.capability,
      query: resolvedQuery,
    }
    const result = await raceOptionCancel(this.sourceRunner.query(binding, {
      signal: resource.abortController.signal,
      limit: ref.pagination ? request.pageSize : undefined,
    }, registration), resource)
    this.assertResourceActive(resource)
    return normalizeDataSourceOptionResult(result, ref)
  }

  private assertResourceActive(resource: OptionRequestResource): void {
    this.runtime.assertActive()
    if (resource.cancelled || resource.abortController.signal.aborted) {
      throw createCapabilityError('runtime.aborted', 'Runtime option request has been aborted', {
        capabilityId: resource.capabilityId,
      })
    }
    if (resource.registration) {
      this.runtime.assertRegistrationActive(resource.registration, resource.kind, resource.capabilityId)
    }
  }
}

function createOptionRequestResource(
  capabilityId: string,
  kind: OptionRequestResource['kind'],
): OptionRequestResource {
  return Object.assign(new CancellationResource(), {
    capabilityId,
    kind,
  })
}

function raceOptionCancel<T>(promise: Promise<T>, resource: OptionRequestResource): Promise<T> {
  return Promise.race([promise, resource.cancelPromise])
}

function toOptionCapabilityError(error: unknown, capabilityId: string) {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    return error
  }
  return createCapabilityError('capability.runtime_error', 'Option source execution failed', {
    capabilityId,
    cause: error,
  })
}
