/** 与基础关系服务的 ObjectSpec / RelationSpec 传输结构保持一致。 */
export interface RelationSpec {
  objectType: string
  relation: string
  options?: Record<string, unknown>
  next?: RelationSpec
}

export interface ObjectSpec {
  objectType: string
  objectId?: string
  related?: RelationSpec
}

export type RelationObjectSource = { source: 'fixed'; value: string } | { source: 'upper'; upperKey: string }

export interface VariableObjectSpec extends ObjectSpec {
  objectSource?: RelationObjectSource
}

export interface RelationObjectType {
  id: string
  name: string
  i18nName?: string
  description?: string
}

export interface RelationInfo {
  relation: string
  name: string
  reverseName?: string
  reverse?: boolean
  targetType: string
}

export interface RelationObjectData extends Record<string, unknown> {
  id: string
  name?: string
  $metadata?: {
    relations?: Array<{
      relationId: string
      related: { type: string; id: string }
      reverse: boolean
      attributes?: Record<string, unknown>
    }>
  }
}

export interface RelationObjectPage {
  data: RelationObjectData[]
  total: number
}

export interface RelatedObjectQuery {
  subject: { type: string; id: string }
  relatedType: string
  relationId: string
  reverse: boolean
  query: Record<string, unknown>
}

export interface RelationObjectResult {
  type: string
  id: string
  properties?: Record<string, unknown>
}
