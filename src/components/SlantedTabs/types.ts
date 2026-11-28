export type SlantedTabKey = string | number

/** 标签文案由调用方完成国际化；count 为 0 时仍显示，未提供时隐藏。 */
export interface SlantedTabOption {
  key: SlantedTabKey
  label: string
  icon?: string
  count?: string | number
  countLoading?: boolean
  disabled?: boolean
}

/** 异步数据由调用方管理，组件仅展示状态，不发起请求。 */
export interface SlantedTabsState {
  loading?: boolean
  error?: string
  emptyText?: string
}

export interface SlantedTabsProps {
  /** 按内容宽度填满轨道，长标题保留自然宽度和溢出导航。 */
  fill?: boolean
  /** 活动背景连接正文，仅补侧边界；首项直边贴合宿主外框。 */
  flush?: boolean
  size?: 'default' | 'small'
  options: SlantedTabOption[]
  activeKey?: SlantedTabKey
  /** 保留当前被禁用项的选中态；仍阻止用户选择禁用项，默认关闭。 */
  preserveDisabledActive?: boolean
  state: SlantedTabsState
}
