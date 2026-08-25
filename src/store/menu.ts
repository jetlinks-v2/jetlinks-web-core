import { defineStore } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import cloneDeep from 'lodash-es/cloneDeep'
import router from '@jetlinks-web-core/router'
import { setParamsValue } from '@jetlinks-web/hooks'
import { request } from '@jetlinks-web/core'
import { onlyMessage } from '@jetlinks-web/utils'
import {modules, getBaseApi, isFromCloud, getModulesMenu} from '@jetlinks-web-core/utils'
import { getOwnMenuThree } from '@jetlinks-web-core/api/system/menu'
import { getGlobModules } from '@jetlinks-web-core/router/globModules'
import { getExtraRouters } from '@jetlinks-web-core/router/extraMenu'
import type { RouteHideInMenuContext } from '@jetlinks-web-core/router/types'
import { useApplication } from '@jetlinks-web-core/store'
import i18n from '@jetlinks-web-core/locales'
import { useProjectRouter } from '@/hooks'
import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import { createMenuStoreRuntime } from './menuRuntime'

type OptionsType = {
  params?: Record<string, any>
  query?: Record<string, any>
}

const $t = i18n.global.t

const INTERNAL_APPLICATION_PROVIDERS = new Set(['internal-integrated', 'internal-standalone'])
const INTERNAL_APPLICATION_GROUP = 'internal_group'

const getResponseData = (response: any) => response?.result ?? response?.data ?? response

const getResponseList = (response: any): any[] => {
  const data = getResponseData(response)
  return Array.isArray(data) ? data : []
}

type EnabledMenuApplications = {
  types: Set<string>
}

const getEnabledMenuApplications = async (): Promise<EnabledMenuApplications> => {
  const applicationResponse = await request.post('/application/_query/no-paging', { paging: false })
  const serviceResponse = await request.get('/subsystem/internal/services')

  const enabledApplications = getResponseList(applicationResponse)
    .filter((item: any) => {
      const state = String(item?.state?.value || item?.status || item?.state || '')
      return state === 'enabled' && !!item?.id
    })

  const enabledMenuApplications = enabledApplications.filter((item: any) => {
    const provider = String(item?.provider || item?.type || '')
    const groupId = String(item?.configurations?.smartParkAppGroup || '')
    return groupId === INTERNAL_APPLICATION_GROUP || INTERNAL_APPLICATION_PROVIDERS.has(provider)
  })

  const applicationDetails = await Promise.all(
    enabledMenuApplications.map((item: any) =>
      request.get(`/application/${encodeURIComponent(String(item.id))}`).catch(() => undefined),
    ),
  )

  const enabledApplicationSystems = enabledMenuApplications.map((item: any, index): string => {
    const detail = getResponseData(applicationDetails[index]) || {}
    return String(
      detail?.page?.configuration?.checkedSystem ||
        detail?.configurations?.smartParkInternalSystem ||
        item?.page?.configuration?.checkedSystem ||
        item?.configurations?.smartParkInternalSystem ||
        '',
    )
  })

  const serviceTypes = new Map<string, string>()
  getResponseList(serviceResponse).forEach((item: any) => {
    const type = String(
      item?.type?.value ||
        item?.type?.id ||
        item?.type?.code ||
        item?.serviceType ||
        item?.systemType ||
        item?.type ||
        '',
    )
    const aliases = [
      item?.value,
      item?.id,
      item?.code,
      item?.name,
      item?.serviceType,
      item?.systemType,
      item?.type?.value,
      item?.type?.id,
      item?.type?.code,
      item?.type?.name,
      item?.type,
    ]
    aliases.forEach((alias) => {
      const key = String(alias || '')
      if (key && type) {
        serviceTypes.set(key, type)
      }
    })
  })

  const legacyServiceNames = new Map(
    getResponseList(serviceResponse)
      .map((item: any): [string, string] => [
        String(item?.name || ''),
        String(item?.type || ''),
      ])
      .filter(([name, type]) => name && type),
  )

  const enabledApplicationTypes = [...new Set(
    enabledApplicationSystems
      .map((configuredInternalSystem) =>
        serviceTypes.get(configuredInternalSystem) ||
        legacyServiceNames.get(configuredInternalSystem) ||
        configuredInternalSystem,
      )
      .filter((type): type is string => !!type),
  )]

  return {
    types: new Set(enabledApplicationTypes),
  }
}

