import type { AppContext, VNode } from 'vue'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'

export interface NoticeTipOptions {
  /** 业务模块提供的提示图标，缺省时使用通知组件自身图标 */
  icon?: VNode
  title?: string
  description?: string
  onClick?: () => void
}

export interface NoticeRealtimeHandlerContext {
  payload: Record<string, any>
  markRead: () => Promise<void>
  refresh: () => void
  appContext?: AppContext
  /** realtime 表示实时到达的通知，list 表示铃铛列表里已存在的记录 */
  source: 'realtime' | 'list'
  /** 业务中立的右上角轻提示入口，只有实时到达场景由 core 提供 */
  showTip?: (options: NoticeTipOptions) => void
}

export type NoticeRealtimeHandler = (
  context: NoticeRealtimeHandlerContext,
) => boolean | Promise<boolean>

/** 让业务模块按 provider 接管实时通知展示，通用通知保持默认轻提示。 */
export const handleRegisteredRealtimeNotice = async (
  payload: Record<string, any>,
  context: Omit<NoticeRealtimeHandlerContext, 'payload'>,
) => {
  const action = componentsRegistry
    .getRegistry('notification-realtime:handlers')
    .find(item => item.code === payload.topicProvider)
  const handler = action?.props?.handler as NoticeRealtimeHandler | undefined

  if (!handler) return false
  try {
    return await handler({ payload, ...context })
  } catch {
    return false
  }
}
