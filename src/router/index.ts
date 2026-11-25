import {
  createRouter,
  createWebHashHistory,
  type RouteLocationNormalized,
  type NavigationGuardNext
} from 'vue-router'
import { getToken, removeToken, onlyMessage } from '@jetlinks-web/utils'
import i18n from '@jetlinks-web-core/locales'
import microApp from '@micro-zoe/micro-app'
import { collectCoreRouteOverrides } from './globModules'
import { resolveCoreRoutes } from './coreRoutes'
import { RouteSecurityLevel, usesShareSession } from './types'
import { DefaultApplicationEntryError } from './default-entry'
import { shallowRef, toValue } from 'vue'
import { isSubApp } from '@jetlinks-web-core/utils/consts'
import {
  addFallbackRoute,
  bootstrapSession,
  ensureMenuRoutes,
  ensureSystemBulletinSubscription,
  resetRouteStartupState,
  resetSessionStores
} from './startup'
import {
  createProjectRuntimeHref,
  getProjectCodeFromLocation,
  getProjectRuntimeConfig,
  redirectLegacyProjectHash,
  isProjectRuntime,
  getApplicationRuntimeEntry,
} from '@jetlinks-web-core/utils/project-runtime'
import {
  ApplicationEntryUnavailableError,
  APPLICATION_SCOPE_QUERY_KEY,
  getRouteQueryParam,
  isProjectApplicationScope,
  preserveApplicationScopeQuery,
} from '@jetlinks-web-core/utils/application-scope'
import { getProjectStorage, removeProjectStorage } from '@jetlinks-web-core/utils/project-storage'
import { useRouteLoadingStore } from '@jetlinks-web-core/store/route-loading'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { clearLoginTransientState } from '@jetlinks-web-core/views/login/utils/redirect'
import {
  ACTIVE_LOGOUT_LOGIN_REASON,
  createLoginNavigationHref,
  LOGIN_REASON_QUERY_KEY,
  resolveLoginSourcePage,
  type LoginNavigationReason,
} from './login-navigation'
import { completeLoginNavigation, requestLoginNavigation } from './login-transition'
import { FORBIDDEN_PATH, NO_MENU_REASON, forbiddenLocation } from './forbidden'

const NOT_FOUND_PATH = '/404'
const PROJECT_RUNTIME_ROOT_PATH = '/'
const PROJECT_TENANT_ROUTE_PREFIXES = ['/console', '/account']

// ============ 核心路由解析 ============
const moduleOverrides = collectCoreRouteOverrides()
const {
  routes: coreRoutes,
  tokenFilterPaths,
  menuFilterPaths,
  registry
} = resolveCoreRoutes(moduleOverrides)

// 输出调试信息
if (import.meta.env.DEV) {
  console.log('[Router] 核心路由配置:', {
    coreRoutes: registry.map(r => r.name),
    tokenFilterPaths,
    menuFilterPaths
  })
}

// ============ 创建Router ============
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    ...coreRoutes
  ],
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

microApp.router.setBaseAppRouter(router)

// ============ 路由守卫优化 ============

/**
 * 检查路由是否需要token验证
 *
 * 优先级:
 * 1. meta.security === PUBLIC -> 无需token
 * 2. 匹配 tokenFilterPaths（支持动态参数）
 * 3. 默认需要token
 */
function isPublicRoute(to: RouteLocationNormalized): boolean {
  // 方式1: 检查meta配置（推荐）
  if (to.matched.some(record => record.meta.security === RouteSecurityLevel.PUBLIC)) {
    return true
  }

  // 方式2: 精确路径匹配（兼容旧代码）
  if (tokenFilterPaths.includes(to.path)) {
    return true
  }

  // 方式3: 动态路由参数匹配
  // 例如: /edge/token/:id 匹配 /edge/token/123
  return tokenFilterPaths.some(filterPath => {
    if (!filterPath.includes(':')) return false
    const regex = new RegExp('^' + filterPath.replace(/:\w+/g, '[^/]+') + '$')
    return regex.test(to.path)
  })
}

/**
 * 检查是否跳过菜单权限检查
 */
