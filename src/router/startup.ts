import type { Router } from 'vue-router'
import { useApplication, useAuthStore, useMenuStore, useSystemStore, useUserStore } from '@jetlinks-web-core/store'
import { isSubApp, OpenMicroApp } from '@jetlinks-web-core/utils/consts'

let menuRoutePromise: Promise<boolean> | undefined

export const bootstrapSession = async () => {
  const userStore = useUserStore()
  const systemStore = useSystemStore()
  const applicationStore = useApplication()

  if (!Object.keys(userStore.userInfo).length) {
    await userStore.getUserInfo()
  }

  const userKey = userStore.userInfo.id || userStore.userInfo.username

  if (!systemStore.isSessionInitializedFor(userKey)) {
    await systemStore.queryVersion()
    await systemStore.getShowThreshold()
    await systemStore.queryInfo()
    await systemStore.setMircoData()
    await systemStore.queryOrganizationTree()
    await systemStore.initOrganizationPlatformSetting((userStore.userInfo?.orgList || []) as any[])
    systemStore.markSessionInitialized(userKey)
  }

  if (!isSubApp && !applicationStore.appList.length && OpenMicroApp) {
    await applicationStore.queryApplication()
  }
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

  if (shouldSkipMenuFetch || menuStore.initialized) {
    return false
  }

  if (menuRoutePromise) {
    return menuRoutePromise
  }

  menuRoutePromise = (async () => {
    await menuStore.queryMenus()

    if (menuStore.initialized) {
      addFallbackRoute(router)
    }

    return menuStore.hasRouteMenu()
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

export const resetSessionStores = () => {
  // 退出或换账号后必须清空会话级缓存，否则 bootstrapSession 会误判用户态已加载。
  resetRouteStartupState()
  useSystemStore().resetSessionInitialization()
  useUserStore().init()
  useMenuStore().init()
  useAuthStore().init()
  useApplication().init()
}
