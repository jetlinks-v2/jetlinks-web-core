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
  registerRoute?: (route: RouteRecordRaw) => void
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
}

export const createMenuStoreRuntime = (options: MenuRuntimeOptions) => {
  const menusMap = ref<Map<string, any>>(new Map())
  const menu = ref<RouteRecordRaw[]>([])
  const siderMenus = ref<RouteRecordRaw[]>([])
  const menuResultCache = ref<any[]>([])
  const loading = ref(true)
  const hasResponeMenu = ref(false)
  const authStore = useAuthStore()

  const hasRouteMenu = () => {
    return !!menu.value.length
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

  const createRoutes = async (menuResult: any[]) => {
    menusMap.value.clear()
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
    }

    await options.afterHandleMenus?.(context)
    context.menuRoutes.forEach(route => options.registerRoute?.(route))
    menusMap.value = context.menuMap
    menu.value = context.menuRoutes
    siderMenus.value = context.menus
    authStore.setPermissionsAll(context.authButtons)

    return context
  }

  const init = () => {
    menusMap.value = new Map()
    menu.value = []
    siderMenus.value = []
    menuResultCache.value = []
    hasResponeMenu.value = false
    loading.value = false
  }

  return {
    menu,
    siderMenus,
    menusMap,
    menuResultCache,
    loading,
    hasResponeMenu,
    hasRouteMenu,
    hasMenu,
    getMenu,
    routerPush,
    jumpPage,
    createRoutes,
    init,
  }
}
