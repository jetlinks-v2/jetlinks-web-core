import type { ObjectMember, ObjectPropertyMetadata, ObjectReferenceValue, PropertyReferenceMapping } from './types'

/** Only explicit metadata denotes a reference; field names and modelId never imply one. */
export function propertyReference(member: ObjectMember): PropertyReferenceMapping | undefined {
  if (member.ref.kind !== 'property') return undefined
  const mapping = (member.metadata as ObjectPropertyMetadata).expands?.reference
  return mapping && typeof mapping.targetType === 'string' && mapping.targetType ? mapping : undefined
}

/** Default reading surfaces omit current identity and explicit companion labels, not arbitrary *Id fields. */
export function defaultObjectMembers(members: ObjectMember[]): ObjectMember[] {
  const labels = new Set(
    members.flatMap((member) => {
      const mapping = propertyReference(member)
      return mapping?.labelProperty
        ? [JSON.stringify([member.ref.type, member.ref.providerId, mapping.labelProperty])]
        : []
    })
  )
  return members.filter(
    (member) =>
      member.ref.kind !== 'property' ||
      (!(member.identitySource && (member.metadata as ObjectPropertyMetadata).expands?.semanticRole === 'identity') &&
        !labels.has(JSON.stringify([member.ref.type, member.ref.providerId, member.ref.id])))
  )
}

/** Read names in the same source batch; they are authorized snapshots, not proof of target availability. */
export function referencePropertyKeys(member: ObjectMember): string[] {
  const label = propertyReference(member)?.labelProperty
  return label ? [member.ref.id, label] : [member.ref.id]
}

export function referenceValue(
  member: ObjectMember,
  value: unknown,
  properties: ReadonlyMap<string, unknown>
): ObjectReferenceValue | undefined {
  const mapping = propertyReference(member)
  if (!mapping) return undefined
  const raw = value == null || value === '' ? [] : Array.isArray(value) ? value : [value]
  const rows = raw.slice(0, 20)
  // Unsupported shapes remain with the ordinary type renderer; never turn malformed values into an empty relation.
  if (rows.some((id) => typeof id !== 'string' && typeof id !== 'number')) return undefined
  const labels = mapping.labelProperty ? properties.get(mapping.labelProperty) : undefined
  const items = rows.map((id, index) => {
    const label = Array.isArray(labels) ? labels[index] : raw.length === 1 ? labels : undefined
    return { type: mapping.targetType, id: String(id), name: typeof label === 'string' && label ? label : undefined }
  })
  return { items: [...new Map(items.map((item) => [item.id, item])).values()], limited: raw.length > rows.length }
}

/** Request-local, bounded lookup. The caller supplies its existing authenticated request and cancellation lifetime. */
export async function resolveReferenceNames(
  values: ObjectReferenceValue[],
  lookup: (type: string, ids: string[]) => Promise<Array<{ id: string; name?: string }>>
): Promise<ObjectReferenceValue[]> {
  const groups = new Map<string, Set<string>>()
  for (const value of values)
    for (const item of value.items) {
      if (item.name) continue
      if (!groups.has(item.type)) groups.set(item.type, new Set())
      groups.get(item.type)!.add(item.id)
    }
  const found = new Map<string, ObjectReferenceValue['items'][number]>()
  const key = (type: string, id: string) => JSON.stringify([type, id])
  await Promise.all(
    [...groups].map(async ([type, ids]) => {
      const requested = [...ids]
      for (let start = 0; start < requested.length; start += 128) {
        const batch = requested.slice(start, start + 128)
        try {
          for (const row of await lookup(type, batch)) found.set(key(type, row.id), { type, ...row })
        } catch {
          // Source values remain readable; a failed name lookup is shown as an unavailable reference, not no association.
          for (const id of batch) found.set(key(type, id), { type, id, unavailable: true })
        }
      }
    })
  )
  return values.map((value) => ({
    ...value,
    items: value.items.map((item) =>
      item.name
        ? item
        : {
            ...item,
            ...found.get(key(item.type, item.id)),
            unavailable: found.get(key(item.type, item.id))?.unavailable ?? !found.has(key(item.type, item.id))
          }
    )
  }))
}
