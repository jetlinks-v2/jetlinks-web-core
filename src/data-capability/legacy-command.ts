import { Observable, from, map } from 'rxjs'
import type {
  CapabilityContext,
  DataCapabilityProvider,
  DataSourceDefinition,
  DataSourceRequest,
  DataSourceResult,
  OperationDefinition,
  OperationEvent,
  PreparedOperation,
  RuntimeContext,
} from './types'

export interface LegacyCommandRef {
  serviceId: string
  commandId: string
  commandName?: string
  groupName?: string
}

export interface LegacyCommandMetadata {
  mode?: 'snapshot' | 'page' | 'poll' | 'stream'
  action?: OperationDefinition['action']
  querySchema?: DataSourceDefinition['querySchema']
  inputSchema?: OperationDefinition['inputSchema']
  outputSchema?: DataSourceDefinition['outputSchema']
  configSchema?: DataSourceDefinition['configSchema']
  risk?: OperationDefinition['policy']['risk']
  tags?: string[]
  facets?: Record<string, unknown>
}

export interface LegacyCommandCatalogItem extends LegacyCommandRef {
  id?: string
  type?: 'query' | 'action'
  forQuery?: boolean
  forAction?: boolean
  metadata?: LegacyCommandMetadata
}

export interface LegacyCommandCatalog {
  commands: LegacyCommandCatalogItem[]
}

export interface LegacyCommandExecuteContext extends CapabilityContext {
  signal?: AbortSignal
}

export interface LegacyCommandProviderOptions {
  providerId: string
  moduleId: string
  listCommands(context: CapabilityContext): Promise<LegacyCommandCatalog>
  getMetadata?(command: LegacyCommandRef, context: CapabilityContext): Promise<LegacyCommandMetadata>
  execute(command: LegacyCommandRef, input: unknown, context: LegacyCommandExecuteContext): Promise<unknown>
  subscribe?(command: LegacyCommandRef, input: unknown, context: LegacyCommandExecuteContext): Observable<unknown>
}

const DEFAULT_OPERATION_POLICY: OperationDefinition['policy'] = {
  risk: 'medium',
  confirmation: 'always',
  idempotency: 'none',
  cancellation: 'unsupported',
  retry: 'never',
  concurrency: 'serial',
  audit: true,
}

export function createLegacyCommandProvider(options: LegacyCommandProviderOptions): DataCapabilityProvider {
  return {
    id: options.providerId,
    owner: {
      moduleId: options.moduleId,
      providerId: options.providerId,
    },
    async load(context) {
      const catalog = await options.listCommands(context)
      const sources: DataSourceDefinition[] = []
      const operations: OperationDefinition[] = []

      for (const command of catalog.commands) {
        const metadata = {
          ...(command.metadata || {}),
          ...(options.getMetadata ? await options.getMetadata(command, context) : {}),
        }
        if (command.forQuery || command.type === 'query') {
          sources.push(toDataSourceDefinition(options, command, metadata))
        }
        if (command.forAction || command.type === 'action') {
          operations.push(toOperationDefinition(options, command, metadata))
        }
      }

      return { sources, operations }
    },
  }
}

function toDataSourceDefinition(
  options: LegacyCommandProviderOptions,
  command: LegacyCommandCatalogItem,
  metadata: LegacyCommandMetadata,
): DataSourceDefinition {
  const id = command.id || `legacy.command.datasource.${command.serviceId}.${command.commandId}`
  return {
    id,
    kind: 'data-source',
    version: 1,
    name: command.commandName || command.commandId,
    description: command.groupName,
    owner: { moduleId: options.moduleId, providerId: options.providerId },
    tags: metadata.tags,
    facets: {
      ...(metadata.facets || {}),
      legacy: true,
      serviceId: command.serviceId,
      commandId: command.commandId,
    },
    modes: [metadata.mode || 'snapshot'],
    configSchema: metadata.configSchema,
    querySchema: metadata.querySchema,
    outputSchema: metadata.outputSchema,
    create: () => ({
      query<T = unknown>(request: DataSourceRequest, context: RuntimeContext) {
        if (metadata.mode === 'stream' && options.subscribe) {
          return options
            .subscribe(command, request.query, { ...context, signal: request.signal })
            .pipe(map(data => ({ data: data as T })))
        }
        return from(options.execute(command, request.query, { ...context, signal: request.signal })).pipe(
          source => new Observable<DataSourceResult<T>>((subscriber) => {
            const subscription = source.subscribe({
              next: data => subscriber.next({ data: data as T }),
              error: error => subscriber.error(error),
              complete: () => subscriber.complete(),
            })
            return () => subscription.unsubscribe()
          }),
        )
      },
    }),
  }
}

function toOperationDefinition(
  options: LegacyCommandProviderOptions,
  command: LegacyCommandCatalogItem,
  metadata: LegacyCommandMetadata,
): OperationDefinition {
  const id = command.id || `legacy.command.operation.${command.serviceId}.${command.commandId}`
  return {
    id,
    kind: 'operation',
    version: 1,
    action: metadata.action || 'invoke',
    name: command.commandName || command.commandId,
    description: command.groupName,
    owner: { moduleId: options.moduleId, providerId: options.providerId },
    tags: metadata.tags,
    facets: {
      ...(metadata.facets || {}),
      legacy: true,
      serviceId: command.serviceId,
      commandId: command.commandId,
    },
    configSchema: metadata.configSchema,
    inputSchema: metadata.inputSchema,
    outputSchema: metadata.outputSchema,
    policy: {
      ...DEFAULT_OPERATION_POLICY,
      risk: metadata.risk || DEFAULT_OPERATION_POLICY.risk,
    },
    create: () => ({
      async prepare(request) {
        return {
          id: `${id}:${Date.now()}`,
          capabilityId: id,
          request,
          policy: {
            ...DEFAULT_OPERATION_POLICY,
            risk: metadata.risk || DEFAULT_OPERATION_POLICY.risk,
          },
          summary: command.commandName || command.commandId,
          diagnostics: {
            legacy: true,
            serviceId: command.serviceId,
            commandId: command.commandId,
          },
        }
      },
      execute(prepared: PreparedOperation, context) {
        return from(options.execute(command, prepared.request.input, context)).pipe(
          source => new Observable<OperationEvent>((subscriber) => {
            const subscription = source.subscribe({
              next: result => {
                subscriber.next({ type: 'result', result })
                subscriber.next({ type: 'completed' })
              },
              error: error => subscriber.error(error),
              complete: () => subscriber.complete(),
            })
            return () => subscription.unsubscribe()
          }),
        )
      },
    }),
  }
}
