type BindingPathToken =
  | { kind: 'property'; key: string }
  | { kind: 'all' }
  | { kind: 'equals'; key: string; value: string }

const PROPERTY_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*/
const FILTER_PATTERN = /^\[\?\(@\.([A-Za-z_][A-Za-z0-9_-]*)==(['"])([^'"]*)\2\)\]/

const parseBindingPath = (path: string): BindingPathToken[] | undefined => {
  if (path === '$') return []
  if (!path.startsWith('$')) return undefined
  const tokens: BindingPathToken[] = []
  let offset = 1
  while (offset < path.length) {
    const tail = path.slice(offset)
    if (tail.startsWith('[*]')) {
      tokens.push({ kind: 'all' })
      offset += 3
      continue
    }
    const filter = tail.match(FILTER_PATTERN)
    if (filter) {
      tokens.push({ kind: 'equals', key: filter[1], value: filter[3] })
      offset += filter[0].length
      continue
    }
    if (!tail.startsWith('.')) return undefined
    const property = tail.slice(1).match(PROPERTY_PATTERN)
    if (!property) return undefined
    tokens.push({ kind: 'property', key: property[0] })
    offset += property[0].length + 1
  }
  return tokens
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

export const isSupportedAiClientToolBindingPath = (path: unknown) => (
  parseBindingPath(String(path || '').trim()) !== undefined
)

/** Resolves the bounded JSONPath subset accepted by inline output-binding declarations. */
export const resolveAiClientToolBindingPath = (root: unknown, path: unknown) => {
  const tokens = parseBindingPath(String(path || '').trim())
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
