import type { ComputedRef, Ref } from 'vue'

export interface MenuPermissionButton {
  id: string
  name?: string
  i18nName?: string
  granted?: boolean
  [key: string]: any
}

export interface MenuPermissionNode {
  id: string
  code?: string
  owner?: string
  parentId?: string
  name?: string
  i18nName?: string
  granted?: boolean
  _granted?: boolean
  indeterminate?: boolean
  children?: MenuPermissionNode[] | null
  buttons?: MenuPermissionButton[]
  actions?: MenuPermissionButton[]
  assetTypes?: unknown
  assetType?: unknown
  assetAccesses?: Record<string, any>[]
  [key: string]: any
}

export interface GrantableAssetSupport {
  supportId: string
  name?: string
  i18nName?: string
  disabled?: boolean
  [key: string]: any
}

export interface GrantableAssetType {
  assetType: string
  name?: string
  accesses: GrantableAssetSupport[]
}

export interface AssetTypeName {
  id: string
  name: string
}

export interface AssetAccessPolicy {
  assetType: string
  accesses: Array<{ supportId: string; [key: string]: any }>
}

export interface VisibleAssetPermission extends GrantableAssetType {
  selectedSupportId?: string
}

export interface MenuAssetPermissionSnapshot {
  menus: MenuPermissionNode[]
  assetAccesses: AssetAccessPolicy[]
}

export interface MenuAssetPermissionResetOptions {
  menus: MenuPermissionNode[]
  grantedMenus?: MenuPermissionNode[]
  assetAccesses?: AssetAccessPolicy[]
  grantableAssets?: GrantableAssetType[]
  assetTypes?: AssetTypeName[]
  /** 仅约束展示和编辑范围，未列出的原始菜单仍保留在授权草稿中。 */
  menuGroups?: MenuPermissionGroupDefinition[]
}

export interface MenuPermissionScope {
  id: string
  buttonIds: string[]
}

/** 同一菜单可属于多个分组；菜单和按钮仍共享一份真实授权状态。 */
export interface MenuPermissionGroupDefinition {
  key: string
  label: string
  /** 限制投影节点的 owner；其他 owner 的祖先只保留在原始授权树。 */
  visibleOwner?: string
  menus: MenuPermissionScope[]
}

export interface MenuOwnerGroup {
  key: string
  label: string
  menus: MenuPermissionNode[]
}

export interface SelectionState {
  checked: boolean
  indeterminate: boolean
}

export interface MenuAssetPermissionEditorContext {
  menuTree: Ref<MenuPermissionNode[]>
  flatMenus: ComputedRef<MenuPermissionNode[]>
  ownerGroups: ComputedRef<MenuOwnerGroup[]>
  /** 显式分组即使只有一组也显示名称，普通 owner 分组保留原来的单组隐藏行为。 */
  showMenuGroups?: ComputedRef<boolean>
  visibleAssets: ComputedRef<VisibleAssetPermission[]>
  batchAssetOptions: ComputedRef<Array<{ label: string; value: string }>>
  batchAssetValue: ComputedRef<string | undefined>
  actionOptions: ComputedRef<Array<{ label: string; value: string }>>
  buttonBatchValues: Ref<string[]>
  loading: Ref<boolean>
  reset: (options: MenuAssetPermissionResetOptions) => void
  toggleMenu: (menu: MenuPermissionNode, checked: boolean) => void
  toggleButton: (menu: MenuPermissionNode, button: MenuPermissionButton, checked: boolean) => void
  setMenusChecked: (menus: MenuPermissionNode[], checked: boolean) => void
  getActionOptions: (menus?: MenuPermissionNode[]) => Array<{ label: string; value: string }>
  applyButtonBatch: (buttonIds: string[], menus?: MenuPermissionNode[]) => void
  setAssetAccess: (assetType: string, supportId?: string) => void
  applyAssetBatch: (supportId?: string) => void
  getSelectionState: (menus: MenuPermissionNode[]) => SelectionState
  isProtectedMenu: (menu: MenuPermissionNode) => boolean
  isProtectedButton: (menu: MenuPermissionNode, button: MenuPermissionButton) => boolean
  getSnapshot: () => MenuAssetPermissionSnapshot
}
