export type ParameterValueRecord = Record<string, any>

export function asRecord(value: unknown): ParameterValueRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ParameterValueRecord
    : undefined
}

export function hasOwn(source: ParameterValueRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(source, key)
}

export function readPath(source: unknown, path: string) {
  const record = asRecord(source)
  if (!record || !path) return undefined
  const resolved = resolvePath(record, path)
  return resolved.found ? resolved.value : undefined
}

export function hasPath(source: unknown, path: string) {
  const record = asRecord(source)
  return !!record && !!path && resolvePath(record, path).found
}

export function writePath(source: ParameterValueRecord, path: string, value: unknown) {
  const segments = path.split('.').filter(Boolean)
  if (!segments.length) return
  if (hasOwn(source, path) || !hasOwn(source, segments[0])) {
    source[path] = value
    return
  }

  let current = source
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    const next = current[segment]
    if (next !== undefined && !asRecord(next)) {
      source[path] = value
      return
    }
    if (!next) current[segment] = {}
    current = current[segment]
  }
  current[segments[segments.length - 1]] = value
}

export function removePath(source: ParameterValueRecord, path: string) {
  let removed = false
  if (hasOwn(source, path)) {
    delete source[path]
    removed = true
  }
  const segments = path.split('.').filter(Boolean)
  if (!segments.length) return
  const parents: Array<{ record: ParameterValueRecord; key: string }> = []
  let current: unknown = source
  for (const segment of segments) {
    const record = asRecord(current)
    if (!record || !hasOwn(record, segment)) return removed
    parents.push({ record, key: segment })
    current = record[segment]
  }
  const leaf = parents.pop()
  if (!leaf) return removed
  delete leaf.record[leaf.key]
  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const parent = parents[index]
    const child = asRecord(parent.record[parent.key])
    if (child && !Object.keys(child).length) delete parent.record[parent.key]
  }
}

function resolvePath(source: ParameterValueRecord, path: string) {
  if (hasOwn(source, path)) return { found: true, value: source[path] }
  const segments = path.split('.').filter(Boolean)
  let current: unknown = source
  for (const segment of segments) {
    const record = asRecord(current)
    if (!record || !hasOwn(record, segment)) return { found: false, value: undefined }
    current = record[segment]
  }
  return { found: true, value: current }
}
