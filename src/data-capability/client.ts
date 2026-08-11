import type {
  DataCapabilityClient,
  DataCapabilityClientCreateContext,
  DataCapabilityClientQueryRequest,
  DataCapabilityRegistry,
  DataCapabilityRuntime,
  DataSourceResult,
} from './types'
import { createCapabilityError } from './utils'
import { dataCapabilityRegistry } from './registry'

let clientRuntimeSequence = 0

/** Thin transient-query facade. Persisted consumers should keep using versioned Runtime bindings. */
export class DefaultDataCapabilityClient implements DataCapabilityClient {
  private readonly runtime: DataCapabilityRuntime
  private readonly disposeController = new AbortController()
  private disposed = false

  constructor(
    private readonly registry: DataCapabilityRegistry,
    private readonly context: DataCapabilityClientCreateContext = {},
  ) {
    this.runtime = registry.createRuntime({
      ...context,
      runtimeId: context.runtimeId || `data-capability-client:${clientRuntimeSequence++}`,
    })
  }

  async query<T = unknown>(request: DataCapabilityClientQueryRequest): Promise<DataSourceResult<T>> {
    this.assertActive()
    await raceClientLoad(
      this.registry.loadCapability(request.capabilityId, this.context),
      request.signal,
      this.disposeController.signal,
      request.capabilityId,
    )
    this.assertActive()
    const definition = this.registry.sources.get(request.capabilityId)
    if (!definition) {
      throw createCapabilityError('source.not_found', `DataSource ${request.capabilityId} is not registered`, {
        capabilityId: request.capabilityId,
      })
    }
    return this.runtime.query<T>({
      version: 1,
      source: {
        capabilityId: request.capabilityId,
        version: request.version ?? definition.version,
        config: request.config,
      },
      query: request.params,
      filter: request.filter,
      mapping: request.mapping,
    }, {
      timeout: request.timeout,
      limit: request.limit,
      signal: request.signal,
      targetSchema: request.targetSchema,
    })
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.disposeController.abort()
    await this.runtime.dispose()
  }

  private assertActive(): void {
    if (this.disposed) {
      throw createCapabilityError('client.disposed', 'Data capability client has been disposed')
    }
  }
}

export function createDataCapabilityClient(
  context: DataCapabilityClientCreateContext = {},
  registry: DataCapabilityRegistry = dataCapabilityRegistry,
): DataCapabilityClient {
  return new DefaultDataCapabilityClient(registry, context)
}

function raceClientLoad<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  disposeSignal: AbortSignal,
  capabilityId: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      signal?.removeEventListener('abort', abort)
      disposeSignal.removeEventListener('abort', dispose)
    }
    const settle = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const abort = () => settle(() => reject(createCapabilityError(
      'runtime.aborted',
      'Data capability client query has been aborted',
      { capabilityId },
    )))
    const dispose = () => settle(() => reject(createCapabilityError(
      'client.disposed',
      'Data capability client has been disposed',
      { capabilityId },
    )))
    signal?.addEventListener('abort', abort, { once: true })
    disposeSignal.addEventListener('abort', dispose, { once: true })
    if (signal?.aborted) {
      abort()
      return
    }
    if (disposeSignal.aborted) {
      dispose()
      return
    }
    promise.then(
      value => settle(() => resolve(value)),
      error => settle(() => reject(error)),
    )
  })
}
