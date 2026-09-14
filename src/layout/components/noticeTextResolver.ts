import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'

export interface NoticeTextResolverContext {
  records: Record<string, any>[]
}

export type NoticeTextResolver = (
  context: NoticeTextResolverContext,
) => Promise<Record<string, any>[] | undefined> | Record<string, any>[] | undefined

/** 通过模块注册的通用解析器补齐通知展示文本，core 不识别具体 provider。 */
export const resolveNoticeTexts = async (
  records: Record<string, any>[],
) => {
  const handlers = componentsRegistry
    .getRegistry('notification-text:handlers')
    .map(item => item.props?.resolver)
    .filter((resolver): resolver is NoticeTextResolver => typeof resolver === 'function')

  let resolved = records
  for (const handler of handlers) {
    try {
      const next = await handler({ records: resolved })
      if (Array.isArray(next)) resolved = next
    } catch {
      // 单个业务解析失败时保留原始通知，不阻断消息中心。
    }
  }
  return resolved
}
