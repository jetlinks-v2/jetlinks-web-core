import type { RouteRecordRaw } from 'vue-router'

/** 应用容器只提供品牌与路由上下文，业务分组及叶子在同一侧栏连续展示。 */
export const applicationSidebarMenus = (menus: RouteRecordRaw[]): RouteRecordRaw[] => menus.flatMap(menu => (
  menu.meta?.applicationNavigation === 'sidebar' ? menu.children || [] : [menu]
))
