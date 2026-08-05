import { computed, type ComputedRef, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteMeta, RouteRecordRaw, Router } from 'vue-router'
import { normalizeProjectRuntimePath } from '@jetlinks-web-core/utils/project-runtime'

export type ProjectNavigationItem = {
  code?: string
  key: string
  label: string
  icon?: string
  description?: string
  children?: ProjectNavigationItem[]
}

export type ProjectNavigationRoute = {
  path: string
  name?: string | symbol
  meta?: RouteMeta
  children?: ProjectNavigationRoute[]
}

type ProjectBreadcrumbRoute = {
  path?: string
}

type ProjectMenuIndexEntry = {
  key: string
  rootKey: string
  depth: number
}

type UseProjectNavigationOptions = {
  menus: ComputedRef<RouteRecordRaw[]>
  filteredMenus: ComputedRef<RouteRecordRaw[]>
  searchKeyword: Ref<string>
  route: RouteLocationNormalizedLoaded
  router: Router
}

export const normalizeMenuKey = (path?: string) => {
  return path ? normalizeProjectRuntimePath(path) : ''
}

export const getMenuKey = (menu: ProjectNavigationRoute) => normalizeMenuKey(menu.path)

const findRootMenu = (menus: RouteRecordRaw[], rootKey: string) => {
  return menus.find(menu => getMenuKey(menu) === rootKey)
}

export const findFirstLeafKey = (menu: ProjectNavigationRoute): string => {
  for (const child of menu.children || []) {
    const childKey = findFirstLeafKey(child)

    if (childKey) {
      return childKey
    }
  }

  return getMenuKey(menu)
}

const buildMenuIndex = (menus: RouteRecordRaw[]) => {
  const index = new Map<string, ProjectMenuIndexEntry>()

  const visit = (items: RouteRecordRaw[], rootKey = '', depth = 1) => {
    items.forEach((item) => {
      const key = getMenuKey(item)
      const currentRootKey = rootKey || key

      if (key) {
        index.set(key, { key, rootKey: currentRootKey, depth })
      }

      if (item.children?.length) {
        visit(item.children, currentRootKey, depth + 1)
      }
    })
  }

  visit(menus)
  return index
}

export const toNavigationItem = (menu: ProjectNavigationRoute): ProjectNavigationItem | undefined => {
  const key = getMenuKey(menu)

  if (!key) {
    return undefined
  }

  const children = (menu.children || [])
    .map(toNavigationItem)
    .filter((item): item is ProjectNavigationItem => !!item)

  return {
    code: menu.name ? String(menu.name) : undefined,
    key,
    label: String(menu.meta?.title || menu.name || key),
    icon: menu.meta?.icon ? String(menu.meta.icon) : undefined,
    description: menu.meta?.desc ? String(menu.meta.desc) : undefined,
    children: children.length ? children : undefined,
  }
}

export const containsNavigationKey = (items: ProjectNavigationItem[], targetKey: string): boolean => {
  return items.some(item => (
    item.key === targetKey
    || !!item.children?.length && containsNavigationKey(item.children, targetKey)
  ))
}

export const findFirstNavigationLeafKey = (item: ProjectNavigationItem): string => {
  for (const child of item.children || []) {
    const childKey = findFirstNavigationLeafKey(child)

    if (childKey) {
      return childKey
    }
  }

  return item.key
}

export const getBreadcrumbPaths = (route: RouteLocationNormalizedLoaded) => {
  const breadcrumb = Array.isArray(route.meta?.breadcrumb) ? route.meta.breadcrumb : []
  const breadcrumbCache = Array.isArray(route.meta?.breadcrumbCache) ? route.meta.breadcrumbCache : []
  // 详情或隐藏路由可能清空实时面包屑，但仍通过缓存保留所属菜单上下文。
  const routes = (breadcrumb.length ? breadcrumb : breadcrumbCache) as ProjectBreadcrumbRoute[]

  return [
    ...routes.map(item => normalizeMenuKey(item.path)),
    normalizeMenuKey(route.path),
  ].filter(Boolean)
}

const resolveActiveEntry = (
  index: Map<string, ProjectMenuIndexEntry>,
  route: RouteLocationNormalizedLoaded,
) => {
  const breadcrumbPaths = getBreadcrumbPaths(route)

  for (let indexPosition = breadcrumbPaths.length - 1; indexPosition >= 0; indexPosition -= 1) {
    const entry = index.get(breadcrumbPaths[indexPosition])

    if (entry) {
      return entry
    }
  }

  const currentPath = normalizeMenuKey(route.path)

  return [...index.values()]
    .filter(entry => entry.key !== '/' && currentPath.startsWith(`${entry.key}/`))
    .sort((left, right) => right.key.length - left.key.length)[0]
}

/**
 * 将项目菜单树拆为一级侧栏与当前一级菜单的横向子导航。
 * 权限与隐藏菜单已由 projectMenuStore 处理；这里仅维护路由层级、搜索结果和选中态联动。
 */
export const useProjectNavigation = ({
  menus,
  filteredMenus,
  searchKeyword,
  route,
  router,
}: UseProjectNavigationOptions) => {
  const menuIndex = computed(() => buildMenuIndex(menus.value))
  const activeEntry = computed(() => resolveActiveEntry(menuIndex.value, route))
  const activePrimaryKey = computed(() => activeEntry.value?.rootKey || '')

  const primaryMenus = computed(() => {
    return filteredMenus.value
      .map(menu => ({
        ...menu,
        children: undefined,
      }))
  })

  const primarySelectedKeys = computed(() => {
    const selectedKey = activePrimaryKey.value
    const isVisible = primaryMenus.value.some(menu => normalizeMenuKey(menu.path) === selectedKey)

    return selectedKey && isVisible ? [selectedKey] : []
  })

  const secondaryRoot = computed(() => {
    const sourceMenus = searchKeyword.value ? filteredMenus.value : menus.value
    return findRootMenu(sourceMenus, activePrimaryKey.value)
  })

  const secondaryItems = computed<ProjectNavigationItem[]>(() => {
    return (secondaryRoot.value?.children || [])
      .map(toNavigationItem)
      .filter((item): item is ProjectNavigationItem => !!item)
  })

  const secondarySelectedKey = computed(() => {
    const entry = activeEntry.value

    if (!entry || entry.depth === 1) {
      return ''
    }

    return containsNavigationKey(secondaryItems.value, entry.key) ? entry.key : ''
  })

  const navigateTo = (path?: string) => {
    const targetPath = normalizeMenuKey(path)

    if (targetPath && targetPath !== normalizeMenuKey(route.path)) {
      void router.push(targetPath)
    }
  }

  const navigatePrimary = (path?: string) => {
    const rootKey = normalizeMenuKey(path)
    const sourceMenus = searchKeyword.value ? filteredMenus.value : menus.value
    const rootMenu = findRootMenu(sourceMenus, rootKey)

    navigateTo(rootMenu ? findFirstLeafKey(rootMenu) : rootKey)
  }

  const navigateSecondary = (path: string) => {
    navigateTo(path)
  }

  return {
    primaryMenus,
    primarySelectedKeys,
    secondaryItems,
    secondarySelectedKey,
    navigatePrimary,
    navigateSecondary,
  }
}
