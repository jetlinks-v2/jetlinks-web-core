import dayjs from 'dayjs'

const isNullishDateValue = (value: any) => {
  return value === undefined || value === null || value === ''
}

export type ConditionDateShortcutKey =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'last7Days'
  | 'thisMonth'
  | 'lastMonth'
  | 'last30Days'
  | 'thisYear'

export const getDateShortcutOptions = (t: (key: string) => string) => [
  { key: 'today' as const, label: t('components.ConditionFilter.date.today') },
  { key: 'yesterday' as const, label: t('components.ConditionFilter.date.yesterday') },
  { key: 'thisWeek' as const, label: t('components.ConditionFilter.date.thisWeek') },
  { key: 'lastWeek' as const, label: t('components.ConditionFilter.date.lastWeek') },
  { key: 'last7Days' as const, label: t('components.ConditionFilter.date.last7Days') },
  { key: 'thisMonth' as const, label: t('components.ConditionFilter.date.thisMonth') },
  { key: 'lastMonth' as const, label: t('components.ConditionFilter.date.lastMonth') },
  { key: 'last30Days' as const, label: t('components.ConditionFilter.date.last30Days') },
  { key: 'thisYear' as const, label: t('components.ConditionFilter.date.thisYear') },
]

export const getDateShortcutRange = (key: ConditionDateShortcutKey) => {
  const now = dayjs()

  switch (key) {
    case 'today':
      return [now.startOf('day'), now.endOf('day')]
    case 'yesterday': {
      const target = now.subtract(1, 'day')
      return [target.startOf('day'), target.endOf('day')]
    }
    case 'thisWeek':
      return [now.startOf('week'), now.endOf('week')]
    case 'lastWeek': {
      const target = now.subtract(1, 'week')
      return [target.startOf('week'), target.endOf('week')]
    }
    case 'last7Days':
      return [now.subtract(6, 'day').startOf('day'), now.endOf('day')]
    case 'thisMonth':
      return [now.startOf('month'), now.endOf('month')]
    case 'lastMonth': {
      const target = now.subtract(1, 'month')
      return [target.startOf('month'), target.endOf('month')]
    }
    case 'last30Days':
      return [now.subtract(29, 'day').startOf('day'), now.endOf('day')]
    case 'thisYear':
      return [now.startOf('year'), now.endOf('year')]
  }
}

export const toDayjsValue = (value: any) => {
  if (isNullishDateValue(value)) {
    return undefined
  }

  const currentValue = dayjs(value)
  return currentValue.isValid() ? currentValue : undefined
}

export const toTimestampValue = (value: any) => {
  const currentValue = toDayjsValue(value)
  return currentValue ? currentValue.valueOf() : undefined
}

export const toDayjsRangeValue = (value: any) => {
  if (!Array.isArray(value) || value.length === 0) {
    return []
  }
  return value.map(item => toDayjsValue(item))
}

export const toTimestampRangeValue = (value: any) => {
  if (!Array.isArray(value) || value.length === 0) {
    return []
  }
  return value.map(item => toTimestampValue(item))
}
