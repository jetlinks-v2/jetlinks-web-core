import { assetBindingsApi } from '../../api/asset-bindings'
import { relationObjectsApi } from '../../api/relation-objects'
import type { ObjectRelationContext } from '../../types/object-relation'
import type { AssetBindingDetail, AssetRelationDeclaration } from './types'

export const relatedQuery = (context: ObjectRelationContext, query: Record<string, unknown>) => ({
  subject: { type: context.subject.typeId, id: context.subject.id },
  relatedType: context.relation.targetType,
  relationId: context.relation.id,
  reverse: !!context.reverse,
  query
})

/** 草稿按当前候选对象标识；资产及维度身份只在原资产接口边界还原为规范方向。 */
export async function readBindingTargets(
  context: ObjectRelationContext,
  ids: string[]
): Promise<
  Array<{
    id: string
    assetId: string
    binding?: AssetBindingDetail
  }>
> {
  const declaration = context.maintenance as unknown as AssetRelationDeclaration
  if (!context.reverse) {
    const assetId = String(context.subject.data[declaration.assetIdProperty] ?? '')
    const bindings = await assetBindingsApi.details(declaration, assetId, ids)
    return ids.map((id) => ({ id, assetId, binding: bindings.find((row) => row.targetId === id) }))
  }
  const query = { pageIndex: 0, pageSize: 50, terms: [{ column: 'id', termType: 'in', value: ids }] }
  const [objects, related] = await Promise.all([
    relationObjectsApi.objects(context.relation.targetType, query),
    relationObjectsApi.related(relatedQuery(context, query))
  ])
  return ids.map((id) => {
    const object = objects.data.find((row) => row.id === id)
    const assetId = object?.[declaration.assetIdProperty]
    if (assetId == null || assetId === '') throw new Error('Source asset identity unavailable')
    const bound = related.data.find((row) => row.id === id)
    const link = bound?.$metadata?.relations?.find(
      (row) =>
        row.relationId === context.relation.id &&
        row.related.type === context.subject.typeId &&
        row.related.id === context.subject.id &&
        row.reverse === false
    )
    if (bound && !link) throw new Error('Source relation semantics unavailable')
    // 实例链接证明关系存在，零权限和没有角色名称的绑定同样成立。
    const attributes = link?.attributes as { relation?: string; permissions?: string[] } | undefined
    return {
      id,
      assetId: String(assetId),
      binding: link
        ? {
            targetId: context.subject.id,
            relation: attributes?.relation,
            grantedPermissions: attributes?.permissions || []
          }
        : undefined
    }
  })
}
