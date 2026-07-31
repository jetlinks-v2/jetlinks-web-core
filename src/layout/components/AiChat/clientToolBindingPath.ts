type BindingPathToken =
  | { kind: 'property'; key: string }
  | { kind: 'all' }
  | { kind: 'equals'; key: string; value: string }

const PROPERTY_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*/
const RECORD_PATH_PROPERTY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const FILTER_PATTERN = /^\[\?\(@\.([A-Za-z_][A-Za-z0-9_-]*)==(['"])([^'"]*)\2\)\]/
const MAX_BINDING_PATH_LENGTH = 512
const MAX_BINDING_PATH_TOKENS = 32

const parseBindingPath = (path: string): BindingPathToken[] | undefined => {
  if (path.length > MAX_BINDING_PATH_LENGTH) return undefined
  if (path === '$') return []
  if (!path.startsWith('$')) return undefined
  const tokens: BindingPathToken[] = []
  let offset = 1
  while (offset < path.length) {
    const tail = path.slice(offset)
    if (tail.startsWith('[*]')) {
      tokens.push({ kind: 'all' })
      offset += 3
      if (tokens.length > MAX_BINDING_PATH_TOKENS) return undefined
      continue
    }
    const filter = tail.match(FILTER_PATTERN)
    if (filter) {
      tokens.push({ kind: 'equals', key: filter[1], value: filter[3] })
      offset += filter[0].length
      if (tokens.length > MAX_BINDING_PATH_TOKENS) return undefined
      continue
    }
    if (!tail.startsWith('.')) return undefined
    const property = tail.slice(1).match(PROPERTY_PATTERN)
    if (!property) return undefined
    tokens.push({ kind: 'property', key: property[0] })
    offset += property[0].length + 1
    if (tokens.length > MAX_BINDING_PATH_TOKENS) return undefined
  }
  return tokens
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

export const normalizeAiClientToolBindingPath = (path: unknown) => {
  const normalized = String(path || '').trim()
  return parseBindingPath(normalized) === undefined ? undefined : normalized
}

export const isSupportedAiClientToolBindingPath = (path: unknown) => (
  normalizeAiClientToolBindingPath(path) !== undefined
)

/** Canonical intersection of output-binding paths and the JSON query tool's safe read grammar. */
export const normalizeAiClientToolRecordPath = (path: unknown) => {
  const normalized = normalizeAiClientToolBindingPath(path)
  if (normalized === undefined) return undefined
  const tokens = parseBindingPath(normalized)
  return tokens?.every(token => token.kind === 'all'
    || (token.kind === 'property' && RECORD_PATH_PROPERTY_PATTERN.test(token.key)))
    ? normalized
    : undefined
}

/** Resolves the bounded JSONPath subset accepted by inline output-binding declarations. */
export const resolveAiClientToolBindingPath = (root: unknown, path: unknown) => {
  const normalized = normalizeAiClientToolBindingPath(path)
  const tokens = normalized === undefined ? undefined : parseBindingPath(normalized)
  if (!tokens) return { resolved: false, values: [] as unknown[] }
  let values: unknown[] = [root]
  for (const token of tokens) {
    if (token.kind === 'property') {
      values = values.flatMap((value) => {
        if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, token.key)) return []
        const resolved = value[token.key]
        return resolved === undefined || resolved === null ? [] : [resolved]
      })
    } else if (token.kind === 'all') {
      values = values.flatMap(value => Array.isArray(value) ? value : [])
    } else {
      values = values.flatMap(value => Array.isArray(value)
        ? value.filter(item => isRecord(item) && String(item[token.key] ?? '') === token.value)
        : [])
    }
    if (!values.length) break
  }
  return { resolved: values.length > 0, values }
}
