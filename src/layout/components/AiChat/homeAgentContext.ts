import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from 'vue-router'
import router from '@jetlinks-web-core/router'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import type {
  HomeAgentCapability,
  HomeAgentCapabilityContext,
  HomeAgentMenuEntry,
  HomeAgentNavigationOptions,
  HomeAgentRouteLink,
  HomeAgentRuntimeOptions,
} from './homeAgentContracts'
import { homeAgentCapabilityRegistry } from './homeAgentRegistry'
import {
  isPlainRecord,
  normalizeKeyword,
  normalizeText,
  resolveMaybeArray,
  toArray,
  uniqueStrings,
} from './homeAgentShared'

const normalizeRouteTitle = (
  route?: RouteLocationNormalizedLoaded | RouteRecordRaw | Record<string, any>,
) => {
  const meta = (route?.meta || {}) as Record<string, any>
  return normalizeText(meta.title || route?.name || route?.path)
}

const resolveMenuTitle = (menu: Record<string, any>) => (
  normalizeText(menu?.meta?.title || menu?.title || menu?.name || menu?.code || menu?.path)
)

const resolveMenuCode = (menu: Record<string, any>) => (
  normalizeText(menu?.code || menu?.name || menu?.routeName || menu?.path)
)

const resolveMenuRouteName = (menu: Record<string, any>) => (
  normalizeText(menu?.routeName || menu?.name || menu?.code)
)

const flattenVisibleMenus = (
  source: Record<string, any>[],
  parents: HomeAgentMenuEntry[] = [],
) => {
  const result: HomeAgentMenuEntry[] = []
  source.forEach((menu) => {
    const code = resolveMenuCode(menu)
    const title = resolveMenuTitle(menu)
    const routeName = resolveMenuRouteName(menu)
    const entry: HomeAgentMenuEntry | undefined = code && title
      ? {
        code,
        name: code,
        title,
        routeName,
        path: normalizeText(menu?.path) || undefined,
        breadcrumb: [...parents.map(item => item.title), title],
        keywords: uniqueStrings([
          code,
          title,
          routeName,
          menu?.path,
          menu?.meta?.title,
          ...parents.flatMap(item => [item.code, item.title]),
        ]),
      }
      : undefined

    if (entry) result.push(entry)
    const children = Array.isArray(menu?.children) ? menu.children : []
    if (children.length) {
      result.push(...flattenVisibleMenus(children, entry ? [...parents, entry] : parents))
    }
  })
  return result
}

const collectVisibleMenus = (options?: HomeAgentRuntimeOptions) => {
  const adaptedMenus = options?.contextAdapter?.getMenus?.()
  if (Array.isArray(adaptedMenus)) return flattenVisibleMenus(adaptedMenus)
  const menus = useMenuStore().siderMenus
  return flattenVisibleMenus(Array.isArray(menus) ? menus as any[] : [])
}

const menuToCapability = (menu: HomeAgentMenuEntry): HomeAgentCapability => ({
  id: `menu:${menu.code}`,
  name: menu.title,
  description: menu.breadcrumb.join(' / '),
  kind: 'menu',
  category: 'menu',
  keywords: menu.keywords,
  menuCode: menu.code,
  routeName: menu.routeName,
  path: menu.path,
})

const normalizeCapability = (item: HomeAgentCapability): HomeAgentCapability | undefined => {
  const id = normalizeText(item?.id)
  const name = normalizeText(item?.name)
  if (!id || !name) return undefined

  return {
    ...item,
    id,
    name,
    kind: item.kind || 'feature',
    keywords: uniqueStrings([
      ...(item.keywords || []),
      item.id,
      item.name,
      item.description,
      item.category,
      item.menuCode,
      item.routeName,
      item.path,
      item.clientId,
      item.clientType,
    ]),
  }
}

const mergeCapabilities = (items: HomeAgentCapability[]) => {
  const result: HomeAgentCapability[] = []
  const indexMap = new Map<string, number>()
  items.forEach((item) => {
    const capability = normalizeCapability(item)
    if (!capability) return
    const index = indexMap.get(capability.id)
    if (index === undefined) {
      indexMap.set(capability.id, result.length)
      result.push(capability)
    } else {
      result[index] = { ...result[index], ...capability }
    }
  })
  return result.sort((a, b) => (
    (a.order || 0) - (b.order || 0)
    || a.id.localeCompare(b.id)
  ))
}

const getCapabilityMenuAnchors = (capability: HomeAgentCapability) => uniqueStrings([
  capability.menuCode,
  capability.routeName,
  capability.path,
  capability.metadata?.menuCode,
  capability.metadata?.routeName,
  capability.metadata?.path,
])

const filterUnauthorizedCapabilities = (
  capabilities: HomeAgentCapability[],
  context: HomeAgentCapabilityContext,
) => capabilities.filter((capability) => {
  if (capability.kind === 'menu') return true
  const anchors = getCapabilityMenuAnchors(capability)
  return !anchors.length || anchors.some(anchor => !!context.findMenu(anchor))
})

