import type { RouteRecordRaw } from 'vue-router'
import { getBaseApi, modules } from '@jetlinks-web-core/utils'
import type { RouteHideInMenuContext } from '@jetlinks-web-core/router/types'

type MicroApplicationRegistry = {
  appList: unknown[]
  findAppById: (appId: string) => { path?: string } | undefined
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

  if (!shouldShowOverrideRoute(route, context)) return null
  if (!routeMeta.title && !children.length) return null

  return {
    ...route,
    children: children.length ? children : undefined,
  }
}

export const getCoreRouteOverrideMenus = (context?: RouteHideInMenuContext) => {
  const overrideMenuMap = new Map<string, RouteRecordRaw>()

  Object.values(modules()).forEach((item: any) => {
    const moduleOverrides = item.default.getCoreRouteOverrides?.() || []
    moduleOverrides.forEach((override: RouteRecordRaw) => {
      const route = transformCoreRouteToMenu(override, context)
      if (!route) {
        overrideMenuMap.delete(override.name as string)
        return
      }
      overrideMenuMap.set(override.name as string, route)
    })
  })

  return [...overrideMenuMap.values()]
}

export const getFirstMenuPath = (routes: RouteRecordRaw[]) => {
  const findPath = (items: RouteRecordRaw[]): string | undefined => {
    for (const item of items) {
      if (item.path === '/') continue
      const childPath = item.children?.length ? findPath(item.children) : undefined
      if (childPath) return childPath
      if (!item.redirect && item.meta?.hideInMenu !== true && item.path) return item.path
    }
  }

  return findPath(routes)?.replace('/:page*', '')
}

export const prepareMicroApplicationMenus = (
  menuResult: any[],
  applicationRegistry: MicroApplicationRegistry,
) => {
  if (!applicationRegistry.appList.length) return

  const visit = (nodes: any[]) => {
    for (const node of nodes || []) {
      if (node.children?.length) visit(node.children)
      if (!node.options?.appName) continue

      const application = applicationRegistry.findAppById(node.options.appName)
      let url = application?.path
      if (url && !url.startsWith('http') && !url.startsWith('/')) url = `/${url}`
      if (url?.startsWith('/')) url = getBaseApi() + url

      const isLocal = import.meta.env.DEV && Object.values(modules()).some(module => {
        const localMenus = (module as any).default.getAsyncRoutesMap()
        return localMenus?.[node.code]
      })

      if (!isLocal) {
        node.meta = {
          appName: node.options.appName,
          appUrl: url,
        }
      }
    }
  }

  visit(menuResult)
}
