import { defineStore } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import router from '@jetlinks-web-core/router'
import { cloneDeep } from 'lodash-es'
import { setParamsValue } from '@jetlinks-web/hooks'
import { onlyMessage } from '@jetlinks-web/utils'
import { handleMenus, modules, getBaseApi } from '@jetlinks-web-core/utils'
import { getOwnMenuThree } from '@jetlinks-web-core/api/system/menu'
import { getGlobModules } from '@jetlinks-web-core/router/globModules'
import { getExtraRouters } from '@jetlinks-web-core/router/extraMenu'
import type { RouteHideInMenuContext } from '@jetlinks-web-core/router/types'
import { useAuthStore, useApplication } from '@jetlinks-web-core/store'
import { OWNER_KEY } from '@jetlinks-web-core/utils/consts'
import i18n from '@jetlinks-web-core/locales'
import { useProjectRouter } from '@/hooks'
import { getProjectIdFromLocation } from '@/package'

type OptionsType = {
  params?: Record<string, any>
  query?: Record<string, any>
}

const $t = i18n.global.t

const defaultOwnParams = [
  {
    terms: [
      {
        terms: [
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
    ],
  },
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

export const useMenuStore = defineStore('menu', () => {
  const menusMap = ref<Map<string, any>>(new Map())
  const menu = ref<RouteRecordRaw[]>([])
  const siderMenus = ref<RouteRecordRaw[]>([])
  const menuResultCache = ref<any[]>([])
  const loading = ref(true)
  const hasResponeMenu = ref(false)
  const authStore = useAuthStore()
  const app = useApplication()

  const hasRouteMenu = () => {
    return !!menu.value.length
  }

  const hasMenu = (code: string) => {
    return menusMap.value.has(code)
  }

  const routerPush = (
    name: string,
    options?: OptionsType,
  ) => {
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

  }

  const jumpPage = (
    name: string,
    options?: OptionsType,
  ) => {
    if (hasMenu(name)) {
      routerPush(name, options)
    } else {
      onlyMessage($t('Home.index.010851-10'), 'warning')
      console.warn(`没有找到对应的页面: ${name}`)
    }
  }

  const createRoutes = async (menuResult: any[]) => {
    menusMap.value.clear()
    const asyncRoutes = await getGlobModules()
    const extraMenu = await getExtraRouters()

    const { menuRoutes, menuMap, menus, authButtons } = handleMenus(
      cloneDeep(menuResult),
      extraMenu,
      asyncRoutes,
    )
    const overrideMenus = getCoreRouteOverrideMenus({
      hasResponeMenu: hasResponeMenu.value,
    })
    const overrideMenuKeys = new Set(menus.map(item => item.name))
    const mergedMenus = [
      ...overrideMenus.filter(item => {
        const key = item.name
        if (overrideMenuKeys.has(key)) return false
        overrideMenuKeys.add(key)
        return true
      }),
      ...menus,
    ]
    const routerRoutes = router.getRoutes()

    const defaultRedirect = import.meta.env.VITE_DEFAULT_REDIRECT_PATH || '/account'
    const redirectUrl = menuRoutes.length ? menuRoutes[0].path : defaultRedirect
      menuRoutes.push({
        path: '/',
        redirect: redirectUrl,
      })

    routerRoutes.forEach((item: any) => {
      if (typeof item.name !== 'string' || !item.path || !item.meta?.title) return
      if (!menuMap.has(item.name)) {
        menuMap.set(item.name, { path: item.path, title: item.meta.title as string })
      }
    })

    menuRoutes.forEach(registerMenuRoute)

    menusMap.value = menuMap
    menu.value = menuRoutes
    siderMenus.value = mergedMenus
    authStore.setPermissionsAll(authButtons)
  }

  const queryMenus = async () => {
    const resp = await getOwnMenuThree({
      paging: false,
      terms: defaultOwnParams,
      sorts: [{ name: 'sortIndex', order: 'asc' }],
    })

    let menuResult = resp.result
    menuResultCache.value = JSON.parse(JSON.stringify(resp.result))

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
      hasResponeMenu.value = !!resp.result.length
      await createRoutes(menuResult)
      loading.value = false
    }
  }

  const getMenu = (name: string) => {
    return menusMap.value.get(name)
  }

  const init = () => {
    menusMap.value = new Map()
    menu.value = []
    siderMenus.value = []
    menuResultCache.value = []
    loading.value = false
  }

  return {
    menu,
    siderMenus,
    menusMap,
    loading,
    menuResultCache,
    hasResponeMenu,
    hasRouteMenu,
    hasMenu,
    jumpPage,
    routerPush,
    queryMenus,
    getMenu,
    createRoutes,
    init,
  }
})
