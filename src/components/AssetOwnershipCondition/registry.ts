import { moduleRegistry } from '../../utils/module-registry'
import type { AssetDimensionFilter } from './types'

/** 复用宿主模块注册中心；冲突的维度声明不可依赖模块加载顺序覆盖。 */
export const resolveAssetDimensionFilter = (dimensionType: string): AssetDimensionFilter | undefined => {
  const matches = [...moduleRegistry.getAllModules().values()]
    .map(module => module.assetDimensionFilters?.[dimensionType])
    .filter((item): item is AssetDimensionFilter => item !== undefined)
  return matches.length === 1 ? matches[0] : undefined
}

export const onAssetDimensionFiltersChange = (listener: () => void) => moduleRegistry.onChange(listener)
