import { computed } from 'vue'
import {
  componentsRegistry,
  type RegistryActionComponent,
} from '@jetlinks-web-core/utils/components-registry'
import { useMenuStore } from '@/store/menu'
import { getProjectSecondaryMenuRegistryKey } from '../navigation.constants'
import {
  applySecondaryMenuSourceOverrides,
  flattenProjectNavigationKeys,
  mergeProjectSecondaryMenuContributions,
  normalizeSecondaryMenuSource,
  projectRouteMatchesPath,
  resolveProjectMenuByCode,
  type ProjectMenuMapEntry,
  type ProjectRawMenu,
  type ProjectSecondaryMenuRegistryOptions,
  type ProjectSecondaryMenuSource,
  type ResolvedContribution,
} from '../utils/projectSecondaryMenu'
import {
  findFirstNavigationLeafKey,
  getBreadcrumbPaths,
  normalizeMenuKey,
  toNavigationItem,
  type ProjectNavigationItem,
  type ProjectNavigationRoute,
} from './useProjectNavigation'

export type { ProjectSecondaryMenuSource }

/**
 * 按目标菜单 code 组装二级导航。基础 children、隐藏菜单和批量扩展均在 Hook 内解析，
 * 调用方不需要持有菜单树，也不会绕过项目菜单的权限过滤结果。
 */
export const useProjectSecondaryMenuExtensions = (targetCode: string) => {
  const route = useRoute()
  const router = useRouter()
  const projectMenuStore = useMenuStore()

  const routeExists = (menu: ProjectNavigationRoute) => {
    return !!menu.name && router.hasRoute(menu.name)
  }

  const resolveByCode = (code: string) => resolveProjectMenuByCode(
    code,
    projectMenuStore.siderMenus,
    projectMenuStore.rawMenus as ProjectRawMenu[],
    projectMenuStore.menusMap as Map<string, ProjectMenuMapEntry>,
    routeExists,
  )

  const targetMenu = computed(() => resolveByCode(targetCode))
  const targetPath = computed(() => normalizeMenuKey(targetMenu.value?.path))
  const baseItems = computed(() => (targetMenu.value?.children || [])
    .map(toNavigationItem)
    .filter((item): item is ProjectNavigationItem => !!item))

  const registryItems = computed(() => {
    return componentsRegistry.getRegistry(getProjectSecondaryMenuRegistryKey(targetCode)) || []
  })

  const contributions = computed<ResolvedContribution[]>(() => {
    let sequence = 0

    return registryItems.value.flatMap((action: RegistryActionComponent) => {
      const options = action.extraOptions as ProjectSecondaryMenuRegistryOptions | undefined

      return (options?.menus || []).map(normalizeSecondaryMenuSource).map((source) => {
        const resolvedMenu = resolveByCode(source.code)
        const menu = source.requireChildren && !resolvedMenu?.children?.length
          ? undefined
          : resolvedMenu
        const resolvedItems = source.pick === 'children'
          ? (menu?.children || []).map(toNavigationItem)
          : [menu ? toNavigationItem(menu) : undefined]

        return {
          items: resolvedItems
            .filter((item): item is ProjectNavigationItem => !!item)
            .map(item => applySecondaryMenuSourceOverrides(item, source)),
          mode: source.mode || action.mode || 'append',
          order: source.order ?? action.order ?? 1000,
          sequence: sequence++,
          sourceCode: source.code,
          target: source.target || action.target,
        }
      })
    })
  })

  const items = computed(() => mergeProjectSecondaryMenuContributions(
    baseItems.value,
    contributions.value,
  ))
  const defaultPath = computed(() => {
    const firstItem = items.value[0]
    return firstItem ? findFirstNavigationLeafKey(firstItem) : targetPath.value
  })
  const routePaths = computed(() => getBreadcrumbPaths(route))
  const selectedKey = computed(() => {
    const keys = flattenProjectNavigationKeys(items.value)

    for (let index = routePaths.value.length - 1; index >= 0; index -= 1) {
      if (keys.includes(routePaths.value[index])) return routePaths.value[index]
    }

    const currentPath = normalizeMenuKey(route.path)
    return keys
      .filter(key => currentPath === key || currentPath.startsWith(`${key}/`))
      .sort((left, right) => right.length - left.length)[0] || ''
  })

  const active = computed(() => (
    !!selectedKey.value
    || !!targetPath.value && projectRouteMatchesPath(routePaths.value, targetPath.value)
  ))

  const navigate = (path?: string) => {
    const nextPath = normalizeMenuKey(path)
    if (nextPath && nextPath !== normalizeMenuKey(route.path)) void router.push(nextPath)
  }

  return {
    active,
    defaultPath,
    // 设置等虚拟导航域不承载内容，入口行为与普通一级菜单一致：进入首个可见叶子。
    enterTarget: () => navigate(defaultPath.value),
    items,
    navigate,
    navigateItem: (item: ProjectNavigationItem) => navigate(findFirstNavigationLeafKey(item)),
    selectedKey,
    targetMenu,
    targetPath,
    visible: computed(() => !!targetMenu.value),
  }
}
