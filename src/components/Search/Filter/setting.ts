import type { ConditionTermOption } from '../ConditionFilter/types'

export const TermTypeOptions: ConditionTermOption[] = [
   {
      label: '=',
      value: 'eq',
      readableLabel: '为',
      shortDescription: '用于完全匹配单个值',
      description: '当字段值需要和输入值完全一致时使用。',
   },
   {
      label: '!=',
      value: 'not',
      readableLabel: '不为',
      shortDescription: '用于排除单个精确值',
      description: '当字段值不能等于输入值时使用。',
   },
   {
      label: '包含',
      value: 'like',
      readableLabel: '包含',
      shortDescription: '用于匹配包含指定文本的数据',
      description: '适合名称、描述、位置等文本字段的模糊筛选。',
   },
   {
      label: '不包含',
      value: 'nlike',
      readableLabel: '不包含',
      shortDescription: '用于排除包含指定文本的数据',
      description: '适合从文本字段中排除带有某段内容的数据。',
   },
   {
      label: '>',
      value: 'gt',
      readableLabel: '大于',
      shortDescription: '用于筛选更大的数值或时间',
      description: '当字段值需要严格大于输入值时使用。',
   },
   {
      label: '>=',
      value: 'gte',
      readableLabel: '大于等于',
      shortDescription: '用于筛选不小于指定值的数据',
      description: '当字段值需要大于或等于输入值时使用。',
   },
   {
      label: '<',
      value: 'lt',
      readableLabel: '小于',
      shortDescription: '用于筛选更小的数值或时间',
      description: '当字段值需要严格小于输入值时使用。',
   },
   {
      label: '<=',
      value: 'lte',
      readableLabel: '小于等于',
      shortDescription: '用于筛选不大于指定值的数据',
      description: '当字段值需要小于或等于输入值时使用。',
   },
   {
      label: "在...之中",
      value: 'in',
      readableLabel: '属于',
      shortDescription: '用于匹配多个可选值中的任意一个',
      description: '适合状态、创建人等多选筛选场景。',
      isArray: true,
   },
   {
      label: "不在...之中",
      value: 'nin',
      readableLabel: '不属于',
      shortDescription: '用于排除多个可选值',
      description: '适合从多选项里排除一组不需要的数据。',
      isArray: true,
   },
   {
      label: "在...之间",
      value: 'btw',
      readableLabel: '处于范围',
      shortDescription: '用于筛选位于区间内的数据',
      description: '适合日期、时间、数值等范围筛选场景。',
      isArray: true,
   },
   {
      label: "不在...之间",
      value: 'nbtw',
      readableLabel: '不在范围',
      shortDescription: '用于排除位于区间内的数据',
      description: '适合排除某个日期段或数值段的数据。',
      isArray: true,
   },
   {
      label: '为空',
      value: 'isnull',
      readableLabel: '为空',
      shortDescription: '用于筛选没有填写内容的数据',
      description: '当字段值为空、未设置或没有有效内容时使用。',
      isNullary: true,
   },
   {
      label: '不为空',
      value: 'notnull',
      readableLabel: '不为空',
      shortDescription: '用于筛选已经填写内容的数据',
      description: '当字段值存在且有有效内容时使用。',
      isNullary: true,
   },
]

const termTypeOptionMap = TermTypeOptions.reduce<Record<string, ConditionTermOption>>((acc, item) => {
  acc[item.value] = item
  return acc
}, {})

export const getDefaultTermType = (type: string) => {
   switch (type) {
      case 'select':
      case 'treeSelect':
         return ['eq', 'not', 'in', 'nin'];
      case 'time':
      case 'date':
         return ['gt', 'lt', 'gte', 'lte', 'btw'];
      case 'timeRange':
      case 'rangePicker':
         return ['btw', 'nbtw'];
      case 'number':
         return ['eq', 'not', 'gt', 'lt', 'gte', 'lte'];
      default:
         return ['like', 'nlike', 'eq', 'not']
   }
}

export const getConditionFilterDefaultTermType = (type: string) => {
   switch (type) {
      case 'select':
      case 'tree':
      case 'treeSelect':
         return ['in', 'nin', 'eq', 'not', 'isnull', 'notnull'];
      case 'time':
      case 'date':
         return ['btw', 'gte', 'lte', 'eq', 'isnull', 'notnull'];
      case 'timeRange':
      case 'rangePicker':
         return ['btw', 'nbtw', 'isnull', 'notnull'];
      case 'number':
         return ['eq', 'not', 'gt', 'gte', 'lt', 'lte', 'isnull', 'notnull'];
      default:
         return ['like', 'nlike', 'eq', 'not', 'isnull', 'notnull'];
   }
}

export const getTermTypeOption = (termType?: string) => {
  return termType ? termTypeOptionMap[termType] : undefined
}

export const normalizeTermTypeOption = (option: ConditionTermOption) => {
  const fallback = getTermTypeOption(option.value)

  return {
    ...fallback,
    ...option,
  }
}

export const getReadableTermTypeLabel = (termType?: string) => {
  const option = getTermTypeOption(termType)
  return option?.readableLabel || option?.label || '--'
}

export const getTermTypeShortDescription = (termType?: string) => {
  return getTermTypeOption(termType)?.shortDescription || ''
}

export const getTermTypeDescription = (termType?: string) => {
  return getTermTypeOption(termType)?.description || ''
}

export const isArrayTermType = (termType?: string): boolean => {
  const option = getTermTypeOption(termType)
  return option?.isArray ?? false
}

export const isNullaryTermType = (termType?: string): boolean => {
  const option = getTermTypeOption(termType)
  return option?.isNullary ?? false
}
