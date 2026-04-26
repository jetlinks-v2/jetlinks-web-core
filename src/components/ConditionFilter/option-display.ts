import type {
  ConditionFieldSchema,
  ConditionOptionDisplayFieldResolver,
  ConditionOptionDisplayFields,
} from './types'

type OptionItem = Record<string, any>

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
