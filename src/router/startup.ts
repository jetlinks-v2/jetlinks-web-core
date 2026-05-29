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

const registerMissingChildren = (
  router: Router,
  parentName: NonNullable<RouteRecordRaw['name']>,
  children: RouteRecordRaw[] = [],
) => {
  let added = false

  children.forEach(child => {
    if (!child.path?.startsWith('/')) {
      return
    }

    if (hasRegisteredRoute(router, child)) {
      if (child.name && child.children?.length) {
        added = registerMissingChildren(router, child.name, child.children) || added
      }
      return
    }

    router.addRoute(parentName, child)
    added = true
  })

  return added
}

const addMenuRoute = (router: Router, route: RouteRecordRaw) => {
  if (!route.path.startsWith('/')) {
    return false
  }

  if (hasRegisteredRoute(router, route)) {
    if (route.name && route.children?.length) {
      // 菜单动态更新时父路由已注册，仍需要把新增子路由挂回去。
      return registerMissingChildren(router, route.name, route.children)
    }
    return false
  }

  router.addRoute(route)
  return true
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

  if (shouldSkipMenuFetch) {
    return false
  }

  if (menuStore.menu.length) {
    const hasAddedRoutes = menuStore.menu
      .map(route => addMenuRoute(router, route))
      .some(Boolean)

    if (hasAddedRoutes) {
      addFallbackRoute(router)
    }

    return hasAddedRoutes
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
