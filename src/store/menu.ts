import { defineStore } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import router from '@jetlinks-web-core/router'
import { setParamsValue } from '@jetlinks-web/hooks'
import { onlyMessage } from '@jetlinks-web/utils'
import {
  modules,
  getBaseApi,
  isFromCloud,
  isProjectRuntime,
  normalizeProjectRuntimePath,
} from '@jetlinks-web-core/utils'
import { getOwnMenuThree } from '@jetlinks-web-core/api/system/menu'
import { getGlobModules } from '@jetlinks-web-core/router/globModules'
import { getExtraRouters } from '@jetlinks-web-core/router/extraMenu'
import type { RouteHideInMenuContext } from '@jetlinks-web-core/router/types'
import { useApplication } from '@jetlinks-web-core/store'
import i18n from '@jetlinks-web-core/locales'
import { useProjectRouter } from '@/hooks'
import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import { createMenuStoreRuntime } from './menuRuntime'
import { OWNER_KEY } from '@/utils/consts'

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

const $t = i18n.global.t

const PROJECT_MENU_OWNER = 'cloud'
const LEGACY_PROJECT_MENU_OPTION_KEYS = ['componentCode', 'routeName', 'authCode', 'authCodes']

const getDefaultOwnParams = (): any[] => [
  {
    terms: isProjectRuntime()
      ? [
          {
            column: 'owner',
            termType: 'eq',
            value: PROJECT_MENU_OWNER,
          },
        ]
      : [
          {
            column: 'owner',
            termType: 'eq',
            value: OWNER_KEY,
          },
          {
            column: 'owner',
            termType: 'isnull',
            value: '1',
            type: 'or',
          },
        ],
  }
]

const shouldShowOverrideRoute = (
  route: RouteRecordRaw,
  context?: RouteHideInMenuContext,
): boolean => {
  const routeMeta = (route.meta || {}) as Record<string, any>

  if (typeof routeMeta.handleHideInMenuFn === 'function') {
    try {
      return routeMeta.handleHideInMenuFn(context) !== true
    } catch (error) {
      console.warn(
        `[Menu Override] Skip dynamic filter for route "${String(route.name)}", fallback to static flag.`,
        error,
      )
    }
  }

  return routeMeta.hideInMenu !== true && routeMeta?.options?.show !== false
}

const transformCoreRouteToMenu = (
  route: RouteRecordRaw,
  context?: RouteHideInMenuContext,
): RouteRecordRaw | null => {
  const routeMeta = (route.meta || {}) as Record<string, any>
  const children = (route.children || [])
    .map(item => transformCoreRouteToMenu(item, context))
    .filter(Boolean) as RouteRecordRaw[]

  if (!shouldShowOverrideRoute(route, context)) {
    return null
  }

  if (!routeMeta.title && !children.length) {
    return null
  }

  return {
    ...route,
    children: children.length ? children : undefined,
  }
}

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

const getCoreRouteOverrideMenus = (context?: RouteHideInMenuContext) => {
  const modulesFile = modules()
  const overrideMenuMap = new Map<string, RouteRecordRaw>()

  Object.values(modulesFile).forEach((item: any) => {
    const moduleOverrides = item.default.getCoreRouteOverrides?.() || []
    moduleOverrides.forEach((override: RouteRecordRaw) => {

      const _route = transformCoreRouteToMenu(override, context)
      if (!_route) {
        overrideMenuMap.delete(override.name)
        return
      }
      overrideMenuMap.set(override.name, _route)
    })
  })

  return [...overrideMenuMap.values()]
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

  router.addRoute(route)
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
      if (getProjectIdFromLocation() && !isFromCloud()) {
        const { push } = useProjectRouter()
        push({
          name,
          params: _params,
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
        hasResponeMenu: runtime.hasResponeMenu.value,
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
        const redirectUrl = context.menuRoutes.length ? context.menuRoutes[0].path : defaultRedirect
        context.menuRoutes.push({
          path: '/',
          redirect: redirectUrl,
        })
      }

      routerRoutes.forEach((item: any) => {
        if (typeof item.name !== 'string' || !item.path || !item.meta?.title) return
        if (!context.menuMap.has(item.name)) {
          context.menuMap.set(item.name, { path: item.path, title: item.meta.title as string, routeName: item.name })
        }
      })

      context.menus = mergedMenus as RouteRecordRaw[]
    },
  })

  const queryMenus = async () => {
    const resp = await getOwnMenuThree({
      paging: false,
      terms: getDefaultOwnParams(),
      sorts: [{ name: 'sortIndex', order: 'asc' }],
    })

    const menuResult = Array.isArray(resp.result) ? resp.result : []
    runtime.menuResultCache.value = JSON.parse(JSON.stringify(menuResult))

    if (app.appList.length > 0) {
      const handleMicroApp = (nodes: any[]) => {
        if (!nodes || nodes.length === 0) return

        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            handleMicroApp(node.children)
          }

          if (node.options && node.options.appName) {
            const appInfo = app.findAppById(node.options.appName)

            let url = appInfo?.path
            if (url && !url.startsWith('http') && !url.startsWith('/')) {
              url = '/' + url
            }

            if (url?.startsWith('/')) {
              url = getBaseApi() + url
            }

            let isLocal = false

            if (import.meta.env.DEV) {
              const modulesFile = modules()
              isLocal = Object.values(modulesFile).some(v => {
                const localMenus = (v as any).default.getAsyncRoutesMap()
                return localMenus?.[node.code]
              })
            }

            if (!isLocal) {
              node.meta = {
                appName: node.options.appName,
                appUrl: url,
              }
            }
          }
        }
      }

      handleMicroApp(menuResult)
    }

    if (resp.success) {
      runtime.hasResponeMenu.value = !!menuResult.length
      await runtime.createRoutes(menuResult)
      runtime.loading.value = false
    }
  }

  const hasOwnerMenu = (owner: string) => {
    return runtime.menuResultCache.value.some((item) => item.owner === owner)
  }

  const getOwnerMenu = (owner: string) => {
    return runtime.menuResultCache.value.find((item) => item.owner === owner)
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
    init: runtime.init,
      rawMenus,
      projectId
  }
})
