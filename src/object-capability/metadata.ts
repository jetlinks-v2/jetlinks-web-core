import type { CapabilitySchema } from '../data-capability/types'
import type { ObjectMember, ObjectMemberRef, ObjectProviderModel, ObjectValueType } from './types'

/** Keep the original model alongside this execution-only conversion. */
export function objectValueSchema(type?: ObjectValueType): CapabilitySchema | undefined {
  if (!type) return undefined
  const base = { description: typeof type.description === 'string' ? type.description : undefined }
  switch (type.type) {
    case 'int': case 'long': return { ...base, type: 'integer' }
    case 'float': case 'double': case 'number': return { ...base, type: 'number' }
    case 'boolean': return { ...base, type: 'boolean' }
    case 'object': return { ...base, type: 'object', properties: Object.fromEntries((type.properties || []).flatMap(p => {
      const schema = objectValueSchema(p.valueType)
      return schema ? [[p.id, schema]] : []
    })) }
    case 'array': return { ...base, type: 'array', items: objectValueSchema(type.elementType) }
    case 'enum': {
      const values = type.elements?.map(item => item.value) || []
      const kinds = new Set(values.map(value => typeof value))
      const kind = kinds.size === 1 ? [...kinds][0] : undefined
      return kind === 'number' || kind === 'boolean' || kind === 'string' ? { ...base, type: kind, enum: values } : undefined
    }
    case 'string': case 'text': case 'password': return { ...base, type: 'string' }
    default: return undefined
  }
}

export function objectMembers(type: string, providers: ObjectProviderModel[]): ObjectMember[] {
  return providers.flatMap(provider => [
    ...(provider.metadata.properties || []).map(metadata => ({
      ref: { type, providerId: provider.providerId, kind: 'property' as const, id: metadata.id },
      name: metadata.name || metadata.id, description: metadata.description, sourceName: provider.name,
      metadata, schema: objectValueSchema(metadata.valueType),
    })),
    ...(provider.metadata.functions || []).flatMap(metadata => {
      const kind = metadata.expands?.functionKind
      return kind !== 'query' && kind !== 'action' ? [] : [{
        ref: { type, providerId: provider.providerId, kind, id: metadata.id },
        name: metadata.name || metadata.id, description: metadata.description, sourceName: provider.name,
        metadata, schema: objectValueSchema(metadata.output),
      } satisfies ObjectMember]
    }),
  ])
}

/** Reversible identifiers preserve Unicode and punctuation without display-name matching. */
export function objectCapabilityId(ref: ObjectMemberRef): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ type: ref.type, providerId: ref.providerId, kind: ref.kind, id: ref.id }))
  const key = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  return `object.${ref.kind === 'action' ? 'action' : 'read'}.${key}`
}
export function parseObjectCapabilityId(id: string): ObjectMemberRef {
  const key = id.split('.').slice(2).join('.').replaceAll('-', '+').replaceAll('_', '/')
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(key), char => char.charCodeAt(0)))) as ObjectMemberRef
}
export function sameObjectMember(a: ObjectMemberRef, b: ObjectMemberRef): boolean {
  return a.type === b.type && a.providerId === b.providerId && a.kind === b.kind && a.id === b.id
}
