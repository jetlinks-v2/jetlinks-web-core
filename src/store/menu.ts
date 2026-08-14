import { defineStore } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import router from '@jetlinks-web-core/router'
import { setParamsValue } from '@jetlinks-web/hooks'
import { onlyMessage } from '@jetlinks-web/utils'
import {
  isFromCloud,
  isProjectRuntime,
  normalizeProjectRuntimePath,
} from '@jetlinks-web-core/utils'
import { getOwnMenuThree } from '@jetlinks-web-core/api/system/menu'
import { getGlobModules } from '@jetlinks-web-core/router/globModules'
import { getExtraRouters } from '@jetlinks-web-core/router/extraMenu'
import i18n from '@jetlinks-web-core/locales'
import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import {
  resolveMenuApplicationScope,
  getApplicationScopeFromLocation,
  isProjectApplicationScope,
  type MenuApplicationScope,
} from '@jetlinks-web-core/utils/application-scope'
import type { MenuFilterConditions } from '@jetlinks-web-core/types/module'
import { createMenuStoreRuntime } from './menuRuntime'
import { applyModuleMenuFilters } from './menuFilters'
import {
  getCoreRouteOverrideMenus,
  getFirstMenuPath,
  prepareMicroApplicationMenus,
} from './menuHelpers'
import { useApplication } from './application'
import { isSaaS } from '@/utils/consts'

type OptionsType = {
  params?: Record<string, any>
  query?: Record<string, any>
}

type ProjectMenuItem = {
    code: string
    name: string
    url: string
    icon?: string
    options?: Record<string, any>
    meta?: Record<string, any>
    children?: ProjectMenuItem[]
    [key: string]: any
}

type QueryMenusOptions = {
  applicationScope?: MenuApplicationScope
  conditions?: MenuFilterConditions
}

type QueryMenusInput = MenuApplicationScope | QueryMenusOptions

const $t = i18n.global.t

const LEGACY_PROJECT_MENU_OPTION_KEYS = ['componentCode', 'routeName', 'authCode', 'authCodes']

const getDefaultOwnParams = (): any[] => []

const isQueryMenusOptions = (value: QueryMenusInput): value is QueryMenusOptions => (
  !!value
  && typeof value === 'object'
  && !Array.isArray(value)
)

const resolveQueryMenusOptions = (
  value?: QueryMenusInput,
  conditions?: MenuFilterConditions,
): QueryMenusOptions => (
  isQueryMenusOptions(value)
    ? value
    : { applicationScope: value, conditions }
)

const resolveRequestedApplicationScope = (applicationScope: MenuApplicationScope) => (
  applicationScope === undefined ? getApplicationScopeFromLocation() : applicationScope
)

const shouldSuppressStorageApplicationScope = (applicationScope: MenuApplicationScope) => (
  applicationScope === false || isProjectApplicationScope(applicationScope)
)

/**
 * 处理侧边栏路由，生成面包屑数据
 * @param route
 * @param parent
 */
export function handleSiderBreadcrumb(route: RouteRecordRaw[], parent?: Record<string, any>): RouteRecordRaw[] {
  return route.map(item => {

    // 面包屑处理
    const breadcrumb = []
    if (parent?.breadcrumb) {
      breadcrumb.push(...parent.breadcrumb)
    }
    breadcrumb.push({ name: item.name, breadcrumbName: item.meta.title as string, path: item.path  })
    item.meta.breadcrumb = breadcrumb

    if (item.children) {
      item.children = handleSiderBreadcrumb(item.children, item?.meta)
    }
    return item
  })
}

const hasRegisteredRoute = (route: RouteRecordRaw) => {
  if (route.name) {
    return router.hasRoute(route.name)
  }

  return router.getRoutes().some(item => item.path === route.path)
}

const registerMenuRoute = (route: RouteRecordRaw) => {
  if (!route.path?.startsWith('/') || hasRegisteredRoute(route)) {
    return
  }

  return router.addRoute(route)
}

const omitLegacyProjectMenuAliases = (source?: Record<string, any>) => {
  if (!source) return source

  // 项目端菜单以服务端 code/url 为唯一入口，避免旧壳层别名继续影响组件匹配和权限映射。
  const result = { ...source }
  LEGACY_PROJECT_MENU_OPTION_KEYS.forEach(key => {
    delete result[key]
  })
  return result
}

const normalizeProjectMenuUrl = (item: any): any => ({
  ...omitLegacyProjectMenuAliases(item),
  url: typeof item.url === 'string' ? normalizeProjectRuntimePath(item.url) : item.url,
  meta: omitLegacyProjectMenuAliases(item.meta),
  options: item.options
    ? {
        ...omitLegacyProjectMenuAliases(item.options),
        meta: omitLegacyProjectMenuAliases(item.options.meta),
      }
    : item.options,
  children: item.children?.map(normalizeProjectMenuUrl),
})

const prepareRuntimeMenus = (menus: any[]) => (
  isProjectRuntime()
    ? menus.map(normalizeProjectMenuUrl)
    : menus
)

