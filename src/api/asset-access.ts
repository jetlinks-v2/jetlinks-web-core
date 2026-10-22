import { request } from '@jetlinks-web/core'
import type { AssetAccessContext } from '../components/AssetOwnershipCondition/types'

const api = request as { get: (url: string) => Promise<{ result: AssetAccessContext }> }

/** 使用当前请求上下文，不清除已有 Scope；调用时机由编辑器交互或使用方控制。 */
export const getAssetAccessContext = async (assetType: string): Promise<AssetAccessContext> => {
  const response = await api.get(`/assets/access-context/${encodeURIComponent(assetType)}`)
  return response.result
}