const getOwnMenuParams = (types: string[]) => {
  const menuOwners = new Set(['smart-park', ...types])

  return [
    {
      terms: [
        {
          column: 'owner',
          termType: 'in',
          value: [...menuOwners],
        },
      ],
    },
  ]
}

const filterEnabledApplicationMenus = (nodes: any[] = [], enabledApplicationTypes = new Set<string>()): any[] => {
  return nodes.flatMap((node) => {
    const owner = String(node?.owner || '')
    if (owner && owner !== 'smart-park' && !enabledApplicationTypes.has(owner)) {
      return []
    }

    const sourceChildren = Array.isArray(node?.children) ? node.children : []
    const children = filterEnabledApplicationMenus(sourceChildren, enabledApplicationTypes)
    if (sourceChildren.length && !children.length) {
      return []
    }

    return [{
      ...node,
      ...(sourceChildren.length ? { children } : {}),
    }]
  })
}

const collectMenuGroupCodes = (nodes: any[] = [], codes = new Set<string>()) => {
  nodes.forEach((node) => {
    if (node?.code && Array.isArray(node.children) && node.children.length) {
      codes.add(node.code)
    }
    if (Array.isArray(node?.children) && node.children.length) {
      collectMenuGroupCodes(node.children, codes)
    }
  })
  return codes
}

const filterEmptyMenuGroups = (nodes: any[] = [], groupCodes = new Set<string>()): any[] => {
  return nodes.flatMap((node) => {
    const children = filterEmptyMenuGroups(
      Array.isArray(node?.children) ? node.children : [],
      groupCodes,
    )
    if (groupCodes.has(node?.code) && !children.length) {
      return []
    }
    return [{
      ...node,
      ...(Array.isArray(node?.children) ? { children } : {}),
    }]
  })
}

const collectMenuMap = (nodes: any[] = [], map = new Map<string, any>()) => {
  nodes.forEach((node) => {
    if (node.code) {
      map.set(node.code, node)
    }

    if (node.children?.length) {
      collectMenuMap(node.children, map)
    }
  })

  return map
}

const mergeLocalMenus = (menus: any[] = []) => {
  const map = new Map<string, any>()

  const mergeNodes = (source: any, target?: any) => {
    const current = target ? { ...target, ...source } : { ...source }
    const childMap = new Map<string, any>()

    ;(target?.children || []).forEach((item: any) => {
      if (item?.code) {
        childMap.set(item.code, cloneDeep(item))
      }
    })

    ;(source?.children || []).forEach((item: any) => {
      if (!item?.code) {
        return
      }

      const existing = childMap.get(item.code)
      childMap.set(item.code, mergeNodes(item, existing))
    })

    current.children = Array.from(childMap.values())
    return current
  }

  menus.forEach((item) => {
    if (!item?.code) {
      return
    }

    const existing = map.get(item.code)
    map.set(item.code, mergeNodes(item, existing))
  })

  return Array.from(map.values())
}

const mergeMenuOrderByRemote = (remoteMenus: any[] = [], normalizedMenus: any[] = []) => {
  const normalizedMap = new Map<string, any>()
  normalizedMenus.forEach((item) => {
    if (item?.code) {
      normalizedMap.set(item.code, item)
    }
  })

  const remoteCodes = new Set<string>()
  const mergedMenus = remoteMenus.map((item) => {
    const code = String(item?.code || '')
    if (code) {
      remoteCodes.add(code)
    }
    return (code && normalizedMap.get(code)) || item
  })

  const localOnlyMenus = normalizedMenus.filter((item) => !item?.code || !remoteCodes.has(item.code))

  return [...mergedMenus, ...localOnlyMenus]
}

