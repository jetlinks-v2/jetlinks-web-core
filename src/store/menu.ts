import { defineStore } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import router from '@jetlinks-web-core/router'
import { setParamsValue } from '@jetlinks-web/hooks'
import { onlyMessage } from '@jetlinks-web/utils'
import { modules, getBaseApi } from '@jetlinks-web-core/utils'
import { getOwnMenuThree } from '@jetlinks-web-core/api/system/menu'
import { getGlobModules } from '@jetlinks-web-core/router/globModules'
import { getExtraRouters } from '@jetlinks-web-core/router/extraMenu'
import type { RouteHideInMenuContext } from '@jetlinks-web-core/router/types'
import { useApplication } from '@jetlinks-web-core/store'
import { OWNER_KEY } from '@jetlinks-web-core/utils/consts'
import i18n from '@jetlinks-web-core/locales'
import { useProjectRouter } from '@/hooks'
import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import { createMenuStoreRuntime } from './menuRuntime'

type OptionsType = {
  params?: Record<string, any>
  query?: Record<string, any>
}

const $t = i18n.global.t

const defaultOwnParams: any[] = []

const filterRuntimeOwnerMenus = (menus: any[] = []) => {
  return menus.filter((item) => {
    return item.owner === OWNER_KEY || item.owner == null
  })
}

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

export const useMenuStore = defineStore('menu', () => {
  const app = useApplication()
  const runtime = createMenuStoreRuntime({
    getAsyncRoutes: getGlobModules,
    resolveExtraMenus: () => getExtraRouters(),
    registerRoute: registerMenuRoute,
    routerPush: (name, options?: OptionsType) => {
      const _query = options?.query || {}
      const _params = options?.params || {}
      setParamsValue(name, _params)
      if (getProjectIdFromLocation()) {
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

      const defaultRedirect = import.meta.env.VITE_DEFAULT_REDIRECT_PATH || '/account'
      const redirectUrl = context.menuRoutes.length ? context.menuRoutes[0].path : defaultRedirect
      context.menuRoutes.push({
        path: '/',
        redirect: redirectUrl,
      })

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
      terms: defaultOwnParams,
      sorts: [{ name: 'sortIndex', order: 'asc' }],
    })

    let menuResult = resp.result
    runtime.menuResultCache.value = JSON.parse(JSON.stringify(resp.result))

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
      runtime.hasResponeMenu.value = !!resp.result.length
      await runtime.createRoutes(filterRuntimeOwnerMenus(menuResult))
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
  }
})
