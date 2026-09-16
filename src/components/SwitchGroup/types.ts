export type SwitchGroupValue = string | number

export interface SwitchGroupOption {
  /** 选项值，需在同一个组件内唯一 */
  value: SwitchGroupValue
  /** 选项文案；使用 `option` 插槽时由插槽内容覆盖 */
  label: string
  /** 计数；不传时不渲染计数位，传 `'—'` 可保留占位 */
  count?: number | string
  /** 单独禁用当前选项 */
  disabled?: boolean
}
