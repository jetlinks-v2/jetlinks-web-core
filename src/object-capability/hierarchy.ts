export interface ObjectHierarchy {
  parentProperty: string
  sortProperty: string
}

/** Parent fields are a source contract, never inferred from a type name or an arbitrary parentId. */
export function objectHierarchy(expands?: Record<string, unknown>): ObjectHierarchy | undefined {
  const value = expands?.hierarchy as Partial<ObjectHierarchy> | undefined
  if (!value || typeof value.parentProperty !== 'string' || !value.parentProperty.trim() ||
    typeof value.sortProperty !== 'string' || !value.sortProperty.trim()) return
  return { parentProperty: value.parentProperty, sortProperty: value.sortProperty }
}
