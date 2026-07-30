import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { ModuleRouteOverride } from '@jetlinks-web-core/types/module'

/** Route access level */
export enum RouteSecurityLevel {
  /** Public route, no token required. */
  PUBLIC = 'public',
  /** Token required, menu permission not required. */
  AUTHENTICATED = 'authenticated',
  /** Token and menu permission required (default). */
  AUTHORIZED = 'authorized'
}

export type RouteHideInMenuContext = {
  hasResponeMenu?: boolean
}

export type RouteHideInMenuHandler = (context?: RouteHideInMenuContext) => boolean

declare module 'vue-router' {
  interface RouteMeta {
    /** Route access level */
    security?: RouteSecurityLevel
    /** Legacy compatibility: skip menu permission check */
    skipMenuFetch?: boolean
    /** Page title */
    title?: string
    /** Whether hidden in menu */
    hideInMenu?: boolean
    /** Custom loading component shown from navigation start through async route resolution */
    routeLoadingComponent?: Component
    /** Dynamic hide condition for menu-related filtering. Return true to hide. */
    handleHideInMenuFn?: RouteHideInMenuHandler
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
