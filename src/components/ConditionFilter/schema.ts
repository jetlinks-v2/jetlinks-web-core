import type { SearchItem } from '../Search/Filter/typing'
import { getConditionFilterDefaultTermType, isArrayTermType } from '../Search/Filter/setting'
import type { ConditionFieldSchema } from './types'

/**
 * 旧 Search 可通过 isBtw 为字段扩展数组值操作符；新筛选编辑器也应使用同一判定。
 */
export const isConditionFieldArrayTermType = (field: ConditionFieldSchema['search'] | undefined, termType?: string) => {
  return isArrayTermType(termType) || Boolean(termType && field?.isBtw?.includes(termType))
}

const cloneFieldSchema = (field: ConditionFieldSchema): ConditionFieldSchema => {
  const search = field.search
  // 只收紧主键的默认条件；借用 id 的关联查询仍由业务显式配置操作符。
  const usePrimaryKeyDefaults = field.dataIndex === 'id' && (!search?.rename || search.rename === 'id')
    && !search?.termOptions?.length && !search?.termTypeOptions

  return {
    ...field,
    search: search
      ? {
          ...search,
          ...(usePrimaryKeyDefaults ? {
            termTypeOptions: getConditionFilterDefaultTermType(search.type).filter(type => type !== 'isnull' && type !== 'notnull'),
          } : {}),
          // 旧 Search 的 format 是日期组件参数；保留显式 componentProps.format 的优先级。
          componentProps: search.componentProps || search.format
            ? { ...(search.format ? { format: search.format } : {}), ...search.componentProps }
            : search.componentProps,
          optionPanel: search.optionPanel ? { ...search.optionPanel } : search.optionPanel,
        }
      : search,
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
