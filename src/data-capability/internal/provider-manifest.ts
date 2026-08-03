import type {
  CapabilityDefinitionBase,
  DataCapabilityProvider,
  DataCapabilityProviderLoadedResult,
  DataCapabilityProviderManifestEntry,
} from '../types'
import { createCapabilityError } from '../utils'

const DEFAULT_PROVIDER_LOAD_TIMEOUT = 10_000
const CAPABILITY_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*(?:\.[a-zA-Z0-9][a-zA-Z0-9_:-]*)+$/

export interface ProviderContractEntry {
  token: string
  moduleId?: string
  capabilityIds?: Set<string>
}

export interface ProviderIndexEntry extends ProviderContractEntry {
  sequence: number
  registered: boolean
  override: boolean
}

/** Owns the capabilityId -> Provider token manifest and its conflict diagnostics. */
export class ProviderCapabilityManifestIndex {
  private readonly providerTokens = new Map<string, string[]>()
  private readonly conflicts = new Map<string, ReturnType<typeof createCapabilityError>>()

  rebuild(entries: Iterable<ProviderIndexEntry>): void {
    this.providerTokens.clear()
    this.conflicts.clear()
    const indexed = [...entries]
      .filter(entry => entry.registered && entry.capabilityIds?.size)
      .sort((left, right) => left.sequence - right.sequence)
    indexed.forEach((entry) => entry.capabilityIds!.forEach((capabilityId) => {
      const tokens = this.providerTokens.get(capabilityId) || []
      tokens.push(entry.token)
      this.providerTokens.set(capabilityId, tokens)
      if (tokens.length > 1 && !entry.override) {
        this.conflicts.set(capabilityId, createCapabilityError(
          'capability.id_conflict',
          'Capability ID is declared by multiple Providers without explicit override',
          { capabilityId, details: { providers: [...tokens] } },
        ))
      }
    }))
  }

  getTokens(capabilityId: string): string[] {
    return [...(this.providerTokens.get(capabilityId) || [])]
  }

  getConflict(capabilityId: string) {
    return this.conflicts.get(capabilityId)
  }

  getConflictedCapabilityIds(): string[] {
    return [...this.conflicts.keys()].sort()
  }

  getConflictedTokens(): Set<string> {
    return new Set([...this.conflicts.keys()].flatMap(id => this.getTokens(id)))
  }

  assertAvailable(capabilityIds: Set<string> | undefined, override: boolean): void {
    if (!capabilityIds || override) return
    for (const capabilityId of capabilityIds) {
      if (this.getTokens(capabilityId).length) {
        throw createCapabilityError('capability.id_conflict', 'Capability ID is already declared by another Provider', {
          capabilityId,
        })
      }
    }
  }
}

export function assertCapabilityId(capabilityId: string): void {
  if (!CAPABILITY_ID_PATTERN.test(capabilityId)) {
    throw createCapabilityError('capability.id_invalid', 'Capability ID must use a dotted namespace', {
      capabilityId,
    })
  }
}

export function assertProviderIdentity(provider: DataCapabilityProvider, moduleId?: string): void {
  if (!provider || typeof provider !== 'object' || !provider.id) {
    throw createCapabilityError('provider.invalid', 'Provider loader did not return a valid Provider')
  }
  if (provider.owner?.providerId !== provider.id) {
    throw createCapabilityError('provider.owner_mismatch', 'Provider owner.providerId must match Provider id', {
      details: { providerId: provider.id },
    })
  }
  if (moduleId && provider.owner.moduleId !== moduleId) {
    throw createCapabilityError('provider.owner_mismatch', 'Provider owner.moduleId must match module manifest owner', {
      details: { providerId: provider.id, moduleId },
    })
  }
  normalizeCapabilityIds(provider.capabilityIds)
}

export function assertCapabilityDefinition(definition: CapabilityDefinitionBase): void {
  assertCapabilityId(definition.id)
  if (!Number.isInteger(definition.version) || definition.version <= 0) {
    throw createCapabilityError('capability.version_invalid', 'Capability version must be a positive integer', {
      capabilityId: definition.id,
      details: { version: definition.version },
    })
  }
  if (!definition.owner?.moduleId || !definition.owner.providerId) {
    throw createCapabilityError('capability.owner_invalid', 'Capability owner is required', {
      capabilityId: definition.id,
    })
  }
}