export const useMenuStore = defineStore('menu', () => {
  const app = useApplication()
    const rawMenus = ref<ProjectMenuItem[]>([])
    const projectId = ref()


  const runtime = createMenuStoreRuntime({
    getAsyncRoutes: getGlobModules,
    resolveExtraMenus: () => getExtraRouters(),
    prepareMenus: prepareRuntimeMenus,
    registerRoute: registerMenuRoute,
    routerPush: (name, options?: OptionsType) => {
      const _query = options?.query || {}
      const _params = options?.params || {}
      setParamsValue(name, _params)
      const runtimeProjectId = getProjectIdFromLocation()
      if (runtimeProjectId && !isFromCloud()) {
        // Menu navigation runs outside component setup, so use the router singleton and carry project context explicitly.
        router.push({
          name,
          params: {
            ..._params,
            projectId: _params.projectId || runtimeProjectId,
          },
          query: _query,
        })
        return
      }

      router.push({
        name,
        params: _params,
        query: _query,
      })
    },
    afterHandleMenus: (context) => {
      const overrideMenus = getCoreRouteOverrideMenus({
        hasResponeMenu: !!context.sourceMenus.length,
      })
      const overrideMenuKeys = new Set(context.menus.map(item => item.name))
      const mergedMenus = [
        ...overrideMenus.filter(item => {
          const key = item.name
          if (overrideMenuKeys.has(key)) return false
          overrideMenuKeys.add(key)
          return true
        }),
        ...context.menus,
      ]
      const routerRoutes = router.getRoutes()

      if (!router.hasRoute('saas-tenant-root')) {
        const defaultRedirect = import.meta.env.VITE_DEFAULT_REDIRECT_PATH || '/account'
        context.menuRoutes.push({
          path: '/',
          redirect: getFirstMenuPath(context.menuRoutes)
            || (isSaaS ? '/403' : defaultRedirect),
        })
      }

      routerRoutes.forEach((item: any) => {
        if (typeof item.name !== 'string' || !item.path || !item.meta?.title) return
        if (context.managedRouteNames.has(item.name)) return
        if (!context.menuMap.has(item.name)) {
          context.menuMap.set(item.name, { path: item.path, title: item.meta.title as string, routeName: item.name })
        }
      })

      context.menus = mergedMenus as RouteRecordRaw[]
    },
  })

  let menuRequestId = 0

  const queryMenus = async (
    value?: QueryMenusInput,
    conditions?: MenuFilterConditions,
  ) => {
    const requestId = ++menuRequestId
    const queryOptions = resolveQueryMenusOptions(value, conditions)
    const requestedApplicationScope = resolveRequestedApplicationScope(queryOptions.applicationScope)
    const resolvedApplicationScope = resolveMenuApplicationScope(requestedApplicationScope)
    const menuApplicationScope = shouldSuppressStorageApplicationScope(requestedApplicationScope)
      ? false
      : resolvedApplicationScope
    runtime.loading.value = true
    try {
      const resp = await getOwnMenuThree({
        paging: false,
        terms: getDefaultOwnParams(),
        sorts: [{ name: 'sortIndex', order: 'asc' }],
      }, menuApplicationScope)

      const menuResult = Array.isArray(resp.result) ? resp.result : []

      // An older response must never replace the routes and permissions of the latest application.
      if (requestId !== menuRequestId) return { applied: false }

      if (resp.success) {
        // Module filters run before route generation so filtered menus never enter routes or permissions.
        const filteredMenuResult = await applyModuleMenuFilters(menuResult, {
          applicationScope: resolvedApplicationScope,
          conditions: queryOptions.conditions,
        })
        if (requestId !== menuRequestId) return { applied: false }

        prepareMicroApplicationMenus(filteredMenuResult, app)

        const context = await runtime.createRoutes(
          filteredMenuResult,
          () => requestId === menuRequestId,
        )
        if (!context) return { applied: false }

        runtime.menuResultCache.value = JSON.parse(JSON.stringify(filteredMenuResult))
        runtime.hasResponeMenu.value = !!filteredMenuResult.length
        runtime.loading.value = false
        return {
          applied: true,
          firstMenuPath: getFirstMenuPath(context.menuRoutes),
        }
      }

      throw new Error(resp.message || 'Failed to load menus')
    } catch (error) {
      if (requestId === menuRequestId) runtime.loading.value = false
      throw error
    }
  }

  const hasOwnerMenu = (owner: string) => {
    return runtime.menuResultCache.value.some((item) => item.owner === owner)
  }

  const getOwnerMenu = (owner: string) => {
    return runtime.menuResultCache.value.find((item) => item.owner === owner)
  }

  const init = () => {
    // Logout invalidates in-flight responses so the previous account cannot repopulate this store.
    menuRequestId += 1
    runtime.init()
  }

  const jumpPage = (
    name: string,
    options?: OptionsType,
  ) => {
    const menuItem = runtime.getMenu(name)

    if (menuItem) {
      runtime.routerPush(menuItem.routeName || name, options)
    } else {
      onlyMessage($t('Home.index.010851-10'), 'warning')
      console.warn(`没有找到对应的页面: ${name}`)
    }
  }

  return {
    menu: runtime.menu,
    siderMenus: runtime.siderMenus,
    menusMap: runtime.menusMap,
    loading: runtime.loading,
    initialized: runtime.initialized,
    menuResultCache: runtime.menuResultCache,
    hasResponeMenu: runtime.hasResponeMenu,
    hasRouteMenu: runtime.hasRouteMenu,
    hasMenu: runtime.hasMenu,
    hasOwnerMenu,
    getOwnerMenu,
    jumpPage,
    routerPush: runtime.routerPush,
    queryMenus,
    getMenu: runtime.getMenu,
    createRoutes: runtime.createRoutes,
    init,
      rawMenus,
      projectId
  }
})
