import type { Ref, VNode } from 'vue'

export type ConditionLogicType = 'and' | 'or'

export interface ConditionClause {
  column: string
  termType: string
  value?: any | any[]
  type?: ConditionLogicType
  key?: string
}

export interface ConditionGroup {
  terms: ConditionExpressionNode[]
  type?: ConditionLogicType
  key?: string
}

export type ConditionExpressionNode = ConditionClause | ConditionGroup

export type ConditionExpression = ConditionExpressionNode[]

export type ConditionTerm = {
  column?: ConditionClause['column']
  termType?: ConditionClause['termType']
  terms?: ConditionGroup['terms']
  value?: ConditionClause['value']
  type?: ConditionLogicType | string
  key?: string
}

export interface ConditionTermOption {
  label: string
  value: string
  readableLabel?: string
  shortDescription?: string
  description?: string
  isArray?: boolean
  isNullary?: boolean
}

export type ConditionOptionDisplayFieldResolver = string | ((item: Record<string, any>) => any)

export interface ConditionOptionDisplayFields {
  value?: ConditionOptionDisplayFieldResolver
  label?: ConditionOptionDisplayFieldResolver
  name?: ConditionOptionDisplayFieldResolver
  description?: ConditionOptionDisplayFieldResolver
  icon?: ConditionOptionDisplayFieldResolver
}

export interface ConditionFieldQuickSuggestion {
  score: number
  termType?: string
  value?: any
  description?: string
  panelKeyword?: string
}

export type ConditionFilterRouteVersion = 'v1' | 'v2' | 'v3'

export type ConditionFilterRouteTermTuple = [string, string, any, string?]

export interface ConditionFilterRouteGroupNode {
  g: ConditionFilterRouteNode[]
  t?: ConditionLogicType
}

export type ConditionFilterRouteNode = ConditionFilterRouteTermTuple | ConditionFilterRouteGroupNode

export interface ConditionOptionPanelLoadOptionsParams {
  pageIndex?: number
  pageSize?: number
}

export interface ConditionOptionPanelConfig {
  multiple?: boolean
  width?: number
  hideTitle?: boolean
  showSearch?: boolean
  showCheckAll?: boolean
  queryDebounce?: number
  pageSize?: number
  keywordPlaceholder?: string
  emptyText?: string
  hintText?: string
  optionFields?: ConditionOptionDisplayFields
  loadOptions?: (keyword?: string, params?: ConditionOptionPanelLoadOptionsParams) => Promise<any[]>
  loadSelectedOptions?: (values?: any[]) => Promise<any[]>
}

export interface ConditionFieldSchema {
  dataIndex: string
  title: string
  description?: string
  search?: ConditionFieldSearchConfig
  [key: string]: any
}

export interface ConditionFieldSearchConfig {
  type: string
  dictId?: string
  fixed?: boolean
  rename?: string
  routeAlias?: string
  matchTokens?: string[]
  defaultTermType?: string
  defaultValue?: any
  first?: boolean
  termTypeOptions?: string[]
  termOptions?: ConditionTermOption[]
  termFilter?: string[]
  components?: VNode
  componentProps?: Record<string, any>
  optionPanel?: ConditionOptionPanelConfig
  options?: any[] | Ref<any[]> | (() => Promise<any[]>)
  nestedFields?: ConditionFieldSchema[]
  nestedPlaceholder?: string
  formatValueTooltip?: (value: any, term: ConditionTerm, field: ConditionFieldSchema) => string
  resolveQuickSuggestion?: (
    keyword: string,
    field: ConditionFieldSchema,
    context: {
      options: ConditionTermOption[]
    },
  ) => ConditionFieldQuickSuggestion | undefined
  handleValue?: (value: any) => any
  handleParamsItem?: (record: Record<string, any>, params: ConditionTerm[]) => ConditionTerm
  recommendTermType?: string | ((field: ConditionFieldSchema, context: { options: ConditionTermOption[] }) => string | undefined)
  formatValuePreview?: (value: any, term: ConditionTerm, field: ConditionFieldSchema) => string
}

export type ConditionFilterField = ConditionFieldSchema

export type ConditionFilterTerm = ConditionTerm

export type ConditionFilterClause = ConditionClause

export type ConditionFilterGroup = ConditionGroup

export type ConditionFilterExpressionNode = ConditionExpressionNode

export type ConditionFilterExpression = ConditionExpression

export type ConditionFilterCommonField =
  | string
  | {
      label?: string
      value: string
    }

export interface ConditionFilterChangePayload {
  terms: ConditionFilterTerm[]
  filter: {
    terms: ConditionFilterTerm[]
  }
  where: string
}

export interface ConditionFilterExpose {
  getTerms: () => ConditionFilterTerm[]
  getFilter: () => ConditionFilterChangePayload['filter']
  getWhere: () => string
  setTerms: (terms?: ConditionFilterTerm[]) => void
  setFilter: (filter?: ConditionFilterChangePayload['filter']) => void
  setWhere: (where?: string) => void
  clear: () => void
}
