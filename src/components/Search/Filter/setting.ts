import type { ConditionTermOption } from '../ConditionFilter/types'
import i18n from '@jetlinks-web-core/locales'

const translate = (key: string | undefined, fallback: string) => {
  if (!key) {
    return fallback
  }

  const message = i18n.global.t(key)
  return message === key ? fallback : message
}

type LocalizedTermTypeOption = ConditionTermOption & {
  labelKey?: string
  readableLabelKey?: string
  shortDescriptionKey?: string
  descriptionKey?: string
}

const createTermTypeOption = (option: LocalizedTermTypeOption): ConditionTermOption => {
  const {
    labelKey,
    readableLabelKey,
    shortDescriptionKey,
    descriptionKey,
    label,
    readableLabel,
    shortDescription,
    description,
    ...rest
  } = option

  return {
    ...rest,
    get label() {
      return translate(labelKey, label || '')
    },
    get readableLabel() {
      return translate(readableLabelKey, readableLabel || label || '')
    },
    get shortDescription() {
      return translate(shortDescriptionKey, shortDescription || '')
    },
    get description() {
      return translate(descriptionKey, description || '')
    },
  }
}

export const TermTypeOptions: ConditionTermOption[] = [
   createTermTypeOption({
      label: '=',
      value: 'eq',
      readableLabel: '为',
      shortDescription: '用于完全匹配单个值',
      description: '当字段值需要和输入值完全一致时使用。',
      readableLabelKey: 'components.SearchFilter.term.eq.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.eq.shortDescription',
      descriptionKey: 'components.SearchFilter.term.eq.description',
   }),
   createTermTypeOption({
      label: '!=',
      value: 'not',
      readableLabel: '不为',
      shortDescription: '用于排除单个精确值',
      description: '当字段值不能等于输入值时使用。',
      readableLabelKey: 'components.SearchFilter.term.not.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.not.shortDescription',
      descriptionKey: 'components.SearchFilter.term.not.description',
   }),
   createTermTypeOption({
      label: '包含',
      value: 'like',
      readableLabel: '包含',
      shortDescription: '用于匹配包含指定文本的数据',
      description: '适合名称、描述、位置等文本字段的模糊筛选。',
      labelKey: 'components.SearchFilter.term.like.label',
      readableLabelKey: 'components.SearchFilter.term.like.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.like.shortDescription',
      descriptionKey: 'components.SearchFilter.term.like.description',
   }),
   createTermTypeOption({
      label: '不包含',
      value: 'nlike',
      readableLabel: '不包含',
      shortDescription: '用于排除包含指定文本的数据',
      description: '适合从文本字段中排除带有某段内容的数据。',
      labelKey: 'components.SearchFilter.term.nlike.label',
      readableLabelKey: 'components.SearchFilter.term.nlike.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.nlike.shortDescription',
      descriptionKey: 'components.SearchFilter.term.nlike.description',
   }),
   createTermTypeOption({
      label: '>',
      value: 'gt',
      readableLabel: '大于',
      shortDescription: '用于筛选更大的数值或时间',
      description: '当字段值需要严格大于输入值时使用。',
      readableLabelKey: 'components.SearchFilter.term.gt.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.gt.shortDescription',
      descriptionKey: 'components.SearchFilter.term.gt.description',
   }),
   createTermTypeOption({
      label: '>=',
      value: 'gte',
      readableLabel: '大于等于',
      shortDescription: '用于筛选不小于指定值的数据',
      description: '当字段值需要大于或等于输入值时使用。',
      readableLabelKey: 'components.SearchFilter.term.gte.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.gte.shortDescription',
      descriptionKey: 'components.SearchFilter.term.gte.description',
   }),
   createTermTypeOption({
      label: '<',
      value: 'lt',
      readableLabel: '小于',
      shortDescription: '用于筛选更小的数值或时间',
      description: '当字段值需要严格小于输入值时使用。',
      readableLabelKey: 'components.SearchFilter.term.lt.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.lt.shortDescription',
      descriptionKey: 'components.SearchFilter.term.lt.description',
   }),
   createTermTypeOption({
      label: '<=',
      value: 'lte',
      readableLabel: '小于等于',
      shortDescription: '用于筛选不大于指定值的数据',
      description: '当字段值需要小于或等于输入值时使用。',
      readableLabelKey: 'components.SearchFilter.term.lte.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.lte.shortDescription',
      descriptionKey: 'components.SearchFilter.term.lte.description',
   }),
   createTermTypeOption({
      label: "在...之中",
      value: 'in',
      readableLabel: '属于',
      shortDescription: '用于匹配多个可选值中的任意一个',
      description: '适合状态、创建人等多选筛选场景。',
      isArray: true,
      labelKey: 'components.SearchFilter.term.in.label',
      readableLabelKey: 'components.SearchFilter.term.in.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.in.shortDescription',
      descriptionKey: 'components.SearchFilter.term.in.description',
   }),
   createTermTypeOption({
      label: "不在...之中",
      value: 'nin',
      readableLabel: '不属于',
      shortDescription: '用于排除多个可选值',
      description: '适合从多选项里排除一组不需要的数据。',
      isArray: true,
      labelKey: 'components.SearchFilter.term.nin.label',
      readableLabelKey: 'components.SearchFilter.term.nin.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.nin.shortDescription',
      descriptionKey: 'components.SearchFilter.term.nin.description',
   }),
   createTermTypeOption({
      label: "在...之间",
      value: 'btw',
      readableLabel: '处于范围',
      shortDescription: '用于筛选位于区间内的数据',
      description: '适合日期、时间、数值等范围筛选场景。',
      isArray: true,
      labelKey: 'components.SearchFilter.term.btw.label',
      readableLabelKey: 'components.SearchFilter.term.btw.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.btw.shortDescription',
      descriptionKey: 'components.SearchFilter.term.btw.description',
   }),
   createTermTypeOption({
      label: "不在...之间",
      value: 'nbtw',
      readableLabel: '不在范围',
      shortDescription: '用于排除位于区间内的数据',
      description: '适合排除某个日期段或数值段的数据。',
      isArray: true,
      labelKey: 'components.SearchFilter.term.nbtw.label',
      readableLabelKey: 'components.SearchFilter.term.nbtw.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.nbtw.shortDescription',
      descriptionKey: 'components.SearchFilter.term.nbtw.description',
   }),
   createTermTypeOption({
      label: '为空',
      value: 'isnull',
      readableLabel: '为空',
      shortDescription: '用于筛选没有填写内容的数据',
      description: '当字段值为空、未设置或没有有效内容时使用。',
      isNullary: true,
      labelKey: 'components.SearchFilter.term.isnull.label',
      readableLabelKey: 'components.SearchFilter.term.isnull.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.isnull.shortDescription',
      descriptionKey: 'components.SearchFilter.term.isnull.description',
   }),
   createTermTypeOption({
      label: '不为空',
      value: 'notnull',
      readableLabel: '不为空',
      shortDescription: '用于筛选已经填写内容的数据',
      description: '当字段值存在且有有效内容时使用。',
      isNullary: true,
      labelKey: 'components.SearchFilter.term.notnull.label',
      readableLabelKey: 'components.SearchFilter.term.notnull.readableLabel',
      shortDescriptionKey: 'components.SearchFilter.term.notnull.shortDescription',
      descriptionKey: 'components.SearchFilter.term.notnull.description',
   }),
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