const buildCurrentRouteSummary = () => {
  const current = router.currentRoute.value
  return {
    name: normalizeText(current.name),
    path: current.path,
    fullPath: current.fullPath,
    title: normalizeRouteTitle(current),
  }
}

const resolveCurrentView = (options?: HomeAgentRuntimeOptions) => (
  typeof options?.currentView === 'function'
    ? normalizeText(options.currentView())
    : normalizeText(options?.currentView)
)

const findMenuFromStore = (value: string) => {
  const text = normalizeText(value)
  return text ? useMenuStore().getMenu(text) || undefined : undefined
}

const createFindMenu = (menus: HomeAgentMenuEntry[]) => (value: string) => {
  const normalized = normalizeKeyword(value)
  if (!normalized) return undefined
  return menus.find(menu => (
    normalizeKeyword(menu.code) === normalized
    || normalizeKeyword(menu.routeName) === normalized
    || normalizeKeyword(menu.path) === normalized
    || normalizeKeyword(menu.title) === normalized
  ))
}

const normalizeNavigationOptions = (
  options?: { query?: Record<string, any>; params?: Record<string, any> },
) => ({
  query: isPlainRecord(options?.query) ? options?.query : {},
  params: isPlainRecord(options?.params) ? options?.params : {},
})

const createMenuNavigator = (
  menus: HomeAgentMenuEntry[],
  findMenu: (value: string) => HomeAgentMenuEntry | undefined,
  options?: HomeAgentRuntimeOptions,
) => (value: string, navigationOptions?: HomeAgentNavigationOptions) => {
  if (options?.contextAdapter?.navigateToMenu) {
    return options.contextAdapter.navigateToMenu(value, navigationOptions)
  }
  const text = normalizeText(value)
  if (!text) return false

  const menuStore = useMenuStore()
  const storeMenu = findMenuFromStore(text)
  const menu = findMenu(text)
  const routeName = normalizeText(storeMenu?.routeName || menu?.routeName || storeMenu?.name)
  const navOptions = normalizeNavigationOptions(navigationOptions)
  if (storeMenu || routeName) {
    menuStore.routerPush(routeName || text, navOptions)
    return true
  }
  const target = menu || menus.find(item => normalizeText(item.path) === text)
  if (target?.path) {
    void router.push({ path: target.path, query: navOptions.query })
    return true
  }
  return false
}

const createRouteNavigator = (options?: HomeAgentRuntimeOptions) => (
  routeName: string,
  navigationOptions?: HomeAgentNavigationOptions,
) => {
  if (options?.contextAdapter?.navigateToRoute) {
    return options.contextAdapter.navigateToRoute(routeName, navigationOptions)
  }
  const name = normalizeText(routeName)
  if (!name || !router.hasRoute(name)) return false
  useMenuStore().routerPush(name, normalizeNavigationOptions(navigationOptions))
  return true
}

export const createHomeAgentContext = (
  options: HomeAgentRuntimeOptions = {},
): HomeAgentCapabilityContext => {
  const menus = collectVisibleMenus(options)
  const findMenu = createFindMenu(menus)
  const latestUserMessage = options.getLatestUserMessage?.()
  const context: HomeAgentCapabilityContext = {
    currentRoute: buildCurrentRouteSummary(),
    currentView: resolveCurrentView(options) || undefined,
    ...(latestUserMessage?.content ? { latestUserMessage } : {}),
    menus,
    capabilities: [],
    findMenu,
    navigateToMenu: createMenuNavigator(menus, findMenu, options),
    navigateToRoute: createRouteNavigator(options),
  }
  const providers = homeAgentCapabilityRegistry.getProviders(options.providerScopes || 'home')
  const providerCapabilities = providers.flatMap(provider => toArray(provider.getCapabilities?.(context)))
  context.capabilities = filterUnauthorizedCapabilities(mergeCapabilities([
    ...menus.map(menuToCapability),
    ...resolveMaybeArray(options.extraCapabilities),
    ...providerCapabilities,
  ]), context)
  return context
}

const findPathPermissionAnchor = (path: string, context: HomeAgentCapabilityContext) => {
  const routePath = normalizeText(path).split('?')[0]
  if (!routePath) return undefined
  return context.menus.find((menu) => {
    const menuPath = normalizeText(menu.path)
    return menuPath && (routePath === menuPath || routePath.startsWith(`${menuPath}/`))
  })
}

export const findHomeAgentRoutePermissionAnchor = (
  routeLink: HomeAgentRouteLink,
  context: HomeAgentCapabilityContext,
) => {
  if (routeLink.menuCode) return context.findMenu(routeLink.menuCode)
  if (routeLink.routeName) return context.findMenu(routeLink.routeName)
  if (routeLink.path) return findPathPermissionAnchor(routeLink.path, context)
  return undefined
}
