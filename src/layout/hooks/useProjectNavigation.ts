import { computed, type ComputedRef, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteMeta, RouteRecordRaw, Router } from 'vue-router'
import { isComingSoonMenuMeta } from '@jetlinks-web-core/utils/menuBadge'
import { normalizeProjectRuntimePath } from '@jetlinks-web-core/utils/project-runtime'

export type ProjectNavigationItem = {
  code?: string
  key: string
  label: string
  icon?: string
  description?: string
  disabled?: boolean
  menuBadge?: RouteMeta['menuBadge']
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
  secondaryKey: string
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

const findMenuByKey = (
  menus: RouteRecordRaw[],
  targetKey: string,
): RouteRecordRaw | undefined => {
  for (const menu of menus) {
    if (getMenuKey(menu) === targetKey) {
      return menu
    }

    const child = findMenuByKey((menu.children || []) as RouteRecordRaw[], targetKey)
    if (child) {
      return child
    }
  }

  return undefined
}

const isNavigationDisabled = (menu: ProjectNavigationRoute) => (
  menu.meta?.disabled === true || isComingSoonMenuMeta(menu.meta)
)

export const findFirstLeafKey = (menu: ProjectNavigationRoute): string => {
  if (isNavigationDisabled(menu)) {
    return ''
  }

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

  const visit = (
    items: RouteRecordRaw[],
    rootKey = '',
    secondaryKey = '',
    depth = 1,
  ) => {
    items.forEach((item) => {
      const key = getMenuKey(item)
      const currentRootKey = rootKey || key
      const currentSecondaryKey = depth === 2 ? key : secondaryKey

      if (key) {
        index.set(key, {
          key,
          rootKey: currentRootKey,
          secondaryKey: currentSecondaryKey,
          depth,
        })
      }

      if (item.children?.length) {
        visit(item.children, currentRootKey, currentSecondaryKey, depth + 1)
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
    disabled: isNavigationDisabled(menu),
    menuBadge: menu.meta?.menuBadge,
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
 * 将项目菜单树拆为左侧一级/二级侧栏与当前二级菜单的三级导航。
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
  const activeSecondaryKey = computed(() => activeEntry.value?.secondaryKey || '')

  const primaryMenus = computed(() => {
    // 非项目壳层仍只把一级、二级交给 ProLayout，保留原有内容区导航契约。
    return filteredMenus.value
      .map(menu => ({
        ...menu,
        children: menu.children?.map(child => ({
          ...child,
          children: undefined,
        })),
      }))
  })

  // 项目工作区需要在同一侧栏连续呈现二、三级菜单，不能再截断当前路由树。
  const projectSidebarMenus = computed(() => filteredMenus.value)

  const primarySelectedKeys = computed(() => {
    const selectedKey = activeSecondaryKey.value || activePrimaryKey.value
    const isVisible = primaryMenus.value.some(menu => (
      normalizeMenuKey(menu.path) === selectedKey
      || menu.children?.some(child => normalizeMenuKey(child.path) === selectedKey)
    ))

    return selectedKey && isVisible ? [selectedKey] : []
  })

  const topSelectedKeys = computed(() => {
    const selectedKey = activeEntry.value?.key || activeSecondaryKey.value || activePrimaryKey.value
    return selectedKey ? [selectedKey] : []
  })

  const activeRootMenu = computed(() => {
    const sourceMenus = searchKeyword.value ? filteredMenus.value : menus.value
    return findRootMenu(sourceMenus, activePrimaryKey.value)
  })

  const activeSecondaryMenu = computed(() => {
    const rootMenu = activeRootMenu.value
    const children = (rootMenu?.children || []) as RouteRecordRaw[]

    return children.find(menu => getMenuKey(menu) === activeSecondaryKey.value)
  })

  const projectSidebarSelectedKeys = computed(() => {
    const selectedKey = activeEntry.value?.key || activeSecondaryKey.value || activePrimaryKey.value
    const isVisible = selectedKey && !!findMenuByKey(projectSidebarMenus.value, selectedKey)

    return isVisible ? [selectedKey] : []
  })

  // ProLayout 的 mix 拆分菜单以 selectedKeys[0] 定位一级菜单，再把其 children 渲染到左侧。
  const mixSelectedKeys = computed(() => {
    const keys = [activeRootMenu.value?.path, activeSecondaryMenu.value?.path]
    return keys.filter((key, index): key is string => !!key && keys.indexOf(key) === index)
  })

  const projectMixSelectedKeys = computed(() => {
    const activeKey = projectSidebarSelectedKeys.value[0]
    const keys = [activeRootMenu.value?.path, activeKey]

    // splitMenus 依赖首项定位顶部一级菜单，末项负责左侧深层叶子选中态。
    return keys.filter((key, index): key is string => !!key && keys.indexOf(key) === index)
  })

  const secondaryItems = computed<ProjectNavigationItem[]>(() => {
    return (activeSecondaryMenu.value?.children || [])
      .map(toNavigationItem)
      .filter((item): item is ProjectNavigationItem => !!item)
  })

  const secondarySelectedKey = computed(() => {
    const entry = activeEntry.value

    if (!entry || entry.depth < 3) {
      return ''
    }

    return secondaryItems.value.some(item => item.key === entry.key) ? entry.key : ''
  })

  const navigateTo = (path?: string) => {
    const targetPath = normalizeMenuKey(path)
    const targetMenu = findMenuByKey(menus.value, targetPath)

    if (targetMenu && isNavigationDisabled(targetMenu)) {
      return
    }

    if (targetPath && targetPath !== normalizeMenuKey(route.path)) {
      void router.push(targetPath)
    }
  }

  const navigatePrimary = (path?: string) => {
    const targetKey = normalizeMenuKey(path)
    const sourceMenus = searchKeyword.value ? filteredMenus.value : menus.value
    const targetMenu = findMenuByKey(sourceMenus, targetKey)

    navigateTo(targetMenu ? findFirstLeafKey(targetMenu) : targetKey)
  }

  const navigateSecondary = (path: string) => {
    navigateTo(path)
  }

  return {
    primaryMenus,
    primarySelectedKeys,
    projectSidebarMenus,
    projectSidebarSelectedKeys,
    mixSelectedKeys,
    projectMixSelectedKeys,
    topSelectedKeys,
    secondaryItems,
    secondarySelectedKey,
    navigatePrimary,
    navigateSecondary,
  }
}
