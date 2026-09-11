import type { Component } from 'vue'
import type { RouteMeta, RouteRecordRaw } from 'vue-router'
import type { DataCapabilityProviderManifest } from '../data-capability/types'

export type ModuleResourceRecord<T = unknown> = Record<string, T>

export type KnownModuleResourceType = 'apis' | 'components' | 'hooks' | 'stores' | 'utils' | 'routes' | 'dataCapabilityProviders'
export type ModuleResourceType = KnownModuleResourceType | (string & {})

export interface ModuleResource {
  moduleId: string
  apis?: ModuleResourceRecord
  components?: ModuleResourceRecord<Component>
  hooks?: ModuleResourceRecord
  stores?: ModuleResourceRecord
  utils?: ModuleResourceRecord
  routes?: ModuleResourceRecord
  dataCapabilityProviders?: DataCapabilityProviderManifest
  [resourceType: string]: ModuleResourceRecord | string | undefined
}

export type GetResourceType<T extends ModuleResourceType> =
  Extract<ModuleResource[T], ModuleResourceRecord> extends never
    ? ModuleResourceRecord
    : Extract<ModuleResource[T], ModuleResourceRecord>

export interface RegisterOptions {
  override?: boolean
  allowPartialFailure?: boolean
}

export type ModuleRouteOverride = RouteRecordRaw & {
  description?: string
}

export type ModuleAsyncRoutesMap = Record<string, Component | (() => Promise<unknown>)>

export type ModuleConfig = {
  hideHeaderRight?: boolean
  [key: string]: unknown
}

export interface ModuleDefinition {
  priority?: number
  filter?: boolean
  register?: () => void
  initPage?: () => unknown
  getConfig?: () => ModuleConfig | undefined
  getAsyncRoutesMap?: () => ModuleAsyncRoutesMap
  getExtraRoutesMap?: () => Record<string, unknown>
  getCoreRouteOverrides?: () => ModuleRouteOverride[]
  getMenuFilters?: () => MenuFilterDefinition[]
  getFilterRoutes?: () => RouteRecordRaw[]
  getRegisterComponents?: () => RegistryAction[]
}

export interface ModuleExport {
  default?: ModuleDefinition
  [key: string]: unknown
}

export interface ResolvedModuleExport extends ModuleExport {
  key: string
  name: string
  default: ModuleDefinition
}

export type MenuButton = {
  id: string
  [key: string]: unknown
}

export type MenuItemOptions = Record<string, unknown> & {
  routeName?: string
  routeTarget?: string
  show?: boolean
  meta?: RouteMeta
}

export interface MenuItem {
  icon?: string
  name: string
  i18nName?: string
  code: string
  url: string
  appId?: string
  owner?: string
  isShow?: boolean
  buttons?: MenuButton[]
  options?: MenuItemOptions
  meta?: RouteMeta
  children?: MenuItem[]
  component?: Component | (() => Promise<unknown>)
  id?: string
  sortIndex?: number
  describe?: string
  i18nDescribe?: string
}

export type MenuFilterConditions = Record<string, unknown>

export interface MenuFilterContext {
  applicationScope?: string
  conditions?: MenuFilterConditions
}

export type MenuFilter = (
  menus: MenuItem[],
  context: MenuFilterContext,
) => MenuItem[] | Promise<MenuItem[]>

export interface MenuFilterDefinition {
  code: string
  order?: number
  filter: MenuFilter
}

export type BaseMenuExport = MenuItem | MenuItem[] | (() => MenuItem | MenuItem[] | undefined)

export type ActionPosition = 'replace' | 'before' | 'after' | 'append' | 'hide'

export interface RegistryAction {
  targetPage: string
  targetModule?: string
  target?: string
  mode?: ActionPosition
  order?: number
  component?: Component
  code: string
  props?: Record<string, any>
  extraOptions?: Record<string, any>
}

export interface RegistryActionComponent extends RegistryAction {
  key: string
  props?: Record<string, any>
}
