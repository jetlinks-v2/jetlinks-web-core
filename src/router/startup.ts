import type { RouteRecordRaw, Router } from 'vue-router'
import { useApplication, useMenuStore, useSystemStore, useUserStore } from '@jetlinks-web-core/store'
import { isSubApp, OpenMicroApp } from '@jetlinks-web-core/utils/consts'

let menuRoutePromise: Promise<boolean> | undefined

export const bootstrapSession = async () => {
  const userStore = useUserStore()
  const systemStore = useSystemStore()
  const applicationStore = useApplication()

  if (!Object.keys(userStore.userInfo).length) {
    await userStore.getUserInfo()
    await systemStore.queryVersion()
    await systemStore.getShowThreshold()
    await systemStore.queryInfo()
    await systemStore.setMircoData()
  }

  if (!isSubApp && !applicationStore.appList.length && OpenMicroApp) {
    await applicationStore.queryApplication()
  }
}

const hasRegisteredRoute = (router: Router, route: RouteRecordRaw) => {
  if (route.name) {
    return router.hasRoute(route.name)
  }

  return router.getRoutes().some(item => item.path === route.path)
}

const addMenuRoute = (router: Router, route: RouteRecordRaw) => {
  if (!route.path.startsWith('/') || hasRegisteredRoute(router, route)) {
    return
  }

  router.addRoute(route)
}

const addFallbackRoute = (router: Router) => {
  if (router.hasRoute('error')) {
    return
  }

  router.addRoute({
    path: '/:pathMatch(.*)*',
    name: 'error',
    component: () => import('@jetlinks-web-core/views/Error/404.vue'),
    meta: {
      title: '404',
    },
  })
}

export const ensureMenuRoutes = async (
  router: Router,
  shouldSkipMenuFetch: boolean,
): Promise<boolean> => {
  const menuStore = useMenuStore()

  if (menuStore.menu.length || shouldSkipMenuFetch) {
    return false
  }

  if (menuRoutePromise) {
    return menuRoutePromise
  }

  menuRoutePromise = (async () => {
    await menuStore.queryMenus()

    if (!menuStore.menu.length) {
      return false
    }

    menuStore.menu.forEach(route => addMenuRoute(router, route))
    addFallbackRoute(router)

    return true
  })()

  try {
    return await menuRoutePromise
  } finally {
    menuRoutePromise = undefined
  }
}

export const resetRouteStartupState = () => {
  menuRoutePromise = undefined
}