function shouldSkipMenuFetch(to: RouteLocationNormalized): boolean {
  // 模块可以覆盖个人中心路径；命名路由仍须遵循无菜单拦截。
  if (to.name === 'account/center') return false

  // 精确匹配
  if (menuFilterPaths.includes(to.path)) {
    return true
  }

  // meta配置匹配
  return to.matched.some(record => record.meta.skipMenuFetch === true)
}

const isForbiddenRoute = (to: RouteLocationNormalized) => to.path === FORBIDDEN_PATH
const isNotFoundRoute = (to: RouteLocationNormalized) => to.name === 'error'

/** Application bootstrap failures stop at 403; project-menu fallback would change the entry identity. */
const handleApplicationStartupError = (
  error: unknown,
  to: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  const entry = getApplicationRuntimeEntry()
  if (entry.type !== 'application') return false
  if (!(error instanceof ApplicationEntryUnavailableError)) {
    onlyMessage(i18n.global.t('components.BusinessApplicationSwitcher.loadFailed'), 'error')
  }
  next(forbiddenLocation(to.query))
  return true
}

const getAdministratorRouteRedirect = (to: RouteLocationNormalized) => {
  const user = useUserStore()
  const denied = to.matched.some(({ meta }) => (
    (meta.security === RouteSecurityLevel.SUPER_ADMIN && !user.isSuperAdmin)
    || (meta.security === RouteSecurityLevel.ADMINISTRATOR && !user.isAdmin)
  ))

  if (!denied) {
    return
  }

  // 404 fallback normally waits for menu routes; register it now so denied routes never render briefly.
  addFallbackRoute(router)
  return {
    path: NOT_FOUND_PATH,
    replace: true
  }
}

const isProjectTenantSemanticRoute = (to: RouteLocationNormalized) => {
  return PROJECT_TENANT_ROUTE_PREFIXES.some(prefix => (
    to.path === prefix || to.path.startsWith(`${prefix}/`)
  ))
}

const getSubAccountRedirect = (to: RouteLocationNormalized) => {
  const userStore = useUserStore()

  if (!userStore.isSubAccount) {
    return
  }

  if (isProjectRuntime()) {
    // 项目和应用都复用这个静态账户页；其他旧租户路径仍返回根入口。
    if (to.name === 'account/center') {
      return
    }

    if (!isProjectTenantSemanticRoute(to)) {
      return
    }

    // 项目端入口由服务端菜单决定，避免继续跳转到已下线的旧项目个人中心壳。
    const projectCode = getProjectCodeFromLocation()
    window.location.href = createProjectRuntimeHref(projectCode, PROJECT_RUNTIME_ROOT_PATH)
    return false
  }

  if (isForbiddenRoute(to) || isNotFoundRoute(to) || isPublicRoute(to)) {
    return
  }

  // 租户端 URL 没有项目 code，不能猜测项目上下文；阻断到无权限页。
  return {
    path: FORBIDDEN_PATH,
    replace: true
  }
}

/**
 * 无Token时的跳转逻辑
 */
const NoTokenJump = (
  to: RouteLocationNormalized,
  next: NavigationGuardNext,
  isLoginRoute: boolean
) => {
  if (isLoginRoute || isPublicRoute(to)) {
    next()
  } else {
    // 查找登录路由
    const loginRoute = coreRoutes.find(r => r.name === 'Login')
    const loginPath = loginRoute?.path || '/login'
    next(
      to.meta.preserveLoginRedirect
        ? { path: loginPath, query: { redirect: to.fullPath } }
        : { path: loginPath }
    )
  }
}

/**
 * 获取服务端路由（菜单权限）
 */
const getRoutesByServer = async (
  to: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  try {
    const hasAddedMenuRoutes = await ensureMenuRoutes(router, shouldSkipMenuFetch(to))
    if (hasAddedMenuRoutes) {
      // 按路径重新匹配，避免沿用菜单加载前命中的 error 路由名而继续显示 404。
      next({ path: to.path, query: to.query, hash: to.hash, replace: true })
      return
    }

    if (to.path !== NOT_FOUND_PATH && !shouldSkipMenuFetch(to) && !isPublicRoute(to)
      && (to.name === 'account/center' || (to.meta.security ?? RouteSecurityLevel.AUTHORIZED) === RouteSecurityLevel.AUTHORIZED)
      && useMenuStore().hasNoAccessibleMenu) {
      next(forbiddenLocation(to.query, true))
      return
    }

    next()
  } catch (error) {
    console.error('[Router] 获取服务端路由失败:', error)
    if (handleApplicationStartupError(error, to, next)) return
    next()
  }
}