const rebuildMenuTree = (localNodes: any[] = [], remoteMap = new Map<string, any>(), used = new Set<string>()) => {
  const result: any[] = []

  localNodes.forEach((localNode) => {
    if (!localNode?.code) {
      return
    }

    const remoteNode = remoteMap.get(localNode.code)
    if (remoteNode?.code) {
      used.add(remoteNode.code)
    }

    const mergedChildren = rebuildMenuTree(localNode.children || [], remoteMap, used)
    const localChildCodes = new Set((localNode.children || []).map((item: any) => item?.code).filter(Boolean))
    const remoteChildren = Array.isArray(remoteNode?.children) ? remoteNode.children : []
    const remoteExtras = remoteChildren.filter((item: any) => {
      if (!item?.code) return false
      return !localChildCodes.has(item.code) && !used.has(item.code)
    })

    remoteExtras.forEach((item: any) => {
      if (item?.code) {
        used.add(item.code)
      }
    })

    const hasLocalChildren = Array.isArray(localNode.children) && localNode.children.length > 0
    if (hasLocalChildren && !mergedChildren.length && !remoteExtras.length) {
      return
    }

    if (!remoteNode && !mergedChildren.length && !remoteExtras.length) {
      return
    }

    const mergedNode = remoteNode
      ? mergeLocalMenuNode(localNode, remoteNode)
      : cloneDeep(localNode)

    if (mergedChildren.length || remoteExtras.length) {
      mergedNode.children = [...mergedChildren, ...remoteExtras]
    }

    result.push(mergedNode)
  })

  return result
}

const mergeLocalMenuNode = (localNode: any, remoteNode: any): any => {
  const remoteChildren = Array.isArray(remoteNode.children) ? remoteNode.children : []
  const localChildren = Array.isArray(localNode.children) ? localNode.children : []
  const localChildMap = new Map(localChildren.map((item: any) => [item.code, item]))

  // 后端菜单是权限结果，本地菜单只补齐路由层级和 componentCode，避免旧菜单结构绕过本地布局。
  const children = remoteChildren.map((remoteChild: any) => {
    const localChild = localChildMap.get(remoteChild.code)
    return localChild ? mergeLocalMenuNode(localChild, remoteChild) : remoteChild
  })

  return {
    ...localNode,
    ...remoteNode,
    options: {
      ...(localNode.options || {}),
      ...(remoteNode.options || {}),
    },
    children,
  }
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
    const enabledApplications = await getEnabledMenuApplications().catch((error) => {
      console.warn('查询启用应用菜单失败:', error)
      return { types: new Set<string>() }
    })
    const resp = await getOwnMenuThree({
      paging: false,
      terms: getOwnMenuParams([...enabledApplications.types]),
      sorts: [{ name: 'sortIndex', order: 'asc' }],
    })

    const menuResult = filterEnabledApplicationMenus(
      Array.isArray(resp.result) ? resp.result : [],
      enabledApplications.types,
    )
    const localMenus = mergeLocalMenus(getModulesMenu())
    const menuGroupCodes = collectMenuGroupCodes(localMenus)
    const remoteMenuMap = collectMenuMap(menuResult)
    const normalizedMenuResult = rebuildMenuTree(localMenus, remoteMenuMap)
    const normalizedMenuMap = collectMenuMap(normalizedMenuResult)

    const mergedMenuResult = filterEmptyMenuGroups(
      filterEnabledApplicationMenus(
        mergeMenuOrderByRemote(
          menuResult,
          [
            ...normalizedMenuResult,
            ...menuResult.filter((node) => !node?.code || !normalizedMenuMap.has(node.code)),
          ],
        ),
        enabledApplications.types,
      ),
      menuGroupCodes,
    )
    runtime.menuResultCache.value = JSON.parse(JSON.stringify(mergedMenuResult))

    if (app.appList.length > 0) {
      const localMenuCodes = new Set<string>()
      const collectLocalMenuCodes = (nodes: any[] = []) => {
        nodes.forEach((node) => {
          if (node.code) {
            localMenuCodes.add(node.code)
          }
          if (node.children?.length) {
            collectLocalMenuCodes(node.children)
          }
        })
      }
      collectLocalMenuCodes(getModulesMenu())

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

            if (localMenuCodes.has(node.code)) {
              isLocal = true
            }

            if (import.meta.env.DEV) {
              const modulesFile = modules()
              isLocal = Object.values(modulesFile).some(v => {
                const localMenus = (v as any).default.getAsyncRoutesMap()
                return localMenus?.[node.code]
              }) || isLocal
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

      handleMicroApp(mergedMenuResult)
    }

    if (resp.success) {
      runtime.hasResponeMenu.value = !!mergedMenuResult.length
      await runtime.createRoutes(mergedMenuResult)
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
  }
})
