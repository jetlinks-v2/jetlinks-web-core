/** Store 的组织、角色是 unknown[]，展示前只接受带名称的条目。 */
export const dimensionNames = (items: unknown[] | undefined, prefixes?: ReadonlyMap<string, string>): string[] => {
  return (Array.isArray(items) ? items : []).flatMap(item => {
    if (!item || typeof item !== 'object' || !('name' in item)) return []
    if (typeof item.name !== 'string' || !item.name.trim()) return []
    const prefix = 'id' in item && typeof item.id === 'string' ? prefixes?.get(item.id) : undefined
    return [prefix ? `${prefix}-${item.name.trim()}` : item.name.trim()]
  })
}
