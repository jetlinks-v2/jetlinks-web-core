import type {
  ConditionFieldSchema,
  ConditionOptionDisplayFieldResolver,
  ConditionOptionDisplayFields,
} from './types'

type OptionItem = Record<string, any>

type OptionValueItem = {
  value?: unknown
  id?: unknown
  children?: OptionValueItem[]
  label?: unknown
  name?: unknown
  title?: unknown
}

/** 按原始查询值获取从根节点到目标节点的路径，保持选项树与节点标签不变。 */
export const findOptionPathByValue = (items: OptionValueItem[] = [], value: unknown): OptionValueItem[] | undefined => {
  const valueKey = String(value)

  for (const item of items) {
    if (String(item.value ?? item.id) === valueKey) {
      return [item]
    }

    if (Array.isArray(item.children)) {
      const childPath = findOptionPathByValue(item.children, value)
      if (childPath) {
        return [item, ...childPath]
      }
    }
  }

  return undefined
}

const isEmptyValue = (value: unknown) => value === undefined || value === null || value === ''

const resolveFieldValue = (item: OptionItem, resolver?: ConditionOptionDisplayFieldResolver) => {
  if (!resolver) {
    return undefined
  }

  if (typeof resolver === 'function') {
    return resolver(item)
  }

  return item?.[resolver]
}

const resolveFirstFieldValue = (item: OptionItem, resolvers: Array<ConditionOptionDisplayFieldResolver | undefined>) => {
  for (const resolver of resolvers) {
    if (!resolver) {
      continue
    }

    const value = resolveFieldValue(item, resolver)

    if (!isEmptyValue(value)) {
      return value
    }
  }

  return undefined
}

export const resolveOptionDisplayFields = (
  column?: ConditionFieldSchema,
  config?: { optionFields?: ConditionOptionDisplayFields },
) => config?.optionFields || column?.search?.optionPanel?.optionFields

export const normalizeOptionItemsByFields = (
  items: OptionItem[] = [],
  fields?: ConditionOptionDisplayFields,
): OptionItem[] => {
  return items.map((item) => {
    const value = resolveFirstFieldValue(item, [fields?.value, 'value', 'id', 'key'])
    const label = resolveFirstFieldValue(item, [fields?.label, 'label', 'text', 'title', fields?.name, 'name']) ?? value
    const name = resolveFirstFieldValue(item, [fields?.name, 'name', fields?.label, 'label', 'text', 'title']) ?? label
    const description = resolveFirstFieldValue(item, [fields?.description, 'description', 'desc', 'subtitle', 'subLabel'])
    const icon = resolveFirstFieldValue(item, [fields?.icon, 'icon'])
    const children = Array.isArray(item?.children) ? normalizeOptionItemsByFields(item.children, fields) : item?.children

    return {
      ...item,
      id: item?.id ?? value,
      value,
      label,
      name,
      description,
      icon,
      children,
    }
  })
}

export const getOptionLabelByFields = (item: OptionItem, fields?: ConditionOptionDisplayFields) => {
  return String(
    resolveFirstFieldValue(item, [fields?.label, 'label', 'text', 'title', fields?.name, 'name', 'value', 'id']) ?? '',
  )
}

export const getOptionDescriptionByFields = (item: OptionItem, fields?: ConditionOptionDisplayFields) => {
  const value = resolveFirstFieldValue(item, [fields?.description, 'description', 'desc', 'subtitle', 'subLabel'])
  return isEmptyValue(value) ? '' : String(value)
}

export const getOptionIconByFields = (item: OptionItem, fields?: ConditionOptionDisplayFields) => {
  const value = resolveFirstFieldValue(item, [fields?.icon, 'icon'])
  return isEmptyValue(value) ? '' : String(value)
}
