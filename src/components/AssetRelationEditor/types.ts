export interface AssetRelationDeclaration {
  provider: string
  assetType: string
  assetIdProperty: string
  dimensionType: string
}
export interface AssetBindingSettings {
  multiple: boolean
  permissionSupported: boolean
  permissions: Array<{ id: string; name: string }>
}
export type AssetBindingPopupKind = 'permissions' | 'actions'
export interface AssetBindingDetail {
  targetId: string
  relation?: string
  grantedPermissions: string[]
}
export interface AssetBindingDraft {
  id: string
  /** 候选对象ID与资产ID可不同；写入始终使用来源声明的资产身份。 */
  assetId?: string
  permissions: string[]
  resolved?: boolean
  original?: AssetBindingDetail
  /** 只标记待解除；统一确认后才写入，不删除未加载的其他绑定。 */
  removed?: boolean
}
