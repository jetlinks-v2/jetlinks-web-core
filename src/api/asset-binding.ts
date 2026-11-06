import { request } from '@jetlinks-web/core'

/** 提供方显式维护声明；不代替原绑定入口的功能权限及两端资产权限。 */
export interface AssetRelationMaintenance {
  relation: string
  requestRelation?: string | null
  bind: boolean
  unbind: boolean
}
export interface AssetBindingSettings {
  multiple: boolean
  permissionSupported: boolean
  maintenance?: AssetRelationMaintenance
}
export interface AssetBindingRequest {
  assetIdList: string[]
  targetType: string
  targetId: string
  relation?: string | null
}
const path = encodeURIComponent
async function result<T>(operation: Promise<unknown>): Promise<T> {
  const response = (await operation) as { status: number; result: T; message?: string }
  if (response.status !== 200) throw new Error(response.message || String(response.status))
  return response.result
}
export const assetBindingApi = {
  settings: (assetType: string, dimensionType: string) =>
    result<AssetBindingSettings>(request.get(`/assets/settings/${path(assetType)}/${path(dimensionType)}`)),
  change: (assetType: string, requests: AssetBindingRequest[], remove = false) =>
    result<void>(request.post(`/assets/${remove ? 'unbind' : 'bind'}/${path(assetType)}`, requests))
}
