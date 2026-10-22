import type { Component } from 'vue'
import type { ConditionClause, ConditionOptionPanelConfig } from '../ConditionFilter/types'

export interface AssetAccessRange {
  id: string
  name: string
  dimensionType?: string | null
  canSelectTargets: boolean
}

/** Context 只描述选择能力；普通授权、凭证上限与 Scope 仍由后端执行。 */
export interface AssetAccessContext {
  assetType: string
  controlEnabled: boolean
  ranges: AssetAccessRange[]
  scopes: Array<{ type: string; id: string; required: boolean; applied: boolean }>
}

export type AssetOwnershipTerm = ConditionClause
export type AssetDimensionOperator = 'targets' | 'notTargets' | 'bound' | 'unbound'

export interface AssetDimensionOption {
  value: string
  label: string
  children?: AssetDimensionOption[]
  disabled?: boolean
}

export interface AssetDimensionSelector {
  options?: AssetDimensionOption[]
  optionPanel?: ConditionOptionPanelConfig
  /** 自定义编辑器接收 value、options、config（封装后的 optionPanel）；通过 update:value、submit、options-change 输出。 */
  component?: Component
  componentProps?: Record<string, unknown>
}

/** 以 dimensionType 为键注册到模块的 assetDimensionFilters 资源。 */
export interface AssetDimensionFilter {
  icon?: string
  /** 说明按当前语言求值，仅影响展示。 */
  getDescription?: (assetType: string) => string
  getOperators: (assetType: string) => readonly AssetDimensionOperator[]
  /** 显式开放手动 ID 输入；不依赖目录权限，范围与最终授权仍由后端限制。 */
  allowIdInput?: boolean
  /** 支持维度闭包查询，目标 ID 仍仅提交选中节点。 */
  supportsClosure?: boolean
  createSelector?: (context: { assetType: string }) => AssetDimensionSelector
}

export interface AssetOwnershipOptions {
  assetType: string
  /** 资产 ID 或关联资产列，不从页面名或资产类型推断。 */
  column: string
  userId?: string
  /** 可选创建人目录适配；仅在 Context 允许指定对象且打开选择时调用。 */
  createCreatorSelector?: (context: { assetType: string }) => AssetDimensionSelector
  context?: AssetAccessContext
  /** 不提供时使用通用 Context API；仅在用户打开范围或恢复既有条件编辑时调用。 */
  loadContext?: () => Promise<AssetAccessContext>
  allowClear?: boolean
}

/** 仅用于编辑器草稿，查询和路由保存仍使用标准 ConditionClause。 */
export interface AssetOwnershipSelection {
  rangeId: string
  operator: AssetDimensionOperator
  ids: string[]
  closure?: boolean
}
