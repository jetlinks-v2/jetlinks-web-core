import type { MenuItem } from '@jetlinks-web-core/types/module'

export type MenuRouteTargetIssue = {
  sourceCode: string
  target: string
  type: 'missing-target' | 'circular-target'
}

type MenuLocation = {
  collection: MenuItem[]
  index: number
  parent?: MenuItem
}

const normalizeText = (value: unknown) => (
  typeof value === 'string' ? value.trim() : ''
)

const cloneMenuTree = (menus: MenuItem[]): MenuItem[] => menus.map(item => ({
  ...item,
  children: item.children?.length ? cloneMenuTree(item.children) : undefined,
}))

export const resolveMenuRouteName = (item: MenuItem) => (
  normalizeText(item.options?.routeName)
  || normalizeText((item.meta as Record<string, unknown> | undefined)?.routeName)
  || normalizeText(item.code)
)

const collectMenus = (menus: MenuItem[], result: MenuItem[] = []) => {
  menus.forEach((item) => {
    result.push(item)
    collectMenus(item.children || [], result)
  })
  return result
}

const findMenuLocation = (
  menus: MenuItem[],
  target: MenuItem,
  parent?: MenuItem,
): MenuLocation | undefined => {
  for (let index = 0; index < menus.length; index += 1) {
    const item = menus[index]
    if (item === target) return { collection: menus, index, parent }

    const childLocation = findMenuLocation(item.children || [], target, item)
    if (childLocation) return childLocation
  }
  return undefined
}

const containsMenu = (source: MenuItem, target: MenuItem): boolean => (
  source === target
  || (source.children || []).some(child => containsMenu(child, target))
)

const sortTargetChildren = (
  target: MenuItem,
  sequence: Map<MenuItem, number>,
) => {
  target.children?.sort((left, right) => {
    const leftOrder = Number.isFinite(left.sortIndex) ? Number(left.sortIndex) : Number.MAX_SAFE_INTEGER
    const rightOrder = Number.isFinite(right.sortIndex) ? Number(right.sortIndex) : Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
      || (sequence.get(left) || 0) - (sequence.get(right) || 0)
  })
}

/**
 * Reparents permission-filtered menus through their declared route names.
 * Invalid declarations keep the source in place so a bad menu seed cannot remove navigation.
 */
export const applyMenuRouteTargets = (sourceMenus: MenuItem[]) => {
  const menus = cloneMenuTree(sourceMenus)
  const entries = collectMenus(menus)
  const sequence = new Map(entries.map((item, index) => [item, index]))
  const targets = new Map<string, MenuItem>()
  const issues: MenuRouteTargetIssue[] = []
  const touchedTargets = new Set<MenuItem>()

  entries.forEach((item) => {
    const routeName = resolveMenuRouteName(item)
    if (routeName && !targets.has(routeName)) targets.set(routeName, item)
  })

  entries.forEach((source) => {
    const targetName = normalizeText(source.options?.routeTarget)
    if (!targetName) return

    const target = targets.get(targetName)
    if (!target) {
      issues.push({ sourceCode: source.code, target: targetName, type: 'missing-target' })
      return
    }

    // Moving a node below itself or one of its descendants would make the route tree cyclic.
    if (containsMenu(source, target)) {
      issues.push({ sourceCode: source.code, target: targetName, type: 'circular-target' })
      return
    }

    const location = findMenuLocation(menus, source)
    if (!location) return
    if (location.parent === target) {
      touchedTargets.add(target)
      return
    }

    location.collection.splice(location.index, 1)
    target.children = [...(target.children || []), source]
    touchedTargets.add(target)
  })

  touchedTargets.forEach(target => sortTargetChildren(target, sequence))

  return { issues, menus }
}
