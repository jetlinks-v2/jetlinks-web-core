import type { RouteMeta } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { isSubApp, OpenMicroApp, USER_CENTER_MENU_CODE } from '@jetlinks-web-core/utils/consts'
import router from '../router'

type Buttons = Array<{ id: string }>

type MenuItem = {
  icon: string
  name: string
  i18nName: string
  code: string
  url: string
  appId?: string
  isShow?: boolean
  buttons?: Buttons
  options?: Record<string, any>
  meta?: RouteMeta
  children?: MenuItem[]
  component?: any
  id?: string
  describe?: string
  i18nDescribe?: string
}

type BreadcrumbType = {
  name: string
  breadcrumbName: string
  path: string
}

type ParentType = {
  code: string
  title: string
  breadcrumb?: BreadcrumbType[] | any[]
}

type MenuMapValue = {
  path: string
  title: string
  routeName?: string
}

const handleMeta = (item: MenuItem, isApp: boolean): RouteMeta => {
  const _meta = {
    ...(item.options?.meta || {}),
    ...(item.meta || {})
  } as RouteMeta & { options?: Record<string, any>; routeName?: string }

  return {
    ..._meta,
    id: item.id,
    icon: item.icon,
    desc: item.i18nDescribe || item.describe,
    title: item.i18nName || item.name,
    hideInMenu: _meta.hideInMenu === true || _meta.options?.show === false || item.options?.show === false, // 隐藏菜单
    isApp
  }
}

export const handleRoute = (item: MenuItem, parent?: ParentType): Partial<RouteRecordRaw> => {
  const isApp = !!item.appId
  const meta = handleMeta(item, isApp)
  const appUrl = `/${item.appId}${item.url}`

  // 面包屑处理
  const breadcrumb: Array<BreadcrumbType> = []
  if (parent?.breadcrumb) {
    breadcrumb.push(...parent.breadcrumb)
  }
  breadcrumb.push({ name: item.code, breadcrumbName: meta.title as string, path: isApp ? appUrl : item.url })

  return {
    path: isApp ? appUrl : item.url,
    name: isApp ? appUrl : (meta as Record<string, any>)?.routeName || item.options?.routeName || item.code,
    meta: {
      ...meta,
      breadcrumb
    }
  }
}

const getMenuAliasCodes = (item: MenuItem, meta: RouteMeta) => {
  return [
    item.code,
    (meta as Record<string, any>)?.componentCode,
    item.options?.componentCode,
    (meta as Record<string, any>)?.routeName,
    item.options?.routeName
  ].filter(Boolean) as string[]
}

/**
 *
 * @param menuData 服务端菜单数据
 * @param extraMenus 额外菜单数据，比如详情页，新增页
 * @param components 扫描出来的页面
 * @param level
 */
