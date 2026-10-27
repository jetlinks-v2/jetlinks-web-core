import { onScopeDispose, watch } from 'vue'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'
import {
  changeAllStatus,
  changeStatus_api,
  getList_api,
  getUnreadSummary_api,
} from '@jetlinks-web-core/api/account/notificationRecord'
import type { CappedUnreadCount, UnreadSummary } from './noticeUtils'

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

  const result = await handler({
    topicProviders: providers,
    defaultPageSize,
  })
  return Array.isArray(result) ? result : undefined
}

export interface NoticeProviderMetadata {
  provider: string
  name: string
  type: { id: string; name: string }
}

/** 接收数据源独立于发送通道配置，普通通知继续使用原收件箱接口。 */
export interface NoticeDataSource {
  query: (params: Record<string, any>) => Promise<any>
  queryNoPaging?: (params: Record<string, any>) => Promise<any>
  count?: (params: Record<string, any>) => Promise<any>
  unreadCount: (params: Record<string, any>) => Promise<any>
  changeState: (state: '_read' | '_unread', ids: string[]) => Promise<any>
  readAll: () => Promise<any>
  /** 详情确认按钮触发已读，关闭或取消不确认。 */
  confirmOnDetail?: boolean
  subscribe?: (listener: () => void) => () => void
  subscribeRealtime?: (listener: (payload: Record<string, any>) => void) => () => void
}

const getProviderRegistration = (provider: string) => componentsRegistry
  .getRegistry('notification-provider:default')
  .find(item => item.code === provider)

export const getNoticeDataSource = (providers: readonly string[]): NoticeDataSource | undefined => {
  const unique = [...new Set(providers.filter(Boolean))]
  const source = getProviderRegistration(unique[0])?.props?.dataSource as NoticeDataSource | undefined
  return source && unique.every(provider => getProviderRegistration(provider)?.props?.dataSource === source)
    ? source
    : undefined
}

/** 订阅业务接收源变更；分类切换和组件销毁时释放旧监听。 */
export const useNoticeDataSourceChanges = (
  providers: () => readonly string[],
  listener: () => void,
) => {
  const stop = watch(
    () => [...new Set(providers().map(provider => getNoticeDataSource([provider])).filter(Boolean))],
    (sources, _previous, onCleanup) => {
      const unsubscribes = sources.map(source => source!.subscribe?.(listener))
      onCleanup(() => unsubscribes.forEach(unsubscribe => unsubscribe?.()))
    },
    { immediate: true },
  )
  onScopeDispose(stop)
}

/** 顶栏订阅各业务实时源；分类变化和卸载释放对应连接，普通通知仍用原路径。 */
export const useNoticeDataSourceRealtime = (
  providers: () => readonly string[],
  listener: (payload: Record<string, any>) => void,
) => {
  const stop = watch(
    () => [...new Set(providers().map(provider => getNoticeDataSource([provider])).filter(Boolean))],
    (sources, _previous, onCleanup) => {
      const unsubscribes = sources.map(source => source!.subscribeRealtime?.(listener))
      onCleanup(() => unsubscribes.forEach(unsubscribe => unsubscribe?.()))
    },
    { immediate: true },
  )
  onScopeDispose(stop)
}

/** 只合并接收入口的分类；订阅设置仍从真实通道读取。 */
export const mergeRegisteredNoticeProviders = (providers: NoticeProviderMetadata[]) => {
  const result = new Map(providers.map(provider => [provider.provider, provider]))
  componentsRegistry.getRegistry('notification-provider:default').forEach(action => {
    const metadata = action.props?.metadata
    if (typeof metadata === 'function') {
      const provider = metadata() as NoticeProviderMetadata
      result.set(provider.provider, provider)
    }
  })
  return [...result.values()]
}

export const queryNoticeRecords = (providers: readonly string[], params: Record<string, any>) => {
  return getNoticeDataSource(providers)?.query(params) || getList_api(params)
}

export const changeNoticeReadState = (
  providers: readonly string[],
  state: '_read' | '_unread',
  ids: string[],
) => getNoticeDataSource(providers)?.changeState(state, ids) || changeStatus_api(state, ids)

export const markNoticeProvidersRead = async (providers: readonly string[]) => {
  const unique = [...new Set(providers.filter(Boolean))]
  const ordinary = unique.filter(provider => !getNoticeDataSource([provider]))
  const sources = [...new Set(unique.map(provider => getNoticeDataSource([provider])).filter(Boolean))]
  const responses = await Promise.all([
    ...(ordinary.length ? [changeAllStatus('_read', ordinary)] : []),
    ...sources.map(source => source!.readAll()),
  ])
  return responses.find(response => response?.status !== 200) || { status: 200, success: true }
}

const withNoticeProviders = (params: Record<string, any>, providers: string[]) => ({
  ...params,
  terms: [...(params.terms || []), { column: 'topicProvider', termType: 'in', value: providers }],
})

/** 各接收源分别统计，普通收件箱排除已接管分类，避免已物化记录重复计数。 */
export const queryNoticeUnreadSummary = async (
  providers: readonly string[],
  params: Record<string, any>,
): Promise<{ status: number; success: boolean; result: UnreadSummary }> => {
  const unique = [...new Set(providers.filter(Boolean))]
  const registered = unique.filter(provider => getNoticeDataSource([provider]))
  const ordinary = unique.filter(provider => !getNoticeDataSource([provider]))
  const [defaultResponse, registeredCounts] = await Promise.all([
    ordinary.length
      ? getUnreadSummary_api(withNoticeProviders(params, ordinary))
      : Promise.resolve(undefined),
    Promise.all(registered.map(async provider => {
      const response = await getNoticeDataSource([provider])!.unreadCount(withNoticeProviders(params, [provider]))
      return { ...response.result, topicProvider: provider } as CappedUnreadCount
    })),
  ])
  const topics: CappedUnreadCount[] = [...(defaultResponse?.result?.topics || []), ...registeredCounts]
  const total = topics.reduce((sum, topic) => sum + Number(topic.count || 0), 0)
  const limit = Number(params.pageSize || 99)
  return {
    status: 200,
    success: true,
    result: {
      topics,
      total: {
        count: Math.min(total, limit),
        overflow: total > limit || topics.some(topic => topic.overflow),
      },
    },
  }
}
