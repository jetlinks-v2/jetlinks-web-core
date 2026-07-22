import type {
  CapabilityDefinitionBase,
  CapabilityRegisterOptions,
  CapabilityRegistry,
} from '../types'
import type { CapabilityMountStamp } from './contracts'

interface RegisteredDefinition<T> {
  definition: T
  scope: string
  mount?: CapabilityMountStamp
  active: boolean
  mounted: boolean
}

export class ScopedCapabilityRegistry<T extends CapabilityDefinitionBase> implements CapabilityRegistry<T> {
  private readonly definitions = new Map<string, RegisteredDefinition<T>[]>()

  constructor(
    private readonly notify: () => void,
    private readonly onEffectiveRegister?: (definition: T, scope: string) => CapabilityMountStamp | undefined,
    private readonly onEffectiveUnregister?: (definition: T, mount?: CapabilityMountStamp) => void,
  ) {}

  register(definition: T, options: CapabilityRegisterOptions = {}): () => void {
    const scope = options.scope || 'global'
    const entries = this.definitions.get(definition.id) || []
    if (!options.override && entries.some(item => item.active && item.scope === scope)) {
      throw new Error(`Capability ${definition.id} already registered in scope ${scope}`)
    }

    const entry: RegisteredDefinition<T> = { definition, scope, active: true, mounted: false }
    entries.push(entry)
    this.definitions.set(definition.id, entries)
    this.recompute(definition.id)
    this.notify()

    return () => {
      if (!entry.active) return
      entry.active = false
      this.recompute(definition.id)
      const current = this.definitions.get(definition.id) || []
      const rest = current.filter(item => item.active)
      if (rest.length) {
        this.definitions.set(definition.id, rest)
      } else {
        this.definitions.delete(definition.id)
      }
      this.notify()
    }
  }

  get(id: string): T | undefined {
    return this.getEffectiveEntry(id)?.definition
  }

  list(): T[] {
    return Array.from(this.definitions.keys())
      .map(id => this.getEffectiveEntry(id)?.definition)
      .filter((definition): definition is T => !!definition)
  }

  clear(scope?: string): void {
    const ids = [...this.definitions.keys()]
    ids.forEach((id) => {
      const entries = this.definitions.get(id) || []
      entries.forEach((item) => {
        if (!scope || item.scope === scope) item.active = false
      })
      this.recompute(id)
      const rest = entries.filter(item => item.active)
      if (rest.length) {
        this.definitions.set(id, rest)
      } else {
        this.definitions.delete(id)
      }
    })
    this.notify()
  }

  private getEffectiveEntry(id: string): RegisteredDefinition<T> | undefined {
    const entries = this.definitions.get(id) || []
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      if (entries[i].active) return entries[i]
    }
    return undefined
  }

  private recompute(id: string): void {
    const entries = this.definitions.get(id) || []
    const previous = entries.find(item => item.mounted)
    const next = this.getEffectiveEntry(id)
    if (previous === next) return
    if (previous) {
      previous.mounted = false
      this.onEffectiveUnregister?.(previous.definition, previous.mount)
    }
    if (next) {
      next.mount = this.onEffectiveRegister?.(next.definition, next.scope)
      next.mounted = true
    }
  }
}
