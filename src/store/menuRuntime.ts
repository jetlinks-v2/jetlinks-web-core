import type { RouteRecordRaw } from 'vue-router'
import { cloneDeep } from 'lodash-es'
import { handleMenus } from '@jetlinks-web-core/utils'
import { useAuthStore } from './auth'

type MaybePromise<T> = T | Promise<T>

export type MenuRuntimeOptions = {
  handleMenuLevel?: number
  getAsyncRoutes: () => MaybePromise<Record<string, any>>
  resolveExtraMenus: (
    menus: any[],
    context: Pick<MenuRuntimeContext, 'asyncRoutes'>,
  ) => MaybePromise<Record<string, any>>
  prepareMenus?: (
    menus: any[],
    context: Pick<MenuRuntimeContext, 'asyncRoutes'>,
  ) => MaybePromise<any[]>
  afterHandleMenus?: (context: MenuRuntimeContext) => MaybePromise<void>
  registerRoute?: (route: RouteRecordRaw) => (() => void) | void
  routerPush?: (
    name: string,
    options?: MenuRuntimeRouterOptions,
    menuItem?: any,
  ) => void
}

export type MenuRuntimeRouterOptions = {
  params?: Record<string, any>
  query?: Record<string, any>
}

export type MenuRuntimeContext = {
  sourceMenus: any[]
  asyncRoutes: Record<string, any>
  extraMenus: Record<string, any>
  menuRoutes: RouteRecordRaw[]
  menuMap: Map<string, any>
  menus: RouteRecordRaw[]
  authButtons: Record<string, string[]>
  managedRouteNames: Set<string>
}

export const createMenuStoreRuntime = (options: MenuRuntimeOptions) => {
  const menusMap = ref<Map<string, any>>(new Map())
  const menu = ref<RouteRecordRaw[]>([])
  const siderMenus = ref<RouteRecordRaw[]>([])
  const menuResultCache = ref<any[]>([])
  const loading = ref(true)
  const hasResponeMenu = ref(false)
  const initialized = ref(false)
  const authStore = useAuthStore()
  let removeManagedRoutes: Array<() => void> = []
  let managedRouteNames = new Set<string>()

  const clearManagedRoutes = () => {
    // Vue Router disposers remove only the server routes registered by the previous application.
    removeManagedRoutes.reverse().forEach(removeRoute => removeRoute())
    removeManagedRoutes = []
    managedRouteNames = new Set()
  }

  const hasRouteMenu = () => {
    return menu.value.some(route => route.path !== '/')
  }

  const hasMenu = (code: string) => {
    return menusMap.value.has(code)
  }

  const getMenu = (name: string) => {
    return menusMap.value.get(name)
  }

  const routerPush = (
    name: string,
    routerOptions?: MenuRuntimeRouterOptions,
  ) => {
    options.routerPush?.(name, routerOptions)
  }

  const jumpPage = (
    name: string,
    routerOptions?: MenuRuntimeRouterOptions,
  ) => {
    const menuItem = menusMap.value.get(name)

    if (menuItem) {
      options.routerPush?.(menuItem.routeName || name, routerOptions, menuItem)
    }
  }

  const createRoutes = async (
    menuResult: any[],
    shouldApply: () => boolean = () => true,
  ) => {
    const asyncRoutes = await options.getAsyncRoutes()
    const sourceMenus = await (options.prepareMenus?.(menuResult, { asyncRoutes }) || menuResult)
    const extraMenus = await options.resolveExtraMenus(sourceMenus, { asyncRoutes })
    const { menuRoutes, menuMap, menus, authButtons } = handleMenus(
      cloneDeep(sourceMenus),
      extraMenus,
      asyncRoutes,
      options.handleMenuLevel,
    )
    const context: MenuRuntimeContext = {
      sourceMenus,
      asyncRoutes,
      extraMenus,
      menuRoutes,
      menuMap,
      menus: menus as RouteRecordRaw[],
      authButtons,
      managedRouteNames: new Set(managedRouteNames),
    }

    await options.afterHandleMenus?.(context)
    if (!shouldApply()) return

    const nextManagedRouteNames = new Set<string>()
    const collectManagedRouteNames = (routes: RouteRecordRaw[]) => {
      routes.forEach(route => {
        if (typeof route.name === 'string') nextManagedRouteNames.add(route.name)
        if (route.children?.length) collectManagedRouteNames(route.children)
      })
    }

    clearManagedRoutes()
    context.menuRoutes.forEach(route => {
      const removeRoute = options.registerRoute?.(route)
      if (removeRoute) {
        removeManagedRoutes.push(removeRoute)
        collectManagedRouteNames([route])
      }
    })
    managedRouteNames = nextManagedRouteNames
    menusMap.value = context.menuMap
    menu.value = context.menuRoutes
    siderMenus.value = context.menus
    authStore.setPermissionsAll(context.authButtons)
    initialized.value = true

    return context
  }

  const init = () => {
    clearManagedRoutes()
    menusMap.value = new Map()
    menu.value = []
    siderMenus.value = []
    menuResultCache.value = []
    hasResponeMenu.value = false
    initialized.value = false
    loading.value = false
  }

  return {
    menu,
    siderMenus,
    menusMap,
    menuResultCache,
    loading,
    hasResponeMenu,
    initialized,
    hasRouteMenu,
    hasMenu,
    getMenu,
    routerPush,
    jumpPage,
    createRoutes,
    init,
  }
}
