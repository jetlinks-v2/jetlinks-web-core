import type { Router } from 'vue-router'
import { getToken } from '@jetlinks-web/utils'
import { getAllNotice } from '@jetlinks-web-core/api/account/center'
import {
  getNoticeList_api,
  save_api,
  SYSTEM_BULLETIN_PROVIDER,
  type SubscriptionState,
} from '@jetlinks-web-core/api/account/notificationSubscription'
import {
  useApplication,
  useAuthStore,
  useBusinessApplicationStore,
  useMenuStore,
  useSystemStore,
  useUserStore,
} from '@jetlinks-web-core/store'
import { isBusinessApplicationRuntime } from '@jetlinks-web-core/utils/business-application-runtime'
import { getApplicationRuntimeEntry } from '@jetlinks-web-core/utils/project-runtime'
import { ApplicationEntryUnavailableError } from '@jetlinks-web-core/utils/application-scope'
import { isSubApp, OpenMicroApp } from '@jetlinks-web-core/utils/consts'
import { enterDefaultApplication, initializeBusinessApplicationEntry } from './default-entry'

type StateField = SubscriptionState | { value?: SubscriptionState }
interface BulletinTopic {
  id: string
  name: string
  provider: string
  state?: StateField
  channels?: Array<{ id: string; channelProvider: string; state?: StateField }>
}
interface BulletinSubscription {
  id: string
  topicProvider: string
  providerId?: string
  subscribeName?: string
  state?: StateField
  locale?: string
  notifyChannels?: string[]
}

const insideMail = 'inside-mail'
const stateOf = (state?: StateField) => typeof state === 'string' ? state : state?.value

let menuRoutePromise: Promise<boolean> | undefined
let bulletinSubscriptionCheck: { token: string; userId: string; controller: AbortController } | undefined

/** 合并同一会话的路由检查，会话变化或请求失败后允许重新确认。 */
export const ensureSystemBulletinSubscription = (token: string) => {
  const user = useUserStore()
  const userId = user.userInfo.id
  if (!token || getToken() !== token || !userId) return
  if (bulletinSubscriptionCheck?.token === token && bulletinSubscriptionCheck.userId === userId) return

  bulletinSubscriptionCheck?.controller.abort()
  const check = { token, userId, controller: new AbortController() }
  bulletinSubscriptionCheck = check
  const isCurrent = () => bulletinSubscriptionCheck === check && getToken() === token && user.userInfo.id === userId
  const options = { hiddenError: true, signal: check.controller.signal }
  const locale = useSystemStore().language

  return (async () => {
    const catalogue = await getAllNotice(options)
    if (!isCurrent()) return
    if (!catalogue.success || !Array.isArray(catalogue.result)) throw new Error('Notification catalogue unavailable')
    const topics: BulletinTopic[] = catalogue.result
    const topic = topics.find(item =>
      item.provider === SYSTEM_BULLETIN_PROVIDER && item.id && stateOf(item.state) !== 'disabled')
    const channel = topic?.channels?.find(item =>
      item.channelProvider === insideMail && item.id && stateOf(item.state) !== 'disabled')
    if (!topic || !channel) return

    const response = await getNoticeList_api({
      paging: false,
      terms: [{ column: 'topicProvider', termType: 'eq', value: SYSTEM_BULLETIN_PROVIDER }],
    }, options)
    if (!isCurrent()) return
    const records = Array.isArray(response.result) ? response.result : response.result?.data
    if (!response.success || !Array.isArray(records)) throw new Error('Bulletin subscription unavailable')
    const subscriptions: BulletinSubscription[] = records
    const previous = subscriptions.find(item => item.topicProvider === SYSTEM_BULLETIN_PROVIDER)
    const channels = previous?.notifyChannels ?? []
    if (!Array.isArray(channels)) throw new Error('Invalid bulletin subscription channels')
    if (channels.includes(channel.id) || channels.includes(insideMail)) return

    // 只补站内信，保留原订阅的其他渠道和启停状态。
    const saved = await save_api({
      ...previous,
      topicProvider: SYSTEM_BULLETIN_PROVIDER,
      providerId: previous?.providerId || topic.id,
      subscribeName: previous?.subscribeName || topic.name,
      state: stateOf(previous?.state) ?? 'enabled',
      locale: previous?.locale || locale,
      notifyChannels: [...channels, channel.id],
    }, options)
    if (!saved.success) throw new Error('Bulletin subscription update failed')
  })().catch(() => {
    if (!isCurrent()) return
    bulletinSubscriptionCheck = undefined
    console.warn('[Router] 系统公告站内信默认绑定失败')
  })
}

