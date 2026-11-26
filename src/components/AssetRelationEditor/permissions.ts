import type { AssetBindingSettings } from './types'

/** 新关联和显式权限编辑沿用资产管理的必选查看规则；读取历史绑定时不调用。 */
export function assetBindingPermissions(settings?: AssetBindingSettings, permissions: string[] = []) {
  const required =
    settings?.permissionSupported && settings.permissions.some((permission) => permission.id === 'read') ? ['read'] : []
  return [...new Set([...required, ...permissions])]
}
