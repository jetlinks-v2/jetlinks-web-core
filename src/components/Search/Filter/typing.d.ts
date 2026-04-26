import type { Ref, VNode } from 'vue'


export type TermsItem = {
  column?: string
  termType?: string
  terms?: TermsItem[]
  value?: any | any[]
  type?: string
  key?: string
}

export interface SearchOptionPanelConfig {
  multiple?: boolean
  width?: number
  hideTitle?: boolean
  showSearch?: boolean
  showCheckAll?: boolean
  keywordPlaceholder?: string
  emptyText?: string
  hintText?: string
  loadOptions?: (keyword?: string) => Promise<any[]>
  loadSelectedOptions?: (values?: any[]) => Promise<any[]>
}

export interface SearchItem {
  dataIndex: string
  title: string
  search?: {
    type: string
    dictId?: string
    fixed?: boolean
    rename?: string
    defaultTermType?: string
    defaultValue?: any
    first?: boolean
    termTypeOptions?: string[]
    termOptions?: Array<{ label: string, value: string }>
    termFilter?: string[]
    components?: VNode
    componentProps?: Record<string, any>
    optionPanel?: SearchOptionPanelConfig
    options?:
      | any[]
      | Ref<any[]>
      | (() => Promise<any[]>)
    handleValue?: (value: any) => any
    handleParamsItem?: (record: Record<string, any>, params: Array<Record<string, any>>) => TermsItem
  }
}
