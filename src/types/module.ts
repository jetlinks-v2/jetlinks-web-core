import type { Component } from 'vue'
import type { RouteMeta, RouteRecordRaw } from 'vue-router'
import type { DataCapabilityProviderManifest } from '../data-capability/types'
import type { ContentPanelOverrides } from './content-panel'
import type { AgentConversationProviderManifest } from '../layout/components/AiChat/agentConversationContracts'
import type { AssetDimensionFilter } from '../components/AssetOwnershipCondition/types'
import type { ObjectPresentation } from './object-presentation'

export type ModuleResourceRecord<T = unknown> = Record<string, T>

export type KnownModuleResourceType = 'apis' | 'components' | 'hooks' | 'stores' | 'utils' | 'routes' | 'dataCapabilityProviders' | 'agentConversationProviders' | 'assetDimensionFilters'
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
  agentConversationProviders?: AgentConversationProviderManifest
  assetDimensionFilters?: ModuleResourceRecord<AssetDimensionFilter>
  objectPresentations?: ModuleResourceRecord<ObjectPresentation>
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
  /**
   * 声明本模块哪些页面由布局壳层套统一 `ContentPanel`、哪些不套。
   *
   * 键为路由 `name`（菜单配的 `code`）或路由 `path`；返回的清单在项目布局下决定
   * 壳层是否包裹面板。代码侧声明，改完随代码生效，不需要重新初始化菜单。
   */
  getContentPanelOverrides?: () => ContentPanelOverrides
  /**
   * 声明本模块为业务应用提供的外壳（自带 DOM 布局与全局样式）。
   *
   * 绑定关系完全写在模块代码里，不依赖应用模板、`configuration` 或管理界面字段。
   * 命中后宿主在 `application` 运行态挂载该组件；未命中时回落默认 `ApplicationLayoutPage`。
   */
  getApplicationShell?: () => ApplicationShellDeclaration | undefined
}

/** 应用外壳匹配上下文，只在菜单已加载后求值。 */
export interface ApplicationShellContext {
  /** 当前应用运行态 ID（`getApplicationRuntimeEntry().applicationId`）。 */
  applicationId?: string
  /** 同一页面可能出现的菜单标识：菜单 code、`componentCode`、`routeName`、路由路径。 */
  hasMenu: (code: string) => boolean
}

/** 模块声明的应用外壳。 */
export interface ApplicationShellDeclaration {
  /** 外壳根组件，内部必须渲染一次页面路由出口。 */
  component: () => Promise<Component>
  /** 命中条件；缺省表示不参与自动匹配。 */
  match?: (context: ApplicationShellContext) => boolean
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
