export type CardValue = string | number

/** 默认等宽排列；split 将显式指定的主操作放在右侧。 */
export type CardBoxActionLayout = 'equal' | 'split'
export type CardBoxActionKey = string | number
export type CardBoxActionButtonType = 'link' | 'text' | 'primary'

/** 保留既有 action 插槽的扩展字段，展示值仍由 handleFuncValue 解析。 */
export interface CardBoxAction {
  key: CardBoxActionKey
  [name: string]: unknown
  popConfirm?: {
    title?: unknown
    onConfirm?: (value: Record<string, unknown>, event: MouseEvent) => unknown
  }
  tooltip?: { title?: unknown; [name: string]: unknown }
  onClick?: (value: Record<string, unknown>, event: MouseEvent) => unknown
}

export interface CardBoxActionSlotScope extends CardBoxAction {
  isPrimary: boolean
  buttonType: CardBoxActionButtonType
}

/** 公开卡片使用的语义色，不接受业务侧直接传入色值。 */
export type CardTone = 'default' | 'info' | 'success' | 'warning' | 'error'

/** 卡片头像只描述内容和语义色，尺寸由具体卡片骨架决定。 */
export interface CardAvatarData {
  src?: string
  alt?: string
  text?: string
  icon?: string
  tone?: CardTone
}

/** 卡片状态文案及其语义色。 */
export interface CardStateData {
  text: string
  tone?: CardTone
}

/** CardSummary 的标签项。 */
export interface CardTagItem {
  key?: CardValue
  label: string
  tone?: CardTone
}

/** 卡片主体或底栏中的单个元数据项。 */
export interface CardMetaItem {
  key?: CardValue
  label?: string
  value: CardValue
  icon?: string
}

/** 推荐问题或快捷意图入口卡的数据。 */
export interface CardSuggestionData {
  title: string
  description?: string
  actionIcon?: string
}

/** 带身份信息、标签、元数据和分组底栏的摘要卡数据。 */
export interface CardSummaryData {
  title: string
  subtitle?: string
  description?: string
  avatar?: CardAvatarData
  status?: CardStateData
  tags?: CardTagItem[]
  meta?: CardMetaItem[]
  footer?: CardMetaItem[]
  footerActionIcon?: string
}

/** 状态优先的纵向摘要卡数据。 */
export interface CardStatusData {
  title: string
  description?: string
  avatar?: CardAvatarData
  status?: CardStateData
  footer?: CardMetaItem[]
}

/** CardStatistic 环图及图例中的单个分段。 */
export interface CardStatisticSegment {
  key?: CardValue
  label: string
  value: number
  tone?: CardTone
}

/** 指标值、占比环和图例卡的数据。 */
export interface CardStatisticData {
  label: string
  value: CardValue
  unit?: string
  segments?: CardStatisticSegment[]
}

/** 带独立开关状态的可选卡数据。 */
export interface CardToggleData {
  value: string
  title: string
  subtitle?: string
  extra?: string
  avatar?: CardAvatarData
  actionIcon?: string
}
