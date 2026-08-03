export type MetricCardValue = string | number

export type MetricCardIcon = string

export interface MetricCardItem {
  key?: string | number
  label: string
  value: MetricCardValue
  hint?: string
  desc?: string
  icon?: MetricCardIcon
  iconColor?: string
}
