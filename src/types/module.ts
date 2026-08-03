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

export interface MenuItem {
  icon?: string
  name: string
  i18nName?: string
  code: string
  url: string
  appId?: string
  isShow?: boolean
  buttons?: MenuButton[]
  options?: Record<string, unknown>
  meta?: RouteMeta
  children?: MenuItem[]
  component?: Component | (() => Promise<unknown>)
  id?: string
  describe?: string
  i18nDescribe?: string
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
