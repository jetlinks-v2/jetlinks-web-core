import {
  HOME_AGENT_CAPABILITY_CHANGE_EVENT,
  type HomeAgentCapabilityProvider,
} from './homeAgentContracts'
import { normalizeText, toArray } from './homeAgentShared'

class HomeAgentCapabilityRegistry {
  private providers = new Map<string, Array<{ provider: HomeAgentCapabilityProvider; token: symbol }>>()

  private emitChange() {
    window.dispatchEvent(new CustomEvent(HOME_AGENT_CAPABILITY_CHANGE_EVENT))
  }

  register(provider: HomeAgentCapabilityProvider, scope = 'home') {
    const id = normalizeText(provider?.id)
    if (!id) return () => undefined

    const scopedId = `${normalizeText(scope) || 'home'}:${id}`
    const token = Symbol(id)
    const providers = this.providers.get(scopedId) || []
    // A mounted page provider may temporarily override the module-level provider with the same id.
    this.providers.set(scopedId, [...providers, {
      provider: { ...provider, id },
      token,
    }])
    this.emitChange()

    return () => {
      const current = this.providers.get(scopedId) || []
      const next = current.filter(item => item.token !== token)
      if (next.length) {
        this.providers.set(scopedId, next)
        this.emitChange()
      } else if (current.length) {
        this.providers.delete(scopedId)
        this.emitChange()
      }
    }
  }

  unregister(id: string, scope = 'home') {
    this.providers.delete(`${normalizeText(scope) || 'home'}:${normalizeText(id)}`)
    this.emitChange()
  }

  getProviders(scopes: string | string[] = 'home') {
    const prefixes = toArray(scopes).map(scope => `${normalizeText(scope) || 'home'}:`)
    return Array.from(this.providers.entries())
      .filter(([key]) => prefixes.some(prefix => key.startsWith(prefix)))
      .map(([, items]) => items[items.length - 1]?.provider)
      .filter((item): item is HomeAgentCapabilityProvider => !!item)
      .sort((a, b) => (
        (a.order || 0) - (b.order || 0)
        || normalizeText(a.id).localeCompare(normalizeText(b.id))
      ))
  }
}

export const homeAgentCapabilityRegistry = new HomeAgentCapabilityRegistry()

export const registerHomeAgentCapabilityProvider = (
  provider: HomeAgentCapabilityProvider,
) => homeAgentCapabilityRegistry.register(provider, 'home')
