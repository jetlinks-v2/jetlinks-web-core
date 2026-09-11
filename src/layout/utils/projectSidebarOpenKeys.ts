import type { RouteRecordRaw } from 'vue-router'
import { normalizeProjectRuntimePath } from '@jetlinks-web-core/utils/project-runtime'

type ProjectSidebarMenuRecord = Pick<RouteRecordRaw, 'path' | 'children'>

const getMenuKey = (item: ProjectSidebarMenuRecord) => (
  normalizeProjectRuntimePath(String(item.path || ''))
)

const findMenuByKey = (
  menus: ProjectSidebarMenuRecord[],
  targetKey: string,
): ProjectSidebarMenuRecord | undefined => {
  for (const menu of menus) {
    if (getMenuKey(menu) === targetKey) return menu

    const child = findMenuByKey((menu.children || []) as ProjectSidebarMenuRecord[], targetKey)
    if (child) return child
  }

  return undefined
}

const collectDirectChildGroupKeys = (menu: ProjectSidebarMenuRecord) => {
  const keys: string[] = []

  for (const child of (menu.children || []) as ProjectSidebarMenuRecord[]) {
    if (!child.children?.length) continue

    const key = getMenuKey(child)
    if (key) keys.push(key)
  }

  return keys
}

const uniqueKeys = (keys: string[]) => [...new Set(keys.filter(Boolean))]

const resolveActiveRootKey = (
  menus: ProjectSidebarMenuRecord[],
  selectedPaths: string[],
) => {
  for (const path of selectedPaths) {
    if (findMenuByKey(menus, path)) return path
  }

  return selectedPaths[0] || ''
}

export const getProjectSidebarOpenKeys = (
  menus: ProjectSidebarMenuRecord[],
  selectedPaths: string[],
  expandSecondaryMenu: boolean,
  layoutType: string,
) => {
  if (layoutType === 'top' || !expandSecondaryMenu) return []

  const normalizedSelectedPaths = selectedPaths
    .map(path => normalizeProjectRuntimePath(path))
    .filter(Boolean)

  if (!normalizedSelectedPaths.length) return []

  const activeRootKey = resolveActiveRootKey(menus, normalizedSelectedPaths)
  if (!activeRootKey) return uniqueKeys(normalizedSelectedPaths)

  const activeRootMenu = findMenuByKey(menus, activeRootKey)
  if (!activeRootMenu) return uniqueKeys(normalizedSelectedPaths)

  // 项目壳层默认把当前一级菜单下的二级分组一起展开，避免只撑开当前路由分支。
  return uniqueKeys([
    activeRootKey,
    ...normalizedSelectedPaths,
    ...collectDirectChildGroupKeys(activeRootMenu),
  ])
}
