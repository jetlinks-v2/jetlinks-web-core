import { request } from '@jetlinks-web/core'
import type {
  AssetBindingDetail,
  AssetBindingSettings,
  AssetRelationDeclaration
} from '../components/AssetRelationEditor/types'

async function result<T>(operation: Promise<unknown>): Promise<T> {
  const response = (await operation) as { status: number; result: T; message?: string }
  if (response.status !== 200) throw new Error(response.message || String(response.status))
  return response.result
}
const path = (...parts: string[]) => '/assets/' + parts.map(encodeURIComponent).join('/')

/** 原资产入口承担功能、资产、目标范围及授予权限校验；此处不另算有效权限。 */
export const assetBindingsApi = {
  settings: (declaration: AssetRelationDeclaration) =>
    result<AssetBindingSettings>(request.get(path('settings', declaration.assetType, declaration.dimensionType))),
  details: (declaration: AssetRelationDeclaration, assetId: string, ids: string[]) =>
    result<AssetBindingDetail[]>(
      request.post(path('bindings', declaration.assetType, assetId, declaration.dimensionType, 'target', '_query'), ids)
    ),
  bind: (
    declaration: AssetRelationDeclaration,
    drafts: Array<{ assetId: string; targetId: string; permissions: string[] }>
  ) =>
    result<void>(
      request.post(
        path('bind', declaration.assetType),
        drafts.map((row) => ({
          assetType: declaration.assetType,
          assetIdList: [row.assetId],
          targetType: declaration.dimensionType,
          targetId: row.targetId,
          permission: row.permissions,
          allPermission: false
        }))
      )
    ),
  permissions: (declaration: AssetRelationDeclaration, assetId: string, id: string, permissions: string[]) =>
    result<void>(
      request.put(path('permission', declaration.assetType, assetId, declaration.dimensionType, id), permissions)
    ),
  unbind: (declaration: AssetRelationDeclaration, assetId: string, id: string) =>
    result<void>(
      request.post(path('unbind', declaration.assetType), [
        {
          assetType: declaration.assetType,
          assetIdList: [assetId],
          targetType: declaration.dimensionType,
          targetId: id
        }
      ])
    )
}
