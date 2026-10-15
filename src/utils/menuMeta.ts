import type { RouteMeta } from 'vue-router'
import type { MenuButton, MenuItem } from '@jetlinks-web-core/types/module'
import { isComingSoonMenuMeta } from './menuBadge'

export const handleMeta = (item: MenuItem, isApp: boolean): RouteMeta => {
  const _meta = {
    ...(item.options?.meta || {}),
    ...(item.meta || {})
  } as RouteMeta & { options?: Record<string, any>; routeName?: string }

  return {
    ..._meta,
    routeTarget: item.options?.routeTarget,
    id: item.id,
    icon: item.icon,
    desc: item.i18nDescribe || item.describe,
    title: item.i18nName || item.name,
    hideInMenu: _meta.hideInMenu === true || _meta.options?.show === false || item.options?.show === false, // 隐藏菜单
    isApp
  }
}

export const isRoutePlaceholderMenu = (item: MenuItem) => (
  isComingSoonMenuMeta(handleMeta(item, !!item.appId))
)

export const getMenuAliasCodes = (item: MenuItem, meta: RouteMeta) => {
  return [
    item.code,
    (meta as Record<string, any>)?.componentCode,
    item.options?.componentCode,
    (meta as Record<string, any>)?.routeName,
    item.options?.routeName
  ].filter(Boolean) as string[]
}

export const handleAuthMenu = (menuData: MenuItem[], cb: (code: string, buttons: Array<MenuButton['id']>) => void) => {
  for (const { code, buttons, children } of menuData || []) {
    if (buttons) cb(code, buttons.map(button => button.id))
    if (children) handleAuthMenu(children, cb)
  }
}
