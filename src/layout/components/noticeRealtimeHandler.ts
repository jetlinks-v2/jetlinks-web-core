import type { AppContext } from 'vue'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'

export interface NoticeRealtimeHandlerContext {
  payload: Record<string, any>
  markRead: () => Promise<void>
  refresh: () => void
  appContext?: AppContext
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
