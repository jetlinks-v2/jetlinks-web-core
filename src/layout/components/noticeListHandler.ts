import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'

export interface NoticeListHandlerContext {
  topicProviders: readonly string[]
  defaultPageSize: number
}

export type NoticeListHandler = (
  context: NoticeListHandlerContext,
) => Promise<Record<string, any>[] | undefined>

const getProviderHandler = (provider: string) => {
  const action = componentsRegistry
    .getRegistry('notification-provider:default')
    .find(item => item.code === provider)
  const handler = action?.props?.listHandler
  return typeof handler === 'function' ? handler as NoticeListHandler : undefined
}

/** 仅当当前分组全部 provider 共用同一加载器时交给业务模块处理。 */
export const loadRegisteredNoticeList = async (
  topicProviders: string[],
  defaultPageSize: number,
) => {
  const providers = [...new Set(topicProviders.filter(Boolean))]
  if (!providers.length) return undefined

  const handlers = providers.map(getProviderHandler)
  const handler = handlers[0]
  if (!handler || handlers.some(current => current !== handler)) return undefined

  try {
    const result = await handler({
      topicProviders: providers,
      defaultPageSize,
    })
    return Array.isArray(result) ? result : undefined
  } catch {
    return undefined
  }
}
