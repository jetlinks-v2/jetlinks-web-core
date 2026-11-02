import type { AppContext } from 'vue'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'

export interface NoticeLoginHandlerContext {
  /** 当前账号已启用的通知 provider，业务处理器只处理与自身 code 匹配的记录。 */
  topicProviders: readonly string[]
  appContext?: AppContext
  /** 业务处理完通知状态后刷新铃铛角标和列表。 */
  refresh: () => void | Promise<void>
}

export type NoticeLoginHandler = (
  context: NoticeLoginHandlerContext,
) => void | Promise<void>

/**
 * 登录后按注册顺序执行一次通知处理器。
 *
 * 单个业务处理器失败不会阻断其他 provider，也不会影响通用通知初始化。
 */
export const runRegisteredLoginNoticeHandlers = async (
  context: NoticeLoginHandlerContext,
) => {
  const providers = new Set(context.topicProviders.filter(Boolean))
  const actions = componentsRegistry.getRegistry('notification-login:handlers')
  for (const action of actions) {
    if (!providers.has(action.code)) continue
    const handler = action.props?.handler as NoticeLoginHandler | undefined
    if (typeof handler !== 'function') continue
    try {
      await handler(context)
    } catch {
      // 登录通知属于增强能力，失败时保留铃铛中的原始未读记录供用户查看。
    }
  }
}