export const bootstrapSession = async (resolveDefaultEntry = true) => {
  const userStore = useUserStore()
  const systemStore = useSystemStore()
  const applicationStore = useApplication()

  // 先确认入口，避免首次用户/系统请求把裸应用路径作为租户域名而被拒绝。
  const selected = isBusinessApplicationRuntime()
    ? await initializeBusinessApplicationEntry()
    : undefined

  if (!Object.keys(userStore.userInfo).length) {
    await userStore.getUserInfo()
  }

  if (resolveDefaultEntry && await enterDefaultApplication()) return true

  const userKey = userStore.userInfo.id || userStore.userInfo.username

  if (!systemStore.isSessionInitializedFor(userKey)) {
    await systemStore.queryVersion()
    await systemStore.getShowThreshold()
    await systemStore.queryInfo()
    await systemStore.setMircoData()
    systemStore.markSessionInitialized(userKey)
  }

  if (!isSubApp && !applicationStore.appList.length && OpenMicroApp) {
    // 非关键 UI 模块发现失败由 store 记录，仍继续初始化业务应用上下文。
    await applicationStore.queryApplication().catch(() => undefined)
  }

  if (isBusinessApplicationRuntime()) {
    if (getApplicationRuntimeEntry().type === 'application' && selected) {
      systemStore.layout.title = selected.name
      systemStore.changeTitle(selected.name)
    }
  }
  return false
}

export const addFallbackRoute = (router: Router) => {
  if (router.hasRoute('error')) {
    return
  }

  router.addRoute({
    path: '/:pathMatch(.*)*',
    name: 'error',
    component: () => import('@jetlinks-web-core/views/Error/404.vue'),
    meta: {
      title: '404',
    },
  })
}

export const ensureMenuRoutes = async (
  router: Router,
  shouldSkipMenuFetch: boolean,
): Promise<boolean> => {
  const menuStore = useMenuStore()

  if (shouldSkipMenuFetch || menuStore.initialized) {
    return false
  }

  if (menuRoutePromise) {
    return menuRoutePromise
  }

  menuRoutePromise = (async () => {
    const businessApplicationStore = useBusinessApplicationStore()
    const entry = getApplicationRuntimeEntry()
    if (entry.type === 'application'
      && (!businessApplicationStore.initialized
        || !businessApplicationStore.scopeSupported
        || businessApplicationStore.currentApplication?.id !== entry.applicationId)) {
      throw new ApplicationEntryUnavailableError()
    }

    // 项目和租户菜单显式禁用应用 Scope，应用菜单只使用已确认的目标。
    await menuStore.queryMenus(entry.applicationId || false)

    if (menuStore.initialized) {
      addFallbackRoute(router)
    }

    // 即使没有业务菜单也已注册根入口，需重新匹配到本次选择的首页。
    return menuStore.initialized
  })()

  try {
    return await menuRoutePromise
  } finally {
    menuRoutePromise = undefined
  }
}

export const resetRouteStartupState = () => {
  menuRoutePromise = undefined
  bulletinSubscriptionCheck?.controller.abort()
  bulletinSubscriptionCheck = undefined
}

export const resetSessionStores = () => {
  // 退出或换账号后必须清空会话级缓存，否则 bootstrapSession 会误判用户态已加载。
  resetRouteStartupState()
  useSystemStore().resetSessionInitialization()
  useUserStore().init()
  useMenuStore().init()
  useAuthStore().init()
  useApplication().init()
  useBusinessApplicationStore().init()
}
