import type { MenuItem } from '../types/module'
import { applyMenuRouteTargets } from '../store/menuRouteTarget'

const clone = (menus: MenuItem[]): MenuItem[] => menus.map(item => ({ ...item, options: item.options && { ...item.options }, children: item.children && clone(item.children) }))
const ownerOf = (item: MenuItem, inherited = '') => item.owner || inherited
const identity = (owner: string, code: string) => JSON.stringify([owner, code])
type Entry = { item: MenuItem; owner: string }
function entries(menus: MenuItem[], owner = ''): Entry[] {
  return menus.flatMap(item => [{ item, owner: ownerOf(item, owner) }, ...entries(item.children || [], ownerOf(item, owner))])
}

/** Catalog composition never crosses owner boundaries; installed groups share one stable code/ID. */
export function mergeModuleMenuCatalog(catalog: MenuItem[], inheritedOwner = ''): MenuItem[] {
  const merged: MenuItem[] = []
  for (const source of clone(catalog)) {
    const owner = ownerOf(source, inheritedOwner)
    const existing = merged.find(item => item.code === source.code && ownerOf(item, inheritedOwner) === owner)
    if (existing && (existing.children?.length || source.children?.length)) {
      existing.children = mergeModuleMenuCatalog([...(existing.children || []), ...(source.children || [])], owner)
    } else if (!existing) merged.push(source)
  }
  return merged
}

export type ModuleMenuLayoutIssue = { sourceCode: string; target: string; type: 'id-collision' | 'missing-target' | 'circular-target' }

/**
 * Reconcile only backend-authorized nodes with installed declarations. Catalog leaves and permissions
 * never enter this tree; a missing target may contribute only a declared, permission-free parent shell.
 */
export function reconcileAuthorizedMenuLayout(authorized: MenuItem[], catalog: MenuItem[]): { menus: MenuItem[]; issues: ModuleMenuLayoutIssue[] } {
  const menus = clone(authorized)
  const declarations = entries(mergeModuleMenuCatalog(catalog))
  const current = entries(menus)
  const declared = new Map(declarations.map(entry => [identity(entry.owner, entry.item.code), entry.item]))
  const available = new Map(current.map(entry => [identity(entry.owner, entry.item.code), entry.item]))
  const issues: ModuleMenuLayoutIssue[] = []
  for (const entry of current) {
    const declaration = declared.get(identity(entry.owner, entry.item.code))
    if (!declaration) continue
    // Only known previous defaults are renamed; tenant-authored group titles remain intact.
    const previousNames = declaration.options?.previousNames
    if (entry.item.children?.length && Array.isArray(previousNames) && previousNames.includes(entry.item.name)) {
      entry.item.name = declaration.name
      entry.item.i18nName = declaration.i18nName
      if ('i18nMessages' in declaration) Object.assign(entry.item, { i18nMessages: declaration.i18nMessages })
    }
    // Upgrade declared former defaults without replacing administrator-selected icons.
    const previousIcons = declaration.options?.previousIcons
    if (declaration.icon && Array.isArray(previousIcons) && previousIcons.includes(entry.item.icon)) {
      entry.item.icon = declaration.icon
    }
    const targetCode = declaration.options?.routeTarget
    if (typeof targetCode !== 'string' || !targetCode || entry.item.children?.length) continue
    const targetKey = identity(entry.owner, targetCode)
    let target = available.get(targetKey)
    if (!target) {
      const seed = declared.get(targetKey)
      if (!seed?.children?.length || seed.code === entry.item.code) continue
      if (seed.id && [...available.values()].some(candidate => candidate.id === seed.id)) {
        issues.push({ sourceCode: entry.item.code, target: targetCode, type: 'id-collision' })
        continue
      }
      target = {
        id: seed.id, code: seed.code, name: seed.name, i18nName: seed.i18nName,
        url: seed.url, icon: seed.icon, sortIndex: seed.sortIndex, owner: entry.owner,
        buttons: [], children: [],
      }
      if ('i18nMessages' in seed) Object.assign(target, { i18nMessages: seed.i18nMessages })
      menus.push(target)
      available.set(targetKey, target)
    }
    entry.item.options = { ...entry.item.options, routeTarget: target.code }
  }
  // The existing reparenting implementation also owns cycle detection and stable target ordering.
  const result = applyMenuRouteTargets(menus, true)
  return { menus: result.menus, issues: [...issues, ...result.issues] }
}
