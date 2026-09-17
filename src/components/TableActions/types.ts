/** 操作在表格行内或更多面板中的展示位置。 */
export type TableActionsPlacement = 'inline' | 'more'

export interface TableActionsItemProps {
  /** 常用操作在行内展示；默认收起到更多面板。 */
  common?: boolean
  /** 默认点击关闭；开关、内嵌确认等交互应设置为 false。 */
  closeOnClick?: boolean
}

export interface TableActionsItemSlotScope {
  placement: TableActionsPlacement
  /** 关闭当前实例的更多面板。 */
  close: () => void
}