/** 只在带无菜单原因的错误页冷启动时复核。普通 403 不再触发曾失败的应用准入。 */
const enterNoMenuResult = async (to: RouteLocationNormalized, next: NavigationGuardNext) => {
  const menu = useMenuStore()
  try {
    if (!menu.initialized) {
      await bootstrapSession(false)
      await ensureMenuRoutes(router, false)
    }
    if (menu.firstMenuPath) {
      const { reason, ...query } = to.query
      next({ path: menu.firstMenuPath, query, replace: true })
    } else if (menu.hasNoAccessibleMenu) {
      next()
    } else {
      next(forbiddenLocation(to.query))
    }
  } catch (error) {
    console.error('[Router] 无菜单状态复核失败:', error)
    next(forbiddenLocation(to.query))
  }
}

// 每份独立文档只承载一种会话。跨身份导航先让路由提交正确的历史记录，再整页加载。
let documentIsShare: boolean | undefined
export const changingSessionDocument = shallowRef(false)
const needsSessionDocument = (to: RouteLocationNormalized) =>
  !isSubApp && documentIsShare !== undefined && usesShareSession(to.meta) !== documentIsShare

// ============ 全局守卫 ============
router.beforeEach((to, from, next) => {
  documentIsShare ??= usesShareSession(to.meta)
  if (needsSessionDocument(to)) {
    // 目标组件不会在旧文档挂载；新文档冷启动时正常执行授权、菜单和账号初始化。
    next()
    return
  }
  // 分享授权和公开播放不继承应用 Scope，也无需装载浏览器当前账号的用户和菜单。
  if (usesShareSession(to.meta)) {
    useRouteLoadingStore().finish()
    next()
    return
  }

  const entry = getApplicationRuntimeEntry()
  const locationScope = getRouteQueryParam(window.location, APPLICATION_SCOPE_QUERY_KEY)
  const navigationScope = entry.applicationId
    ?? (locationScope === '' || isProjectApplicationScope(locationScope) ? locationScope ?? undefined : undefined)
  const applicationQuery = preserveApplicationScopeQuery(to.query, navigationScope)
  if (applicationQuery !== to.query) {
    next({ path: to.path, query: applicationQuery, hash: to.hash, replace: true })
    return
  }

  // Changing entry identity reloads the existing session/menu lifecycle, as the application switcher does.
  const targetScope = to.query[APPLICATION_SCOPE_QUERY_KEY] === null ? '' : to.query[APPLICATION_SCOPE_QUERY_KEY]
  if (typeof targetScope === 'string' && targetScope !== locationScope && from.matched.length
    && targetScope !== entry.applicationId) {
    const url = new URL(window.location.href)
    url.hash = `#${to.fullPath}`
    url.searchParams.delete(APPLICATION_SCOPE_QUERY_KEY)
    window.location.assign(url.toString())
    next(false)
    return
  }
  const routeLoading = useRouteLoadingStore()
  const reuseManualRouteLoading = Boolean(
    to.meta.routeLoadingManualFinish
    && to.name === from.name
    && to.path === from.path
  )
  // AI 编辑器会清理一次性 query；复用页面时不会重发 ready，必须沿用当前手动覆盖层。
  if (!reuseManualRouteLoading) {
    routeLoading.start(to.meta)
  }

  if (redirectLegacyProjectHash()) {
    routeLoading.finish()
    return
  }

  const token = getToken()
  if (token && isForbiddenRoute(to)) {
    if (to.query.reason === NO_MENU_REASON) return enterNoMenuResult(to, next)
    next()
    return
  }

  // 优化: 使用路由名称判断（更可靠）
  const isLoginRoute = to.name === 'Login'

  if (token) {
    if (isLoginRoute) {
      resetRouteStartupState()
      next({ path: '/' })
    } else {
      bootstrapSession(!shouldSkipMenuFetch(to))
        .then(redirected => {
          if (redirected) {
            routeLoading.finish()
            next(false)
            return
          }
          const administratorRouteRedirect = getAdministratorRouteRedirect(to)
          if (administratorRouteRedirect) {
            next(administratorRouteRedirect)
            return
          }

          const subAccountRedirect = getSubAccountRedirect(to)
          if (subAccountRedirect === false) {
            routeLoading.finish()
            return
          }
          if (subAccountRedirect) {
            next(subAccountRedirect)
            return
          }

          if (!isPublicRoute(to)) void ensureSystemBulletinSubscription(token)
          getRoutesByServer(to, next)
        })
        .catch(error => {
          console.error('[Router] 初始化会话失败:', error)
          if (error instanceof DefaultApplicationEntryError) {
            next(forbiddenLocation(to.query))
            return
          }
          if (handleApplicationStartupError(error, to, next)) return
          const administratorRouteRedirect = getAdministratorRouteRedirect(to)
          if (administratorRouteRedirect) {
            next(administratorRouteRedirect)
            return
          }

          // 初始化接口失败不代表页面无权限；继续加载菜单，让根路由仍可按实际菜单重定向。
          getRoutesByServer(to, next)
        })
    }
  } else {
    resetRouteStartupState()
    NoTokenJump(to, next, isLoginRoute)
  }
})