export function assertLoadedProviderContract(
  entry: ProviderContractEntry,
  provider: DataCapabilityProvider,
  result: DataCapabilityProviderLoadedResult | undefined,
): void {
  const groups: Array<[keyof DataCapabilityProviderLoadedResult, string]> = [
    ['sources', 'data-source'],
    ['operations', 'operation'],
    ['contexts', 'context-value'],
    ['valueEditors', 'value-editor'],
    ['optionSources', 'option-source'],
  ]
  const loadedIds = new Set<string>()
  groups.forEach(([key, kind]) => result?.[key]?.forEach((definition) => {
    assertCapabilityDefinition(definition)
    if (definition.kind !== kind) {
      throw createCapabilityError('capability.kind_mismatch', 'Capability kind does not match Provider collection', {
        capabilityId: definition.id,
        details: { expected: kind, actual: definition.kind },
      })
    }
    if (definition.owner.moduleId !== provider.owner.moduleId
      || definition.owner.providerId !== provider.owner.providerId) {
      throw createCapabilityError('provider.owner_mismatch', 'Capability owner must match Provider owner', {
        capabilityId: definition.id,
        details: { providerId: provider.id },
      })
    }
    if (loadedIds.has(definition.id)) {
      throw createCapabilityError('capability.id_conflict', 'Provider returned a duplicate capability ID', {
        capabilityId: definition.id,
      })
    }
    loadedIds.add(definition.id)
  }))

  const providerIds = normalizeCapabilityIds(provider.capabilityIds)
  if (entry.capabilityIds && providerIds && !sameStringSet(entry.capabilityIds, providerIds)) {
    throw createCapabilityError('provider.manifest_mismatch', 'Provider capability IDs do not match module manifest', {
      details: {
        token: entry.token,
        manifest: [...entry.capabilityIds].sort(),
        provider: [...providerIds].sort(),
      },
    })
  }
  const declaredIds = entry.capabilityIds || providerIds
  if (declaredIds && !sameStringSet(declaredIds, loadedIds)) {
    throw createCapabilityError('provider.manifest_mismatch', 'Provider definitions do not match declared capability IDs', {
      details: {
        token: entry.token,
        declared: [...declaredIds].sort(),
        loaded: [...loadedIds].sort(),
      },
    })
  }
}

export function normalizeManifestEntry(
  manifest: DataCapabilityProviderManifestEntry,
  moduleId: string,
  key: string,
): DataCapabilityProviderManifestEntry {
  if (!manifest || typeof manifest !== 'object' || typeof manifest.loader !== 'function') {
    throw createCapabilityError('provider.manifest_invalid', 'Provider manifest loader must be a function', {
      details: { moduleId, key },
    })
  }
  const capabilityIds = normalizeCapabilityIds(manifest.capabilityIds)
  if (!capabilityIds?.size) {
    throw createCapabilityError('provider.manifest_invalid', 'Provider manifest must declare capability IDs', {
      details: { moduleId, key },
    })
  }
  resolveProviderLoadTimeout(manifest.timeout)
  return manifest
}

export function normalizeCapabilityIds(capabilityIds?: readonly string[]): Set<string> | undefined {
  if (!capabilityIds) return undefined
  const normalized = new Set<string>()
  capabilityIds.forEach((capabilityId) => {
    assertCapabilityId(capabilityId)
    if (normalized.has(capabilityId)) {
      throw createCapabilityError('capability.id_conflict', 'Provider declares a duplicate capability ID', {
        capabilityId,
      })
    }
    normalized.add(capabilityId)
  })
  return normalized
}

export function sameStringSet(left: Set<string> | undefined, right: Set<string> | undefined): boolean {
  if (!left || !right) return left === right
  return left.size === right.size && [...left].every(value => right.has(value))
}

export function resolveProviderLoadTimeout(timeout?: number, fallback?: number): number {
  const value = timeout ?? fallback ?? DEFAULT_PROVIDER_LOAD_TIMEOUT
  if (!Number.isInteger(value) || value <= 0) {
    throw createCapabilityError('provider.timeout_invalid', 'Provider load timeout must be a positive integer', {
      details: { timeout: value },
    })
  }
  return value
}

export function isCapabilityError(error: unknown): error is ReturnType<typeof createCapabilityError> {
  return typeof error === 'object'
    && error !== null
    && typeof (error as { code?: unknown }).code === 'string'
    && typeof (error as { message?: unknown }).message === 'string'
}
