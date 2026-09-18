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

/**
 * 布局级页面内容面板配置。
 *
 * **只在项目布局生效**（见 `CONTENT_PANEL_LAYOUT_VARIANTS`）；租户端与应用端壳层不解析本配置。
 * 项目布局下未声明时由 `DEFAULT_CONTENT_PANEL_ENABLED` 决定是否包裹；
 * 显式 `false` 等价于 `{ enabled: false }`。
 */
export interface RouteContentPanelMeta {
  /** `false` 表示布局壳层不包裹面板，由页面自绘背景。 */
  enabled?: boolean
  /** 覆盖面板内边距，单位为 px。 */
  padding?: number
  /** 面板标题。 */
  title?: string
  /** `false` 保留面板留白与圆角，但背景透明、去掉模糊与阴影。 */
  background?: boolean
}

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
    /** 布局级内容面板配置；取值按 `route.matched` 由深到浅第一条命中的记录生效。 */
    contentPanel?: boolean | RouteContentPanelMeta
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
