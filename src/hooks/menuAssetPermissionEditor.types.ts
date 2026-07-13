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
