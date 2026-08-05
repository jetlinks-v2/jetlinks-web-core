import type { RouteRecordRaw } from 'vue-router'
import type { ActionPosition } from '@jetlinks-web-core/utils/components-registry'
import { normalizeProjectRuntimePath } from '@jetlinks-web-core/utils/project-runtime'
import {
  normalizeMenuKey,
  type ProjectNavigationItem,
  type ProjectNavigationRoute,
} from '../hooks/useProjectNavigation'

type ProjectRawMenuMeta = {
  hideInMenu?: boolean
  options?: {
    show?: boolean
  }
  [key: string]: unknown
}

export type ProjectRawMenu = {
  code?: string
  name?: string
  i18nName?: string
  url?: string
  icon?: string
  describe?: string
  i18nDescribe?: string
  meta?: ProjectRawMenuMeta
  options?: {
    show?: boolean
    meta?: ProjectRawMenuMeta
  }
  children?: ProjectRawMenu[]
}

export type ProjectMenuMapEntry = {
  path?: string
  title?: string
  routeName?: string
}

export type ProjectSecondaryMenuSource = {
  code: string
  order?: number
  mode?: ActionPosition
  target?: string
  pick?: 'self' | 'children'
  requireChildren?: boolean
  label?: string | (() => string)
  description?: string | (() => string)
}

export type ProjectSecondaryMenuRegistryOptions = {
  menus?: Array<string | ProjectSecondaryMenuSource>
}

export type ResolvedContribution = {
  items: ProjectNavigationItem[]
  mode: ActionPosition
  order: number
  sequence: number
  sourceCode: string
  target?: string
}

const findRouteByCode = (menus: ProjectNavigationRoute[], code: string): ProjectNavigationRoute | undefined => {
  for (const menu of menus) {
    if (String(menu.name || '') === code) return menu

    const child = findRouteByCode(menu.children || [], code)
    if (child) return child
  }

  return undefined
}

const findRawMenuByCode = (menus: ProjectRawMenu[], code: string): ProjectRawMenu | undefined => {
  for (const menu of menus) {
    if (menu.code === code) return menu

    const child = findRawMenuByCode(menu.children || [], code)
    if (child) return child
  }

  return undefined
}

const isRawMenuVisible = (menu: ProjectRawMenu) => {
  const meta = {
    ...(menu.options?.meta || {}),
    ...(menu.meta || {}),
  }

  return meta.hideInMenu !== true
    && meta.options?.show !== false
    && menu.options?.show !== false
}

const toRawRoute = (
  menu: ProjectRawMenu,
  menuMap: Map<string, ProjectMenuMapEntry>,
): ProjectNavigationRoute | undefined => {
  if (!menu.code) return undefined

  const menuInfo = menuMap.get(menu.code)
  const path = normalizeProjectRuntimePath(menuInfo?.path || menu.url || '')
  if (!path) return undefined

  const children = (menu.children || [])
    .filter(isRawMenuVisible)
    .map(child => toRawRoute(child, menuMap))
    .filter((child): child is ProjectNavigationRoute => !!child)

  return {
    path,
    name: menuInfo?.routeName || menu.code,
    meta: {
      ...(menu.options?.meta || {}),
      ...(menu.meta || {}),
      icon: menu.icon,
      desc: menu.i18nDescribe || menu.describe,
      title: menuInfo?.title || menu.i18nName || menu.name || menu.code,
    },
    children: children.length ? children : undefined,
  }
}

export const resolveProjectMenuByCode = (
  code: string,
  visibleMenus: RouteRecordRaw[],
  rawMenus: ProjectRawMenu[],
  menuMap: Map<string, ProjectMenuMapEntry>,
  routeExists: (route: ProjectNavigationRoute) => boolean,
) => {
  const visibleMenu = findRouteByCode(visibleMenus, code)
  if (visibleMenu && routeExists(visibleMenu)) return visibleMenu

  const rawMenu = findRawMenuByCode(rawMenus, code)
  const rawRoute = rawMenu ? toRawRoute(rawMenu, menuMap) : undefined
  if (rawRoute && routeExists(rawRoute)) return rawRoute

  const menuInfo = menuMap.get(code)
  const path = normalizeProjectRuntimePath(menuInfo?.path || '')
  const fallbackRoute: ProjectNavigationRoute | undefined = path
    ? {
        path,
        name: menuInfo?.routeName || code,
        meta: { title: menuInfo?.title || code },
      }
    : undefined

  return fallbackRoute && routeExists(fallbackRoute) ? fallbackRoute : undefined
}

export const normalizeSecondaryMenuSource = (
  source: string | ProjectSecondaryMenuSource,
): ProjectSecondaryMenuSource => {
  return typeof source === 'string' ? { code: source } : source
}

const resolveText = (value?: string | (() => string)) => {
  return typeof value === 'function' ? value() : value
}

export const applySecondaryMenuSourceOverrides = (
  item: ProjectNavigationItem,
  source: ProjectSecondaryMenuSource,
): ProjectNavigationItem => ({
  ...item,
  label: resolveText(source.label) || item.label,
  description: resolveText(source.description) || item.description,
})

const findItemIndex = (items: ProjectNavigationItem[], target?: string) => {
  if (!target) return -1
  return items.findIndex(item => item.code === target || item.key === normalizeMenuKey(target))
}

const appendUnique = (items: ProjectNavigationItem[], additions: ProjectNavigationItem[]) => {
  additions.forEach((addition) => {
    const exists = items.some(item => (
      (!!addition.code && item.code === addition.code) || item.key === addition.key
    ))

    if (!exists) items.push(addition)
  })
}

export const mergeProjectSecondaryMenuContributions = (
  baseItems: ProjectNavigationItem[],
  contributions: ResolvedContribution[],
) => {
  const result = [...baseItems]

  contributions
    .sort((left, right) => left.order - right.order || left.sequence - right.sequence)
    .forEach(({ items, mode, sourceCode, target }) => {
      const targetIndex = findItemIndex(result, target || sourceCode)

      if (mode === 'hide') {
        if (targetIndex >= 0) result.splice(targetIndex, 1)
        return
      }
      if (mode === 'replace' && targetIndex >= 0) {
        result.splice(targetIndex, 1, ...items)
        return
      }
      if (mode === 'before' && targetIndex >= 0) {
        result.splice(targetIndex, 0, ...items)
        return
      }
      if (mode === 'after' && targetIndex >= 0) {
        result.splice(targetIndex + 1, 0, ...items)
        return
      }

      appendUnique(result, items)
    })

  return result
}

export const flattenProjectNavigationKeys = (items: ProjectNavigationItem[]): string[] => {
  return items.flatMap(item => [item.key, ...flattenProjectNavigationKeys(item.children || [])])
}

export const projectRouteMatchesPath = (paths: string[], targetPath: string) => {
  return paths.some(path => path === targetPath || path.startsWith(`${targetPath}/`))
}
