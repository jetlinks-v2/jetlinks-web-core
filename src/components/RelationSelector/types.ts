import type { ObjectSpec, VariableObjectSpec, RelationSpec, RelationInfo, RelationObjectType } from '../../types/relation'

export interface RelationSelectorOrigin {
  key: string
  label: string
  root: Omit<VariableObjectSpec, 'related'>
}

export interface RelationSelectorOptions {
  origins: RelationSelectorOrigin[]
  /** 缺省允许任意终点；空数组表示当前调用方没有可选终点。 */
  targetTypes?: string[]
}

export interface RelationSelectorCatalog {
  types(): Promise<RelationObjectType[]>
  relations(type: string): Promise<RelationInfo[]>
}

export type RelationStep = Omit<RelationSpec, 'next'>
export type { ObjectSpec, VariableObjectSpec, RelationSpec, RelationInfo, RelationObjectType }
