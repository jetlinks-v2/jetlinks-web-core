import type { ObjectDataAccess, ObjectMember, ObjectPropertyMetadata } from './types'

/** Capability references come from the source model, never from a field name, unit or business type. */
export function objectDataAccess(member?: ObjectMember): ObjectDataAccess | undefined {
  if (member?.ref.kind !== 'property') return
  const raw = (member.metadata as ObjectPropertyMetadata).expands?.dataAccess as Partial<ObjectDataAccess> | undefined
  if (!raw || !Number.isInteger(raw.pageSize) || raw.pageSize! <= 0 ||
    !(typeof raw.history === 'string' && raw.history || typeof raw.aggregate === 'string' && raw.aggregate)) return
  const operations = Array.isArray(raw.operations) ? raw.operations.filter(value =>
    typeof value?.id === 'string' && !!value.id && typeof value.name === 'string' && !!value.name) : []
  return { history: raw.history, aggregate: raw.aggregate, operations, pageSize: raw.pageSize! }
}

export function objectDataAnalyses(members: ObjectMember[]) {
  return members.filter(member => objectDataAnalysis(member))
}

export function objectDataAnalysis(member?: ObjectMember): { kind: 'aggregate'; from: string; to: string; interval: string; pageSize: number; objectTypes: string[] } | undefined {
  if (member?.ref.kind !== 'query') return
  const value = member.metadata.expands?.dataAnalysis as Record<string, unknown> | undefined
  if (value?.kind !== 'aggregate' || !['from', 'to', 'interval'].every(key => typeof value[key] === 'string') ||
    !Number.isInteger(value.pageSize) || Number(value.pageSize) <= 1) return
  const inputs = new Set(('inputs' in member.metadata ? member.metadata.inputs : [])?.map(input => input.id))
  if (![value.from, value.to, value.interval].every(key => inputs.has(String(key)))) return
  return { kind: 'aggregate', from: String(value.from), to: String(value.to), interval: String(value.interval), pageSize: Number(value.pageSize),
    objectTypes: Array.isArray(value.objectTypes) ? value.objectTypes.filter((value): value is string => typeof value === 'string') : [] }
}
