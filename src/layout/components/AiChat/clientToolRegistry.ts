import type { AiClientToolDefinition } from './clientTools'

export interface AiClientToolRegistryRecord<TContext = Record<string, any>> {
  scope: string
  tool: AiClientToolDefinition<TContext>
  order?: number
}

export interface AiClientToolRegistrySnapshot<TContext = Record<string, any>> {
  revision: number
  scopes: string[]
  tools: AiClientToolDefinition<TContext>[]
}

export interface AiClientToolRegistryChange {
  revision: number
  scopes: string[]
}

export type AiClientToolRegistryListener = (change: AiClientToolRegistryChange) => void

interface AiClientToolRegistryScope {
  token: symbol
  records: AiClientToolRegistryRecord<any>[]
}

interface AiClientToolRegistrySubscription {
  scopes: string[]
  listener: AiClientToolRegistryListener
}

const normalizeScopes = (scope?: string | string[]) => {
  const source = Array.isArray(scope) ? scope : [scope]
  return Array.from(new Set(source
    .map(item => String(item || '').trim())
    .filter(Boolean)))
}

const intersects = (left: readonly string[], right: readonly string[]) => (
  !left.length || !right.length || left.some(scope => right.includes(scope))
)

class AiClientToolRegistry {
  private registryMap = new Map<string, AiClientToolRegistryScope>()
  private subscriptions = new Set<AiClientToolRegistrySubscription>()
  private currentRevision = 0

  get revision() {
    return this.currentRevision
  }

  private publish(scopes: string[]) {
    this.currentRevision += 1
    const change = { revision: this.currentRevision, scopes: [...scopes] }
    this.subscriptions.forEach((subscription) => {
      if (intersects(subscription.scopes, scopes)) subscription.listener(change)
    })
  }

  /** Atomically replaces one authorized scope and returns a token-safe disposer. */
  register<TContext = Record<string, any>>(
    scope: string,
    tools: AiClientToolDefinition<TContext> | readonly AiClientToolDefinition<TContext>[],
    order = 0,
  ) {
    const normalizedScope = String(scope || '').trim()
    if (!normalizedScope) return () => undefined

    const source = Array.isArray(tools) ? tools : [tools]
    const records: AiClientToolRegistryRecord<any>[] = source
      .filter(tool => !!tool?.id)
      .map(tool => ({ scope: normalizedScope, tool, order }))
    const ids = new Set<string>()
    records.forEach((record) => {
      if (ids.has(record.tool.id)) throw new Error(`Duplicate client tool id in scope ${normalizedScope}: ${record.tool.id}`)
      ids.add(record.tool.id)
    })

    const token = Symbol(normalizedScope)
    if (records.length) {
      this.registryMap.set(normalizedScope, { token, records })
    } else {
      this.registryMap.delete(normalizedScope)
    }
    this.publish([normalizedScope])

    return () => {
      const current = this.registryMap.get(normalizedScope)
      if (!current || current.token !== token) return
      this.registryMap.delete(normalizedScope)
      this.publish([normalizedScope])
    }
  }

  unregister(scope: string) {
    const normalizedScope = String(scope || '').trim()
    if (!normalizedScope || !this.registryMap.has(normalizedScope)) return false
    this.registryMap.delete(normalizedScope)
    this.publish([normalizedScope])
    return true
  }

  subscribe(listener: AiClientToolRegistryListener): () => void
  subscribe(scope: string | string[], listener: AiClientToolRegistryListener): () => void
  subscribe(
    scopeOrListener: string | string[] | AiClientToolRegistryListener,
    maybeListener?: AiClientToolRegistryListener,
  ) {
    const listener = typeof scopeOrListener === 'function' ? scopeOrListener : maybeListener
    if (!listener) return () => undefined
    const subscription: AiClientToolRegistrySubscription = {
      scopes: typeof scopeOrListener === 'function' ? [] : normalizeScopes(scopeOrListener),
      listener,
    }
    this.subscriptions.add(subscription)
    return () => this.subscriptions.delete(subscription)
  }

  snapshot<TContext = Record<string, any>>(scope?: string | string[]): AiClientToolRegistrySnapshot<TContext> {
    const scopes = normalizeScopes(scope)
    return {
      revision: this.currentRevision,
      scopes,
      tools: this.getTools<TContext>(scopes),
    }
  }

  getTools<TContext = Record<string, any>>(scope?: string | string[]) {
    const scopes = normalizeScopes(scope)
    const records = scopes.length
      ? scopes.flatMap(item => this.registryMap.get(item)?.records || [])
      : Array.from(this.registryMap.values()).flatMap(item => item.records)

    return records
      .slice()
      .sort((a, b) => (
        (a.order || 0) - (b.order || 0)
        || a.tool.id.localeCompare(b.tool.id)
      ))
      .map(record => record.tool as AiClientToolDefinition<TContext>)
  }
}

export const aiClientToolRegistry = new AiClientToolRegistry()
