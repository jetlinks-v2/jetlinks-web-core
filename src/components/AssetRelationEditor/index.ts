import { defineAsyncComponent } from 'vue'
import { resolveAssetDimensionFilter } from '../AssetOwnershipCondition/registry'
import type { ObjectRelationMaintainer } from '../../types/object-relation'

/** 维度所属模块显式注册此维护能力；已有查询选择器不自动意味着可写。 */
export const assetRelationMaintainer: ObjectRelationMaintainer = {
  component: defineAsyncComponent(() => import('./index.vue')),
  directions: ['forward', 'reverse'],
  summary: defineAsyncComponent(() => import('./AssetRelationSummary.vue')),
  editable: (attributes) => attributes?.relation !== 'owner',
  available: (declaration, reverse) =>
    typeof declaration.dimensionType === 'string' &&
    (reverse || !!resolveAssetDimensionFilter(declaration.dimensionType)?.createSelector)
}
