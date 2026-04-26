import type { SearchItem } from '../Search/Filter/typing'
import type { ConditionFieldSchema } from './types'

const cloneFieldSchema = (field: ConditionFieldSchema): ConditionFieldSchema => {
  return {
    ...field,
    search: field.search
      ? {
          ...field.search,
          componentProps: field.search.componentProps ? { ...field.search.componentProps } : field.search.componentProps,
          optionPanel: field.search.optionPanel ? { ...field.search.optionPanel } : field.search.optionPanel,
        }
      : field.search,
  }
}

export const adaptSearchItemToConditionField = (item?: SearchItem): ConditionFieldSchema | undefined => {
  if (!item) {
    return undefined
  }

  return cloneFieldSchema(item)
}

export const adaptSearchItemsToConditionFields = (items: SearchItem[] = []): ConditionFieldSchema[] => {
  return items.map(item => adaptSearchItemToConditionField(item)).filter(Boolean) as ConditionFieldSchema[]
}

export const resolveConditionFields = (
  fields: ConditionFieldSchema[] = [],
  columns: SearchItem[] = [],
): ConditionFieldSchema[] => {
  if (fields.length) {
    return fields.map(cloneFieldSchema)
  }

  return adaptSearchItemsToConditionFields(columns)
}
