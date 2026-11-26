import { assetBindingApi } from '../api/asset-binding'
import { moduleRegistry } from './module-registry'

/** 后端的真实资产来源映射，不包含维护能力或请求协议。 */
export interface AssetRelationSource {
  assetType: string
  dimensionType: string
  assetIdProperty: string
  relation: string
  source: string
}

/** 所属模块注册绑定适配器；原资产 API 始终负责授权和写入约束。 */
export interface AssetRelationBinding {
  source: string
  dimensionType: string
  relation: string
  multiple: boolean
  change: (source: AssetRelationSource, assetIds: string[], targetIds: string[], remove: boolean) => Promise<void>
}

/** 复用原资产增量接口。调用方显式声明查询角色和原接口请求角色，二者不能混用。 */
export function createAssetRelationBinding(
  options: Omit<AssetRelationBinding, 'change'> & { requestRelation?: string }
): AssetRelationBinding {
  return {
    ...options,
    change: (source, assetIds, targetIds, remove) => assetBindingApi.change(source.assetType,
      targetIds.map(targetId => ({
        assetIdList: assetIds,
        targetType: source.dimensionType,
        targetId,
        ...(!remove && options.requestRelation ? { relation: options.requestRelation } : {})
      })), remove)
  }
}

/** 同一来源有多个匹配时不依赖模块加载顺序选取；卸载后立即停止提供入口。 */
export function resolveAssetRelationBinding(source: AssetRelationSource): AssetRelationBinding | undefined {
  const matches = [...moduleRegistry.getAllModules().values()]
    .flatMap(module => module.assetRelationBindings?.[source.assetType] ?? [])
    .filter(binding => binding.source === source.source && binding.dimensionType === source.dimensionType
      && binding.relation === source.relation)
  return matches.length === 1 ? matches[0] : undefined
}

export const onAssetRelationBindingsChange = (listener: () => void) => moduleRegistry.onChange(listener)
