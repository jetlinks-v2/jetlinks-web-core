import type { SearchItem, TermsItem } from '../Search/Filter/typing'

export type ConditionFilterField = SearchItem

export type ConditionFilterTerm = TermsItem

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
