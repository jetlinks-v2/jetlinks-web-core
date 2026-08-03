import type {
  CapabilityAvailability,
  CapabilityDefinitionBase,
  CapabilityError,
  CapabilityQuery,
  DataPath,
  ValueBinding,
} from './types'

export const AVAILABLE_CAPABILITY: CapabilityAvailability = {
  discoverable: true,
  configurable: true,
  executable: true,
}

export function createCapabilityError(
  code: string,
  message: string,
  options: Omit<CapabilityError, 'code' | 'message'> = {},
): CapabilityError {
  return { code, message, ...options }
}

export function getByPath(value: unknown, path?: DataPath): unknown {
  if (!path?.length) return value
  return path.reduce<unknown>((current, key) => {
    if (current == null) return undefined
    return (current as Record<string | number, unknown>)[key]
  }, value)
}

export function setByPath(target: Record<string, unknown>, path: DataPath, value: unknown): void {
  if (!path.length) return
  let current: Record<string, unknown> = target
  path.slice(0, -1).forEach((key) => {
    const next = current[key]
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  })
  current[path[path.length - 1]] = value
}

export function isValueBinding(value: unknown): value is ValueBinding {
  return typeof value === 'object'
    && value !== null
    && ['literal', 'parameter', 'context', 'output', 'expression'].includes(String((value as { kind?: unknown }).kind))
}

export function matchesCapabilityQuery(definition: CapabilityDefinitionBase, query?: CapabilityQuery): boolean {
  if (!query) return true
  if (query.kinds?.length && !query.kinds.includes(definition.kind)) return false
  if (query.ids?.length && !query.ids.includes(definition.id)) return false
  if (query.ownerModuleId && definition.owner.moduleId !== query.ownerModuleId) return false
  if (query.providerId && definition.owner.providerId !== query.providerId) return false
  if (query.tags?.length && !query.tags.every(tag => definition.tags?.includes(tag))) return false
  if (query.facets && Object.entries(query.facets).some(([key, value]) => definition.facets?.[key] !== value)) return false
  if (query.category && definition.facets?.category !== query.category) return false
  if (query.keyword) {
    const keyword = query.keyword.toLowerCase()
    const haystack = [definition.id, definition.name, definition.description, definition.owner.moduleId, definition.owner.providerId]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!haystack.includes(keyword)) return false
  }
  return true
}
