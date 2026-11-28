import type { ObjectPresentation } from '../types/object-presentation'
import type { ObjectMemberRef } from './types'
import { objectMemberPresentations, objectSectionPresentations } from './sections'

/** One projection for every host; collisions never depend on module loading order. */
export function objectPresentationRegistry(entries: ObjectPresentation[]): Map<string, ObjectPresentation> {
  const result = new Map<string, ObjectPresentation>()
  for (const typeId of new Set(entries.map(entry => entry.typeId))) {
    const owners = entries.filter(entry => entry.typeId === typeId)
    const unique = <T>(values: T[], key: string): T | undefined => {
      if (values.length > 1) console.warn('Conflicting object presentation registrations; using the generic view', { type: typeId, key })
      return values.length === 1 ? values[0] : undefined
    }
    const fields = owners.flatMap(entry => entry.fields)
    const queries = owners.flatMap(entry => Object.entries(entry.queries || {}))
    const entry: ObjectPresentation = {
      typeId,
      fields: [...new Set(fields.map(field => field.key))].flatMap(key => {
        const field = unique(fields.filter(field => field.key === key), `field:${key}`)
        return field ? [field] : []
      }),
      queries: Object.fromEntries([...new Set(queries.map(([key]) => key))].flatMap(key => {
        const query = unique(queries.filter(([id]) => id === key).map(([, value]) => value), `query:${key}`)
        return query ? [[key, query]] : []
      })),
      members: objectMemberPresentations(typeId, entries),
      sections: objectSectionPresentations(typeId, entries),
      directorySubtitle: unique(owners.flatMap(entry => entry.directorySubtitle ? [entry.directorySubtitle] : []), 'directorySubtitle'),
      directory: unique(owners.flatMap(entry => entry.directory ? [entry.directory] : []), 'directory'),
      detail: unique(owners.flatMap(entry => entry.detail ? [entry.detail] : []), 'detail'),
      record: unique(owners.flatMap(entry => entry.record ? [entry.record] : []), 'record'),
      open: unique(owners.flatMap(entry => entry.open ? [entry.open] : []), 'open'),
      lineage: owners.some(entry => entry.lineage)
    }
    result.set(typeId, entry)
  }
  return result
}

export function objectPresentation(type: string | undefined, registry: Map<string, ObjectPresentation>) {
  return registry.get(type || '') || registry.get('*')
}

export function objectMemberPresentation(member: ObjectMemberRef, registry: Map<string, ObjectPresentation>) {
  return objectPresentation(member.type, registry)?.members?.find(item =>
    item.ref.providerId === member.providerId && item.ref.kind === member.kind && item.ref.id === member.id)
}
