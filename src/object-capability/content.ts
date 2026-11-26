import type { ObjectMember, ObjectPropertyMetadata } from './types'
import { propertyReference } from './references'

export const objectContentGroups = ['data', 'status', 'references', 'observations', 'related', 'actions'] as const
export type ObjectContentGroupKind = (typeof objectContentGroups)[number]
export type ObjectContentLabels = Pick<Record<ObjectContentGroupKind, string>, 'data' | 'actions'> &
  Partial<Record<ObjectContentGroupKind, string>>

/**
 * Consume declared meaning, not field names, provider IDs, numeric types or units.
 * A status inside a reading source is still a status; a product reference remains a reference.
 */
export function objectMemberContentGroup(member?: ObjectMember): ObjectContentGroupKind {
  if (member?.ref.kind === 'action') return 'actions'
  if (member?.ref.kind === 'query') return 'related'
  if (!member) return 'data'
  if (propertyReference(member)) return 'references'
  const metadata = member.metadata as ObjectPropertyMetadata
  const role = metadata.expands?.semanticRole
  if (role === 'status') return 'status'
  if (
    role === 'result' ||
    role === 'value' ||
    metadata.expands?.semanticTypes?.includes('observation') ||
    member.sourceSemanticTypes?.includes('observation')
  )
    return 'observations'
  return 'data'
}