export const handleMenus = (
  menuData: MenuItem[],
  extraMenus: any,
  components: Record<string, any>,
  level: number = 1
) => {
  const filterMenuCode = [USER_CENTER_MENU_CODE]
  const menuMap = new Map<string, MenuMapValue>() //
  let authButtons: Record<string, any> = {}
  let menuRoutes: RouteRecordRaw[] = []
  let menus: Partial<RouteRecordRaw>[] = []

  /**
   * 过滤不需要生成路由的菜单数据
   * @param data
   */
  const filterMenuData = (data: MenuItem[] = []) => {
    return data.filter((item) => !filterMenuCode.includes(item.code))
  }

  const findComponent = (record: MenuItem, level: number) => {
    const isApp = !!record.appId
    const meta = handleMeta(record, isApp)
    const myComponents = components[(meta?.componentCode as string) || record.code]

    if (record.component) {
      return record.component
    }

    if (!record.children?.length) {
      if (meta?.appName && meta?.appUrl && OpenMicroApp) {
        return () => import('../views/mirco/SubAppRedirect/base.vue')
      }

      if (record.appId) {
        return () => import('../layout/Iframe.vue')
      }
    }

    if (myComponents) {
      return () => myComponents()
    }

    if (level === 1) {
      return () => import('../layout/BasicLayoutPage.vue')
    }

    if (level === 2) {
      return () => import('../layout/BlankLayoutPage.vue')
    }

    return undefined
  }

  const getExtraChildren = (item: MenuItem) => {
    const menu = extraMenus[item.code]

    if (!menu) return

    const routes = Array.isArray(menu) ? menu : menu.children

    return routes?.map((e: any) => {
      const meta: RouteMeta = {
        ...(e.options?.meta || {}),
        ...(e.meta || {}),
        title: e.i18nName || e.name,
        hideInMenu: true,
        options: {
          ...(e.options?.meta?.options || {}),
          ...(e.meta?.options || {}),
          show: false
        }
      }
      return {
        ...e,
        code: `${item.code}/${e.code}`,
        url: `${item.url}${e.url}`,
        meta
      }
    })
  }

  function loop(data: MenuItem[], level: number = 1, parent?: ParentType): RouteRecordRaw[] {
    const _menu = filterMenuData(data)
    const _routes = []

    for (let i = _menu.length; i > 0; i--) {
      const item = _menu[i - 1]

      const _route = handleRoute(item, parent)
      const myComponent = findComponent(item, level)

      const menuInfo = {
        path: _route.path!,
        title: _route.meta?.title as string,
        routeName: _route.name as string
      }
      getMenuAliasCodes(item, _route.meta as RouteMeta).forEach(code => {
        menuMap.set(code, menuInfo)
      })
      _route.component = myComponent

      if (level === 1 && components[item.code]) {
        // 1级菜单，并且是页面
        // 为1级菜单添加父级路由
        _route.name = `${item.code}-parent`
        _route.path = `${item.url}/parent`
        _route.component = () => import('../layout/BasicLayoutPage.vue')
        _route.children = [item]
        _route.meta = {}
      } else {
        const extraRoute = getExtraChildren(item) || []
        if (extraRoute?.length) {
          const result = loop(extraRoute, level + 1, {
            code: item.code,
            title: _route.meta?.title as string,
            breadcrumb: _route.meta?.breadcrumb as BreadcrumbType[]
          })
          _routes.push(...result)
        }
        _route.children = item.children
      }

      if (_route.children && _route.children.length) {
        _route.children = loop(_route.children, level + 1, {
          code: item.code,
          title: _route.meta?.title as string,
          breadcrumb: _route.meta?.breadcrumb as BreadcrumbType[]
        })
      }

      const showChildren = _route.children?.filter((item) => !item.meta?.hideInMenu) || []

      if (showChildren.length) {
        _route.redirect = showChildren[0].path.replace('/:page*', '')
      }

      const itemMeta = handleMeta(item, !!item.appId)

      if (itemMeta?.appName && itemMeta?.appUrl) {
        _route.path = `${item.url}/:page*`
      }

      _routes.unshift(_route as RouteRecordRaw)
    }
    return _routes
  }

  function siderLoop(data: MenuItem[]) {
    const _menu = filterMenuData(data).filter((item) => !handleMeta(item, !!item.appId).hideInMenu)
    for (const menuItem of data) {
      if (menuItem.buttons) {
        authButtons[menuItem.code] = menuItem.buttons.map((item) => item.id)
      }
    }

    if (_menu && _menu.length) {
      return _menu.map((item) => {
        const _route = handleRoute(item)
        _route.children = siderLoop(item.children || [])
        return _route as RouteRecordRaw
      })
    }
    return []
  }

  menus = siderLoop(menuData)

  menuRoutes = loop(menuData, level)

  return {
    menuMap,
    menus,
    menuRoutes,
    authButtons
  }
}

export const handleAuthMenu = (menuData: MenuItem[], cb: (code: string, buttons: Array<string>) => void) => {
  if (menuData && menuData.length) {
    return menuData.forEach((item) => {
      const { code, buttons, children } = item

      if (buttons) {
        cb(
          code,
          buttons.map((a) => a.id)
        )
      }

      if (children) {
        handleAuthMenu(children, cb)
      }
    })
  }
}

export const routerFallback = () => {
  if (window.history.state.back && window.history.length > 1) {
    router.go(-1)
  } else {
    const meta = router.currentRoute.value.meta
    const breadcrumb = meta.breadcrumb as Array<Record<string, any>>
    if (breadcrumb.length > 1) {
      const item = breadcrumb[breadcrumb.length - 2]
      router.push(item.path)
    }
  }
}
