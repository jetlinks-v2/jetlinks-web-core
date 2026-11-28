import type { ObjectPresentation, ObjectSectionPresentation, ObjectSectionRelation } from '../types/object-presentation'
import type { ObjectMember, ObjectMemberPresentation } from './types'

/** Equal-specificity collisions fall back to the generic view, regardless of module loading order. */
function uniqueByScope<T>(type: string | undefined, presentations: ObjectPresentation[], items: (entry: ObjectPresentation) => T[], key: (item: T) => string): T[] {
  const result = new Map<string, T>()
  for (const scope of new Set(['*', type].filter((value): value is string => !!value))) {
    const candidates = new Map<string, T[]>()
    for (const entry of presentations.filter(entry => entry.typeId === scope))
      for (const item of items(entry)) candidates.set(key(item), [...(candidates.get(key(item)) || []), item])
    for (const [id, values] of candidates) {
      result.delete(id)
      if (values.length === 1) result.set(id, values[0])
      else console.warn('Conflicting object presentation registrations; using the generic view', { type: scope, key: id })
    }
  }
  return [...result.values()]
}
export function objectSectionPresentations(type: string | undefined, entries: ObjectPresentation[]): ObjectSectionPresentation[] {
  return uniqueByScope(type, entries, entry => entry.sections || [], section => section.id)
}
export function objectMemberPresentations(type: string | undefined, entries: ObjectPresentation[]): ObjectMemberPresentation[] {
  return uniqueByScope(type, entries, entry => entry.members || [], member => JSON.stringify([member.ref.providerId, member.ref.kind, member.ref.id]))
}
export function objectMemberSection(member: ObjectMember, sections: ObjectSectionPresentation[]): ObjectSectionPresentation | undefined {
  const matches = sections.flatMap(section => {
    const bindings = section.members?.filter(ref => ref.providerId === member.ref.providerId && ref.kind === member.ref.kind && (ref.id === undefined || ref.id === member.ref.id)) || []
    return bindings.length ? [{ section, precision: bindings.some(ref => ref.id !== undefined) ? 1 : 0 }] : []
  })
  const precise = matches.filter(match => match.precision === Math.max(...matches.map(match => match.precision)))
  return precise.length === 1 ? precise[0].section : undefined
}
export function sameSectionRelation(a: ObjectSectionRelation, b: ObjectSectionRelation): boolean {
  return a.objectType === b.objectType && a.id === b.id && a.targetType === b.targetType && a.reverse === b.reverse
}
