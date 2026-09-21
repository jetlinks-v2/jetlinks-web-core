import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { ModuleRouteOverride } from '@jetlinks-web-core/types/module'

/** Route access level */
export enum RouteSecurityLevel {
  /** Public route, no token required. */
  PUBLIC = 'public',
  /** Token required, menu permission not required. */
  AUTHENTICATED = 'authenticated',
  /** Platform administrator required. */
  ADMINISTRATOR = 'administrator',
  /** Token and menu permission required (default). */
  AUTHORIZED = 'authorized'
}

export type RouteHideInMenuContext = {
  hasResponeMenu?: boolean
}

export type RouteHideInMenuHandler = (context?: RouteHideInMenuContext) => boolean

/*
 * 页面级内容面板（是否由布局壳层套 `ContentPanel`）的声明类型见
 * `@jetlinks-web-core/types/content-panel`。
 *
 * 判断依据只来自代码侧——模块实现 `getContentPanelOverrides()` 声明自己的页面清单，
 * **不再走路由 meta**：菜单驱动的路由 meta 由后端菜单生成（`utils/menu.ts` 的 `handleMeta`），
 * 而菜单只在初始化流程推送一次，把开关放在菜单里会导致每改一个页面都要重新初始化菜单。
 */

export type RouteMenuBadgeType = 'comingSoon' | (string & {})

export interface RouteMenuBadge {
  type?: RouteMenuBadgeType
  i18nKey?: string
  text?: string
}

declare module 'vue-router' {
  interface RouteMeta {
    /** Route access level */
    security?: RouteSecurityLevel
    /** Preserve the original route when redirecting unauthenticated users to login. */
    preserveLoginRedirect?: boolean
    /** Legacy compatibility: skip menu permission check */
    skipMenuFetch?: boolean
    /** Page title */
    title?: string
    /** Whether hidden in menu */
    hideInMenu?: boolean
    /** Whether the menu item should be disabled by the menu renderer */
    disabled?: boolean
    /** Whether the menu item should use Ant Design danger style */
    danger?: boolean
    /** Small status badge rendered beside the menu title */
    menuBadge?: RouteMenuBadge
    /** Custom loading component shown from navigation start through async route resolution */
    routeLoadingComponent?: Component
    /** Keep route content mounted behind the custom loading component */
    routeLoadingOverlay?: boolean
    /** Keep the custom loading visible after navigation until the page explicitly finishes it */
    routeLoadingManualFinish?: boolean
    /** Dynamic hide condition for menu-related filtering. Return true to hide. */
    handleHideInMenuFn?: RouteHideInMenuHandler
    /** Optional class applied to the outer layout route surface. */
    layoutClassName?: string
  }
}

/** Core route configuration item */
export type CoreRouteConfig = RouteRecordRaw & {
  /** Description (debug only) */
  description?: string
}

export type { ModuleRouteOverride }

export type {
  ActionPosition,
  BaseMenuExport,
  GetResourceType,
  MenuButton,
  MenuItem,
  ModuleAsyncRoutesMap,
  ModuleConfig,
  ModuleDefinition,
  ModuleExport,
  ModuleResource,
  ModuleResourceRecord,
  ModuleResourceType,
  RegisterOptions,
  RegistryAction,
  RegistryActionComponent,
  ResolvedModuleExport,
} from '@jetlinks-web-core/types/module'
