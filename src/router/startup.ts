import type { Router } from 'vue-router'
import {
  useApplication,
  useAuthStore,
  useBusinessApplicationStore,
  useMenuStore,
  useSystemStore,
  useUserStore,
} from '@jetlinks-web-core/store'
import { isBusinessApplicationRuntime } from '@jetlinks-web-core/utils/business-application-runtime'
import { getApplicationRuntimeEntry } from '@jetlinks-web-core/utils/project-runtime'
import { ApplicationEntryUnavailableError } from '@jetlinks-web-core/utils/application-scope'
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
    systemStore.markSessionInitialized(userKey)
  }

  if (!isSubApp && !applicationStore.appList.length && OpenMicroApp) {
    // 非关键 UI 模块发现失败由 store 记录，仍继续初始化业务应用上下文。
    await applicationStore.queryApplication().catch(() => undefined)
  }

  if (isBusinessApplicationRuntime()) {
    const selected = await useBusinessApplicationStore().initialize()
    if (getApplicationRuntimeEntry().type === 'application' && selected) {
      systemStore.layout.title = selected.name
      systemStore.changeTitle(selected.name)
    }
  }
}

export const addFallbackRoute = (router: Router) => {
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
    const businessApplicationStore = useBusinessApplicationStore()
    const entry = getApplicationRuntimeEntry()
    if (entry.type === 'application'
      && (!businessApplicationStore.initialized
        || !businessApplicationStore.scopeSupported
        || businessApplicationStore.currentApplication?.id !== entry.applicationId)) {
      throw new ApplicationEntryUnavailableError()
    }

    // 项目和租户菜单显式禁用应用 Scope，应用菜单只使用已确认的目标。
    const result = await menuStore.queryMenus(entry.applicationId || false)
    if (entry.type === 'application' && result?.applied && !result.firstMenuPath) {
      throw new ApplicationEntryUnavailableError()
    }

    if (menuStore.initialized) {
      addFallbackRoute(router)
    }

    // Empty application menus still register a root redirect to 403 and must rematch the route.
    return menuStore.initialized
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
  useBusinessApplicationStore().init()
}
