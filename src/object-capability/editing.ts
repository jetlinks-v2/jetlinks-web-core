import { createMetadataForm, type FormMetadataBinding } from '../components/Form/metadata'
import type { FormValues } from '../components/Form/types'
import type { ObjectMember, ObjectPropertyMetadata, PropertyEditMapping } from './types'

/** Only a declared action on the same object can receive an edit; names and matching semantic IDs are insufficient. */
export function objectPropertyEdit(member: ObjectMember, members: ObjectMember[]): PropertyEditMapping | undefined {
  if (member.ref.kind !== 'property') return
  const edit = (member.metadata as ObjectPropertyMetadata).expands?.edit
  if (!edit || !Array.isArray(edit.inputPath) || !edit.inputPath.length ||
    edit.inputPath.some(part => typeof part !== 'string' || !part || ['__proto__', 'constructor', 'prototype'].includes(part))) return
  return members.some(action => action.ref.type === member.ref.type && action.ref.providerId === edit.providerId &&
    action.ref.kind === 'action' && action.ref.id === edit.command) ? edit : undefined
}

/** Preserve independent original commands: callers acknowledge each successful patch before attempting the next. */
export function objectEditRequests(bindings: Array<FormMetadataBinding & { edit: PropertyEditMapping }>, values: FormValues, changes: FormValues) {
  const groups = new Map<string, typeof bindings>()
  for (const binding of bindings) {
    if (!Object.hasOwn(changes, binding.key)) continue
    const key = JSON.stringify([binding.edit.providerId, binding.edit.command])
    groups.set(key, [...(groups.get(key) || []), binding])
  }
  return [...groups.values()].map(items => {
    const form = createMetadataForm(items.map(item => ({ ...item, path: [item.key] })), values, {
        access: Object.fromEntries(items.map(item => [item.key, 'write' as const])), message: issue => issue
      })
    const patch = form.toPatch(changes), input: FormValues = {}
    for (const item of items) {
      if (!Object.hasOwn(patch, item.key)) continue
      let parent = input
      for (const part of item.edit.inputPath.slice(0, -1)) {
        if (!Object.hasOwn(parent, part)) Object.defineProperty(parent, part, { value: {}, enumerable: true })
        const next = parent[part]
        if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Overlapping edit paths')
        parent = next as FormValues
      }
      const last = item.edit.inputPath.at(-1)!
      if (Object.hasOwn(parent, last)) throw new Error('Duplicate edit paths')
      Object.defineProperty(parent, last, { value: patch[item.key], enumerable: true })
    }
    return { providerId: items[0].edit.providerId, command: items[0].edit.command,
      keys: Object.keys(patch), input }
  })
}
