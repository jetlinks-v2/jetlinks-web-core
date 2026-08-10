import type { AiClientToolFieldSemanticRole } from './clientToolResult'

type JsonRecord = Record<string, unknown>
type SemanticRole = AiClientToolFieldSemanticRole

export interface AiClientToolSemanticField {
  path: string
  role: SemanticRole
  label?: string
  format?: string
  measure?: string
  unit?: string
  aggregation?: string
}

interface TimestampProfile {
  role: 'timestamp'
  count: number
  invalidCount: number
  min?: number
  max?: number
}

interface NumberProfile {
  role: 'number' | 'longitude' | 'latitude' | 'duration'
  count: number
  invalidCount: number
  min?: number
  max?: number
}

interface CategoryProfile {
  role: 'category' | 'label' | 'identifier' | 'state'
  count: number
  nullCount: number
  values: Set<string>
  valuesTruncated: boolean
}

interface OpaqueProfile {
  role: 'geo_point'
  count: number
  nullCount: number
}

type MutableFieldProfile = TimestampProfile | NumberProfile | CategoryProfile | OpaqueProfile

const MAX_SEMANTIC_FIELDS = 32
const MAX_CATEGORY_VALUES = 20

const isRecord = (value: unknown): value is JsonRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const isCategoryProfile = (profile: MutableFieldProfile): profile is CategoryProfile => (
  profile.role === 'category' || profile.role === 'label' || profile.role === 'identifier' || profile.role === 'state'
)

const isOpaqueProfile = (profile: MutableFieldProfile): profile is OpaqueProfile => profile.role === 'geo_point'

const normalizeSemanticRole = (value: unknown): SemanticRole | undefined => {
  const role = String(value || '').trim().toLowerCase()
  return [
    'timestamp', 'number', 'category', 'label', 'longitude', 'latitude', 'geo_point', 'identifier', 'state', 'duration',
  ].includes(role) ? role as SemanticRole : undefined
}

/** Reads only bounded, explicitly declared field semantics from a producer-owned JSON schema. */
export const collectAiClientToolSemanticFields = (
  schema: JsonRecord,
  prefix = '',
  result: AiClientToolSemanticField[] = [],
): AiClientToolSemanticField[] => {
  if (result.length >= MAX_SEMANTIC_FIELDS) return result
  const properties = isRecord(schema.properties) ? schema.properties : {}
  Object.entries(properties).some(([name, value]) => {
    if (result.length >= MAX_SEMANTIC_FIELDS || !isRecord(value)) return result.length >= MAX_SEMANTIC_FIELDS
    const path = prefix ? `${prefix}.${name}` : name
    const role = normalizeSemanticRole(value['x-ai-role'] ?? value.semanticRole)
      || (value.format === 'date-time' ? 'timestamp' : undefined)
    if (role) result.push({
      path,
      role,
      ...(value.label ? { label: String(value.label) } : {}),
      ...(value.format ? { format: String(value.format) } : {}),
      ...(value['x-ai-measure'] ? { measure: String(value['x-ai-measure']) } : {}),
      ...(value['x-ai-unit'] ? { unit: String(value['x-ai-unit']) } : {}),
      ...(value['x-ai-aggregation'] ? { aggregation: String(value['x-ai-aggregation']) } : {}),
    })
    if (value.type === 'object' || isRecord(value.properties)) {
      collectAiClientToolSemanticFields(value, path, result)
    }
    return result.length >= MAX_SEMANTIC_FIELDS
  })
  return result
}

const valueAtPath = (row: unknown, path: string) => {
  let current = row
  for (const segment of path.split('.')) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) return undefined
    current = current[segment]
  }
  return current
}

const timestampValue = (value: unknown) => {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || !value.trim()) return undefined
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : undefined
}

const numericValue = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || !value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const createFieldProfile = (role: SemanticRole): MutableFieldProfile => {
  if (role === 'category' || role === 'label' || role === 'identifier' || role === 'state') {
    return { role, count: 0, nullCount: 0, values: new Set(), valuesTruncated: false }
  }
  if (role === 'geo_point') return { role, count: 0, nullCount: 0 }
  return { role, count: 0, invalidCount: 0 }
}

/** Collects bounded facts without inferring field meaning from names or record values. */
export const createAiClientToolRecordFactCollector = (schema: JsonRecord) => {
  const fields = collectAiClientToolSemanticFields(schema)
  const profiles = new Map(fields.map(field => [field.path, createFieldProfile(field.role)]))

  const accept = (row: unknown) => {
    fields.forEach((field) => {
      const profile = profiles.get(field.path)!
      const value = valueAtPath(row, field.path)
      if (isOpaqueProfile(profile)) {
        profile.count += 1
        if (value === null || value === undefined || value === '') profile.nullCount += 1
        return
      }
      if (isCategoryProfile(profile)) {
        profile.count += 1
        if (value === null || value === undefined || value === '') {
          profile.nullCount += 1
          return
        }
        if (profile.values.size < MAX_CATEGORY_VALUES) profile.values.add(String(value))
        else if (!profile.values.has(String(value))) profile.valuesTruncated = true
        return
      }
      const normalized = profile.role === 'timestamp' ? timestampValue(value) : numericValue(value)
      if (normalized === undefined) {
        profile.invalidCount += 1
        return
      }
      profile.count += 1
      profile.min = profile.min === undefined ? normalized : Math.min(profile.min, normalized)
      profile.max = profile.max === undefined ? normalized : Math.max(profile.max, normalized)
    })
  }

  const snapshot = () => {
    const fieldFacts: JsonRecord = {}
    let observedStart: number | undefined
    let observedEnd: number | undefined
    profiles.forEach((profile, path) => {
      if (isOpaqueProfile(profile)) {
        fieldFacts[path] = { role: profile.role, count: profile.count, nullCount: profile.nullCount }
        return
      }
      if (isCategoryProfile(profile)) {
        fieldFacts[path] = {
          role: profile.role,
          count: profile.count,
          nullCount: profile.nullCount,
          values: Array.from(profile.values),
          valuesTruncated: profile.valuesTruncated,
        }
        return
      }
      fieldFacts[path] = {
        role: profile.role,
        count: profile.count,
        invalidCount: profile.invalidCount,
        ...(profile.min === undefined ? {} : { min: profile.min }),
        ...(profile.max === undefined ? {} : { max: profile.max }),
      }
      if (profile.role === 'timestamp' && profile.min !== undefined && profile.max !== undefined) {
        observedStart = observedStart === undefined ? profile.min : Math.min(observedStart, profile.min)
        observedEnd = observedEnd === undefined ? profile.max : Math.max(observedEnd, profile.max)
      }
    })
    return {
      observedRange: observedStart === undefined || observedEnd === undefined
        ? undefined
        : { start: observedStart, end: observedEnd },
      facts: Object.keys(fieldFacts).length ? { fields: fieldFacts } : undefined,
    }
  }

  return { accept, snapshot }
}
