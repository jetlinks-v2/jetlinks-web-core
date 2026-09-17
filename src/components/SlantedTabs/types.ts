export type SlantedTabKey = string | number

/** 标签文案由调用方完成国际化；count 为 0 时仍显示，未提供时隐藏。 */
export interface SlantedTabOption {
  key: SlantedTabKey
  label: string
  count?: string | number
  disabled?: boolean
}

/** 异步数据由调用方管理，组件仅展示状态，不发起请求。 */
export interface SlantedTabsState {
  loading?: boolean
  error?: string
  emptyText?: string
}

export interface SlantedTabsProps {
  options: SlantedTabOption[]
  activeKey?: SlantedTabKey
  state: SlantedTabsState
}
