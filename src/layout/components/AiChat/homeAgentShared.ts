import type { MaybeArray } from './homeAgentContracts'

export const DEFAULT_HOME_AGENT_LIMIT = 20
export const HOME_AGENT_PROMPT_EXAMPLE_LIMIT = 3

export const toArray = <T>(value: MaybeArray<T>): T[] => {
  if (value === undefined || value === null) return []
  return (Array.isArray(value) ? value : [value]).filter((item): item is T => !!item)
}

export const resolveMaybeArray = <T>(
  value: MaybeArray<T> | (() => MaybeArray<T>) | undefined,
) => (typeof value === 'function' ? toArray((value as () => MaybeArray<T>)()) : toArray(value))

export const normalizeText = (value: unknown) => String(value || '').trim()
export const normalizeKeyword = (value: unknown) => normalizeText(value).toLowerCase()

export const resolveOptionText = (
  value?: string | (() => string | undefined),
) => normalizeText(typeof value === 'function' ? value() : value)

export const uniqueStrings = (items: unknown[]) => {
  const seen = new Set<string>()
  const result: string[] = []
  items.forEach((item) => {
    const text = normalizeText(item)
    if (!text || seen.has(text)) return
    seen.add(text)
    result.push(text)
  })
  return result
}

export const clampLimit = (value: unknown, defaultValue = DEFAULT_HOME_AGENT_LIMIT) => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return defaultValue
  return Math.min(100, Math.max(1, Math.floor(numberValue)))
}

export const isPlainRecord = (value: unknown): value is Record<string, any> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

export const compactDefined = (value: Record<string, any>) => (
  Object.fromEntries(Object.entries(value).filter(([, item]) => {
    if (Array.isArray(item)) return item.length > 0
    return item !== undefined && item !== null && item !== ''
  }))
)