router.afterEach((to, _from, failure) => {
  if (!failure && needsSessionDocument(to)) {
    changingSessionDocument.value = true
    window.location.reload()
    return
  }
  if (!failure && to.name === 'Login') {
    completeLoginNavigation()
  }
  useRouteLoadingStore().finishNavigation()
})

router.onError(() => {
  useRouteLoadingStore().reset()
})


export interface JumpLoginOptions {
  reason?: LoginNavigationReason
  destination?: 'source-page'
}

const navigateToSourcePageOrLogin = (loginPath: string) => {
  const { location, history } = window
  const source = resolveLoginSourcePage(localStorage.getItem('pFrom'))
  clearLoginTransientState()

  if (!source) {
    // 保留当前入口路径，避免登录页清除独立的平台主账号会话。
    location.href = `${location.origin}${location.pathname}#${loginPath}?${LOGIN_REASON_QUERY_KEY}=${ACTIVE_LOGOUT_LOGIN_REASON}`
  } else if (source.origin === location.origin && source.pathname === location.pathname && source.search === location.search) {
    // 仅改变 hash 不会重建文档；离开旧会话时不能让当前路由接管来源页。
    history.replaceState(null, '', source.href)
    location.reload()
  } else {
    location.href = source.href
  }
}

export const jumpLogin = (options: JumpLoginOptions = {}) => {
  const currentRoute = toValue(router.currentRoute)

  // 优化: 使用新的公开路由检查
  if (isPublicRoute(currentRoute)) return

  requestLoginNavigation(options.reason || 'session-expired', (reason) => {
    const projectRuntime = isProjectRuntime()
    const projectCode = projectRuntime ? getProjectCodeFromLocation() : ''
    const runtimeConfig = getProjectRuntimeConfig()
    // 应用路径使用应用 ID；返回云平台登录时应读取会话中的真实项目域名。
    const loginProjectCode = getApplicationRuntimeEntry().type === 'application'
      ? getProjectStorage(projectCode)?.domain || ''
      : projectCode

    resetSessionStores()
    removeToken()

    if (reason === 'logout') {
      // 项目退出只删除当前项目上下文，保留同站点独立的云平台主账号会话。
      if (projectCode) {
        removeProjectStorage(projectCode)
      }
    }

    const loginRoute = coreRoutes.find(r => r.name === 'Login')
    const loginPath = loginRoute?.path || '/login'
    if (currentRoute.path !== loginPath) {
      if (reason === 'logout' && options.destination === 'source-page') {
        navigateToSourcePageOrLogin(loginPath)
        return
      }
      window.location.href = createLoginNavigationHref({
        currentPath: currentRoute.fullPath,
        isProjectRuntime: projectRuntime,
        location: window.location,
        loginPath,
        reason,
        runtimeConfig: { ...runtimeConfig, projectCode: loginProjectCode },
        origin: localStorage.getItem('pFrom')
      })
    }
  })
}

export default router
