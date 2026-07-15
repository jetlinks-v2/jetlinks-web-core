export interface ControlledEntryContextRecord<T = Record<string, unknown>> {
  id: string
  namespace: string
  scope: string
  target: string
  context: T
  createdAt: number
  expiresAt: number
}

export interface SaveControlledEntryContextOptions<T> {
  namespace: string
  scope: string
  target: string
  context: T
  ttlMs?: number
  maxContextChars?: number
}

const ENTRY_CONTEXT_PREFIX = 'jetlinks:ai-entry-context:'
const DEFAULT_TTL_MS = 10 * 60 * 1000
const MAX_TTL_MS = 30 * 60 * 1000
const DEFAULT_MAX_CONTEXT_CHARS = 6000
const MAX_ENTRY_ID_LENGTH = 128

const normalizeText = (value: unknown) => String(value || '').trim()

const getStorage = () => {
  if (typeof window === 'undefined') return undefined
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

const createId = () => {
  const crypto = globalThis.crypto
  const id = crypto?.randomUUID?.()
  if (id) return id
  if (!crypto?.getRandomValues) throw new Error('secure entry context id is unavailable')
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

const storageKey = (id: string) => `${ENTRY_CONTEXT_PREFIX}${id}`

const normalizeEntryId = (value: unknown) => {
  const id = normalizeText(value)
  return id.length <= MAX_ENTRY_ID_LENGTH && /^[A-Za-z0-9-]+$/.test(id) ? id : ''
}

/** Stores bounded same-tab navigation state without exposing the original query in the URL. */
export const saveControlledEntryContext = <T>(
  options: SaveControlledEntryContextOptions<T>,
) => {
  const namespace = normalizeText(options.namespace)
  const scope = normalizeText(options.scope)
  const target = normalizeText(options.target)
  if (!namespace || !scope || !target) throw new Error('entry context namespace, scope and target are required')

  const text = JSON.stringify(options.context)
  const maxContextChars = Math.min(
    DEFAULT_MAX_CONTEXT_CHARS,
    Math.max(1, options.maxContextChars ?? DEFAULT_MAX_CONTEXT_CHARS),
  )
  if (typeof text !== 'string' || text.length > maxContextChars) {
    throw new Error('entry context is too large')
  }

  const storage = getStorage()
  if (!storage) throw new Error('entry context storage is unavailable')
  const id = createId()
  const now = Date.now()
  const record: ControlledEntryContextRecord<T> = {
    id,
    namespace,
    scope,
    target,
    context: JSON.parse(text),
    createdAt: now,
    // Navigation state is deliberately short-lived even when a caller requests a larger TTL.
    expiresAt: now + Math.min(MAX_TTL_MS, Math.max(1000, options.ttlMs ?? DEFAULT_TTL_MS)),
  }
  storage.setItem(storageKey(id), JSON.stringify(record))
  return id
}

const readRecord = <T>(id: string): ControlledEntryContextRecord<T> | undefined => {
  const storage = getStorage()
  const normalizedId = normalizeEntryId(id)
  if (!storage || !normalizedId) return undefined
  const key = storageKey(normalizedId)
  try {
    const record = JSON.parse(storage.getItem(key) || '{}') as ControlledEntryContextRecord<T>
    if (record.id !== normalizedId
      || !record.namespace
      || !record.scope
      || !record.target
      || !Number.isFinite(record.createdAt)
      || !Number.isFinite(record.expiresAt)
      || record.expiresAt <= Date.now()
      || record.expiresAt - record.createdAt > MAX_TTL_MS) {
      storage.removeItem(key)
      return undefined
    }
    return record
  } catch {
    storage.removeItem(key)
    return undefined
  }
}

export const readControlledEntryContext = <T>(
  id: string,
  expected: { namespace: string; scope: string; target: string },
) => {
  const record = readRecord<T>(id)
  if (!record) return undefined
  return record.namespace === normalizeText(expected.namespace)
    && record.scope === normalizeText(expected.scope)
    && record.target === normalizeText(expected.target)
    ? record
    : undefined
}

export const consumeControlledEntryContext = <T>(
  id: string,
  expected: { namespace: string; scope: string; target: string },
) => {
  const record = readControlledEntryContext<T>(id, expected)
  if (!record) return undefined
  getStorage()?.removeItem(storageKey(record.id))
  return record
}

export const clearControlledEntryContext = (id: string) => {
  const normalizedId = normalizeEntryId(id)
  if (normalizedId) getStorage()?.removeItem(storageKey(normalizedId))
}
