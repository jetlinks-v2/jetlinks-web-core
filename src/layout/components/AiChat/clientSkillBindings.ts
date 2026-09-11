/** Opaque reference to one server-known Skill binding available in the current client scope. */
export interface ClientSkillBindingRef {
  bindingId: string
}

export type ClientSkillBindingContribution = readonly ClientSkillBindingRef[]

/**
 * Preserves provider order while removing blank and repeated binding ids.
 * Skill content and execution authority remain server-owned and cannot cross this contract.
 */
export const normalizeClientSkillBindingContribution = (
  bindings: readonly ClientSkillBindingRef[] = [],
): ClientSkillBindingRef[] => {
  const seen = new Set<string>()
  return bindings.flatMap((binding) => {
    const bindingId = String(binding?.bindingId || '').trim()
    if (!bindingId || seen.has(bindingId)) return []
    seen.add(bindingId)
    return [{ bindingId }]
  })
}
