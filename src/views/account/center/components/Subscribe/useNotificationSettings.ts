import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isAxiosError } from 'axios'
import { onlyMessage } from '@jetlinks-web/utils'
import { useAuthStore } from '@jetlinks-web-core/store/auth'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { useSystemStore } from '@jetlinks-web-core/store'
import { useNotificationConfigNavigation } from '@jetlinks-web-core/hooks/useNotificationConfigNavigation'
import { getAllNotice } from '@jetlinks-web-core/api/account/center'
import { readOwnMenuTree } from '@jetlinks-web-core/api/system/menu'
import type { MenuPermissionNode } from '@jetlinks-web-core/hooks/menuAssetPermissionEditor.types'
import { getApplicationRuntimeEntry, getProjectCodeFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import { getApplicationAccessContext } from '@jetlinks-web-core/utils/request-context'
import { resolveNotificationProviderName } from '../data'
import type { AccountEditTarget } from '../../types'
import {
  changeSubscriptionState_api, getNoticeList_api, getIsBindThird,
  getNotificationChannelDefinitions_api, getNotificationNotifierConfigs_api, save_api, SYSTEM_BULLETIN_PROVIDER,
  type NotificationChannelDefinition, type NotificationNotifierConfig, type NotificationSubscriptionRequestOptions,
} from '@jetlinks-web-core/api/account/notificationSubscription'

type ChannelState = string | { value: string; text?: string }
export interface DeliveryChannel {
  id: string; name: string; channelProvider: string; providerId?: string
  state?: ChannelState
  channelConfiguration?: { notifierId?: string; templateId?: string }
}
export interface NotificationProvider {
  id?: string; provider: string; name: string; description?: string; state?: ChannelState
  channels: DeliveryChannel[]; defaultSubscribed?: boolean; defaultNotifyChannels?: string[]
  type?: { id: string; name: string }
}
interface Subscription {
  id?: string; topicProvider: string; notifyChannels?: string[]
  state?: ChannelState; [key: string]: unknown
}
interface ThirdPartyRecipient {
  type: string; provider: string; providerName?: string; thirdPartyUserId: string
}
interface BindingTarget {
  provider: NotificationProvider; channel: DeliveryChannel
}

const dingTalk = 'notifier-dingTalk'
const dingTalkWorkProvider = 'dingTalkMessage'
const weCom = 'notifier-weixin'
const channelMenu = 'system/MessageNotification/Channels'
const templateMenu = 'system/MessageNotification/Templates'

const requiredAlarmMenus = new Map([
  ['alarm-device', 'iot-user/device/alarm'],
  ['alarm-device-relieve', 'iot-user/device/alarm'],
  ['aiComplianceAlarm', 'machine-vision/VisualAlarm'],
  ['aiSecurityAlarm', 'machine-vision/VisualAlarm'],
])

const workNotifications: Partial<Record<string, { provider: string; bindingType: string; missing: string }>> = {
  [dingTalk]: { provider: dingTalkWorkProvider, bindingType: 'dingTalk_dingTalkMessage', missing: 'PersonalCenter.notificationDingTalkMemberMissing' },
  [weCom]: { provider: 'corpMessage', bindingType: 'weixin_corpMessage', missing: 'PersonalCenter.notificationWeComMemberMissing' },
}

const contactTargets: Partial<Record<string, AccountEditTarget>> = {
  'notifier-email': 'email-section',
  'notifier-voice': 'phone-section',
  'notifier-sms': 'phone-section',
}

const templateChannels = [
  dingTalk, 'notifier-weixin', 'notifier-email',
  'notifier-voice', 'notifier-sms', 'notifier-webhook',
] as const

const subscriberNotifierProviders: Record<string, string> = {
  'notifier-email': 'embedded', [dingTalk]: dingTalkWorkProvider,
  'notifier-weixin': 'corpMessage', 'notifier-voice': 'aliyun',
  'notifier-sms': 'aliyunSms', 'notifier-webhook': 'http',
}

// 与通知渠道管理页使用相同的渠道图标语义。
const channelIcons: Record<string, string> = {
  'inside-mail': 'InboxOutlined', 'notifier-email': 'MailOutlined',
  'notifier-dingTalk': 'DingdingOutlined', 'notifier-weixin': 'WechatOutlined',
  'notifier-voice': 'PhoneOutlined', 'notifier-sms': 'MessageOutlined', 'notifier-webhook': 'ApiOutlined',
}
const stateValue = (state?: ChannelState) => typeof state === 'string' ? state : state?.value
const requiresThirdParty = (channel: DeliveryChannel) => channel.channelProvider === 'notifier-weixin'

function hasRequiredMenu(provider: string, menuCodes: ReadonlySet<string>) {
  const code = requiredAlarmMenus.get(provider)
  return !code || menuCodes.has(code)
}

/** 层级补齐的父节点可能标为未授权，其下级菜单仍需检查。 */
function grantedMenuCodes(menus: MenuPermissionNode[], codes = new Set<string>()): ReadonlySet<string> {
  for (const menu of menus) {
    if (!menu || typeof menu.code !== 'string' || (menu.children != null && !Array.isArray(menu.children))) {
      throw new Error('Invalid authorization menu')
    }
    if (menu.granted !== false) codes.add(menu.code)
    if (menu.children) grantedMenuCodes(menu.children, codes)
  }
  return codes
}

/** 查询失败不能作为空配置写回，兼容列表接口与分页结果。 */
function readList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[]
  if (!response || typeof response !== 'object' || ('success' in response && response.success === false)) {
    throw new Error('Notification query failed')
  }
  const result = 'result' in response ? response.result : undefined
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) return result.data as T[]
  throw new Error('Invalid notification list')
}

/** 钉钉在当前菜单内配置；其他接收方式保留独立标签及其返回刷新机制。 */
function useDeliveryNavigation(menuCode: string, refresh: () => Promise<void>) {
  const menu = useMenuStore()
  const { available, open } = useNotificationConfigNavigation(refresh, menuCode)
  function navigate(...args: Parameters<typeof open>) {
    const [topicProvider, channelProvider, query] = args
    if (channelProvider !== dingTalk) return open(...args)
    if (available.value) return menu.jumpPage(menuCode, { query: { channel: `dingTalk:${dingTalkWorkProvider}`, ...query, topicProvider, channelProvider } })
  }
  return { available, open: navigate }
}

/** 只编辑服务端可用渠道；通知接收账号独立于单点登录绑定。 */
export function useNotificationSettings() {
  const { t } = useI18n()
  const auth = useAuthStore()
  const user = useUserStore()
  const menu = useMenuStore()
  const system = useSystemStore()
  const templateNavigation = useDeliveryNavigation(templateMenu, load)
  const channelNavigation = useDeliveryNavigation(channelMenu, load)
  const canCreateChannel = computed(() => channelNavigation.available.value && auth.hasPermission(channelMenu + ':add'))
  const canConfigureTemplate = computed(() =>
    templateNavigation.available.value && auth.hasPermission([templateMenu + ':add', templateMenu + ':update']))
  const channelProviders = ref<NotificationProvider[]>([])
  const menuCodes = shallowRef<ReadonlySet<string>>(new Set())
  const channelDefinitions = ref<NotificationChannelDefinition[]>([])
  const definitionsReady = ref(false)
  const notifierConfigs = ref<NotificationNotifierConfig[]>([])
  const configsReady = ref(false)
  const configsFailed = ref(false)
  // /notify/channel/all 只返回已启用且当前用户可访问的类型，状态缺省遵循该接口契约。
  // 场景执行通知由联动动作配置，系统公告站内信由会话初始化绑定。
  const providers = computed(() => channelProviders.value
    .filter(row => row.provider !== 'scene' && row.provider !== SYSTEM_BULLETIN_PROVIDER
      && stateValue(row.state) !== 'disabled' && hasRequiredMenu(row.provider, menuCodes.value))
    .map(row => ({
      ...row, matrixKey: row.id || row.provider,
      channels: row.channels.filter(channel => channel.channelProvider !== dingTalk || isWorkNotification(channel)),
      // 展示名称随界面语言变化；保留原始 name，保存订阅时不改写接口名称。
      displayName: resolveNotificationProviderName(row.provider, row.name),
    })))
  const subscriptions = ref<Subscription[]>([])
  const recipients = ref<ThirdPartyRecipient[]>([])
  const loading = ref(false)
  const failed = ref(false)
  const queryFailed = ref(false)
  const recipientsFailed = ref(false)
  const recipientsLoading = ref(false)
  const saving = ref('')
  const pendingBinding = ref<BindingTarget>()
  let disposed = false
  let loadController: AbortController | undefined
  let recipientVersion = 0
  // 沿用消息模板顺序，只展示后端明确支持个人订阅的渠道；未配置不等于不支持。
  const channelTypes = computed(() => templateChannels.filter(type => receiverPolicy(type) === 'subscriber'))
  const profile = computed(() => user.userInfo as { email?: string; telephone?: string; name?: string; username?: string })

  const channelNames: Record<string, string> = {
    'inside-mail': 'PersonalCenter.insideMail',
    'notifier-weixin': 'PersonalCenter.wechat', 'notifier-email': 'PersonalCenter.notificationEmail',
    'notifier-voice': 'PersonalCenter.voice', 'notifier-sms': 'PersonalCenter.sms', 'notifier-webhook': 'PersonalCenter.notificationWebhook',
  }
  // 矩阵只适配真实接收渠道；可用性与保存仍由原订阅逻辑决定。
  const displayedTypes = computed(() => [
    'inside-mail', 'notifier-email', 'notifier-dingTalk', 'notifier-weixin', 'notifier-voice', 'notifier-sms', 'notifier-webhook',
  ].filter(type => type === 'inside-mail'
    ? providers.value.some(row => row.channels.some(channel => channel.channelProvider === type))
    : channelTypes.value.some(value => value === type)))
  const matrixRowNames = computed(() => Object.fromEntries(providers.value.map(row => [row.matrixKey, row.displayName])))
  const insideMailEnabled = computed(() => !loading.value && !queryFailed.value && configuredChannels('inside-mail').length > 0)
  // 与通知渠道页共用渠道定义的名称，避免同一渠道在两个入口显示不同名称。
  const channelLabel = (type: string) => {
    if (type === dingTalk) return t('PersonalCenter.dingtalk')
    const definition = channelDefinitions.value.find(item => item.id === type)
    return t(definition?.i18nName || definition?.name || channelNames[type] || type)
  }
  const channelIcon = (type: string) => channelIcons[type] || 'NotificationOutlined'
  const tableColumns = computed(() => [
    { key: 'topic', dataIndex: 'topic', title: t('PersonalCenter.messageType'), width: 200, scopedSlots: true },
    ...displayedTypes.value.map(type => ({ key: type, dataIndex: type, title: channelLabel(type), align: 'center' as const, scopedSlots: true })),
  ])

  /** 给公共矩阵提供展示快照，不在模板中重复派生订阅状态或修改接口模型。 */
  function matrixCells(provider: string, type: string) {
    const row = providers.value.find(item => item.matrixKey === provider)
    return row ? row.channels.filter(channel => channel.channelProvider === type).map(channel => {
      const checked = channelChecked(row, channel)
      return {
        channel, checked, unavailable: subscriptionUnavailable(channel, !checked),
        saving: saving.value === row.provider + ':' + channel.id,
      }
    }) : []
  }
  function toggleMatrixChannel(provider: string, channel: DeliveryChannel, enabled: boolean) {
    const row = providers.value.find(item => item.matrixKey === provider)
    const target = row?.channels.find(item => item.id === channel.id)
    if (row && target) return toggle(row, target, enabled)
  }

  function selected(row: NotificationProvider) {
    const subscription = subscriptions.value.find(item => item.topicProvider === row.provider)
    if (subscription) return stateValue(subscription.state) === 'disabled' ? [] : subscription.notifyChannels || []
    return row.defaultSubscribed ? row.defaultNotifyChannels || [] : []
  }

  /** 通讯录对应按通知器 ID 和对应类型匹配，单点登录记录不参与通知接收。 */
  function memberFor(channelType: string, id?: string) {
    const type = workNotifications[channelType]?.bindingType
    if (!id || !type) return
    const member = recipients.value.find(item => item.provider === id && item.type === type && item.thirdPartyUserId)
    return member?.providerName || member?.thirdPartyUserId
  }

  function receiverFor(channel: DeliveryChannel): string | undefined {
    if (channel.channelProvider === 'inside-mail') return profile.value.name || profile.value.username || t('PersonalCenter.notificationCurrentAccount')
    const target = contactTargets[channel.channelProvider]
    if (target === 'email-section') return profile.value.email
    if (target === 'phone-section') return profile.value.telephone
    return memberFor(channel.channelProvider, channel.channelConfiguration?.notifierId)
  }

  function isWorkNotification(channel: DeliveryChannel) {
    const work = workNotifications[channel.channelProvider]
    if (!work || !channel.channelConfiguration?.notifierId) return false
    const config = notifierConfigs.value.find(item => item.id === channel.channelConfiguration?.notifierId)
    if (channel.channelProvider === dingTalk) {
      // 管理查询 403 时保留业务通道；新增订阅仍需同一通知器的本人工作通知绑定。
      if (!configsReady.value) return !configsFailed.value
      return !!config && stateValue(config.type) === 'dingTalk' && stateValue(config.provider) === work.provider
    }
    return !config || stateValue(config.provider) === work.provider
  }

  function configuredChannels(type: string) {
    return providers.value.flatMap(row => row.channels).filter(channel => {
      if (channel.channelProvider !== type || stateValue(channel.state) === 'disabled') return false
      if (type === 'inside-mail') return true
      if (!channel.channelConfiguration?.templateId) return false
      return type !== weCom || isWorkNotification(channel)
    })
  }

  function receiverStatus(type: string) {
    if (loading.value) return ''
    if (queryFailed.value || (type !== 'inside-mail' && !definitionsReady.value)) return t('PersonalCenter.notificationChannelInfoUnavailable')
    if (type === dingTalk && configsFailed.value) return t('PersonalCenter.notificationChannelInfoUnavailable')
    const channels = configuredChannels(type)
    if (!channels.length) {
      if (configsFailed.value) return t('PersonalCenter.notificationChannelInfoUnavailable')
      return t(channelHeaderAction(type) === 'configure' ? 'PersonalCenter.channelUnconfigured' : 'PersonalCenter.channelUnconfiguredAdmin')
    }
    const target = contactTargets[type]
    if (target) {
      const missing = target === 'email-section' ? 'PersonalCenter.notificationNoEmail' : 'PersonalCenter.notificationNoPhone'
      return receiverFor(channels[0]) || t(missing)
    }
    if (type === 'notifier-webhook') return t('PersonalCenter.notificationTemplateManaged')
    const work = workNotifications[type]
    if (work) {
      if (recipientsFailed.value) return t('PersonalCenter.notificationReceiverUnavailable')
      const names = channels.map(receiverFor).filter(Boolean)
      return [...new Set(names)].join('、') || t(work.missing)
    }
    return t('PersonalCenter.channelEnabled')
  }

  /** 联系方式入口依据已授权业务通道，渠道配置入口还需校验管理权限。 */
  function channelHeaderAction(type: string): 'configure' | AccountEditTarget | undefined {
    if (type === 'inside-mail' || loading.value || queryFailed.value || !definitionsReady.value) return
    const channel = configuredChannels(type)[0]
    if (channel) {
      const target = contactTargets[type]
      return target && !receiverFor(channel) ? target : undefined
    }
    if (failed.value || !configsReady.value) return
    if (notifierFor(type) ? canConfigureTemplate.value : canCreateChannel.value) {
      return 'configure'
    }
  }

  /** Only a concrete visible business supplies guidance; /all remains the subscription authority. */
  function canCheckTemplate(row: NotificationProvider, type: string) {
    return canConfigureTemplate.value && !loading.value && !failed.value && !saving.value
      && receiverPolicy(type) === 'subscriber' && type !== 'inside-mail'
      && (!row.channels.some(channel => channel.channelProvider === type)
        || row.channels.some(channel => channel.channelProvider === type && !!channelUnavailable(channel)))
  }
  function checkTemplate(row: NotificationProvider, type: string) {
    if (canCheckTemplate(row, type)) templateNavigation.open(row.id || row.provider, type)
  }

  /** 已绑定的可见渠道优先，缺少业务模板时回退到此接收方式的提供商。 */
  function notifierFor(type: string) {
    const notifierType = type.replace(/^notifier-/, '')
    const candidates = notifierConfigs.value.filter(config => stateValue(config.type) === notifierType)
    const boundIds = providers.value.flatMap(row => row.channels)
      .filter(channel => channel.channelProvider === type).map(channel => channel.channelConfiguration?.notifierId)
    return candidates.find(config => boundIds.includes(config.id))
      || candidates.find(config => stateValue(config.provider) === subscriberNotifierProviders[type])
  }

  /** 渠道缺失先配置渠道；渠道存在才进入业务模板，返回后沿用原刷新流程。 */
  function openChannelSettings(type: string) {
    if (channelHeaderAction(type) !== 'configure') return
    const config = notifierFor(type)
    const query = { channel: `${type.replace(/^notifier-/, '')}:${config ? stateValue(config.provider) : subscriberNotifierProviders[type]}` }
    if (!config) {
      channelNavigation.open('', type, query)
      return
    }
    const candidates = providers.value.filter(row => canCheckTemplate(row, type))
    const owner = candidates.length === 1 ? candidates[0] : undefined
    templateNavigation.open(owner ? owner.id || owner.provider : '', type, query)
  }

  function receiverPolicy(type: string) {
    if (type === 'inside-mail') return 'subscriber'
    const policy = channelDefinitions.value.find(item => item.id === type)?.receiverPolicy
    return typeof policy === 'string' ? policy : policy?.value
  }

  function channelUnavailable(channel: DeliveryChannel) {
    if (stateValue(channel.state) === 'disabled') return t('PersonalCenter.notificationChannelDisabled')
    if (receiverPolicy(channel.channelProvider) === 'explicit') {
      return t('PersonalCenter.notificationPersonalSubscriptionUnsupported')
    }
    if (channel.channelProvider !== 'inside-mail' && (!definitionsReady.value || receiverPolicy(channel.channelProvider) !== 'subscriber')) {
      return t('PersonalCenter.notificationChannelInfoUnavailable')
    }
    if (channel.channelProvider === dingTalk && !isWorkNotification(channel)) return unavailableType(dingTalk)
    if (templateChannels.some(type => type === channel.channelProvider) && !channel.channelConfiguration?.templateId) {
      return t('PersonalCenter.notificationChannelIncomplete')
    }
    if (requiresThirdParty(channel) && !channel.channelConfiguration?.notifierId) {
      return t('PersonalCenter.notificationChannelIncomplete')
    }
    return ''
  }

  /** 绑定只限制新增工作通知；成员解绑后仍可取消原订阅。 */
  function subscriptionUnavailable(channel: DeliveryChannel, enabling: boolean) {
    const reason = channelUnavailable(channel)
    if (reason || channel.channelProvider !== dingTalk) return reason
    if (recipientsLoading.value || recipientsFailed.value) return t('PersonalCenter.notificationReceiverUnavailable')
    return enabling && !receiverFor(channel) ? t('PersonalCenter.notificationDingTalkMemberMissing') : ''
  }

  function unavailableType(type: string) {
    if (type === dingTalk && configsFailed.value) return t('PersonalCenter.notificationChannelInfoUnavailable')
    return receiverPolicy(type) === 'explicit'
      ? t('PersonalCenter.notificationPersonalSubscriptionUnsupported')
      : t('PersonalCenter.notificationChannelIncomplete')
  }

  function channelChecked(row: NotificationProvider, channel: DeliveryChannel) {
    return receiverPolicy(channel.channelProvider) === 'subscriber' && selected(row).includes(channel.id)
  }

  async function loadRecipients() {
    const current = ++recipientVersion
    if (![dingTalk, weCom].some(type => configuredChannels(type).length)) {
      recipients.value = []
      recipientsFailed.value = false
      recipientsLoading.value = false
      return true
    }
    recipientsLoading.value = true
    try {
      const result = readList<ThirdPartyRecipient>(await getIsBindThird())
      if (disposed || current !== recipientVersion) return false
      recipients.value = result
      recipientsFailed.value = false
      return true
    } catch {
      if (!disposed && current === recipientVersion) recipientsFailed.value = true
      return false
    } finally {
      if (!disposed && current === recipientVersion) recipientsLoading.value = false
    }
  }

  /** 列表使用当前视图的菜单，写入前以完整项目授权复核可能受影响的订阅。 */
  async function disableSubscriptionsWithoutMenu(isCurrent: () => boolean, options: NotificationSubscriptionRequestOptions) {
    const candidates = subscriptions.value.filter((record): record is Subscription & { id: string } =>
      typeof record?.id === 'string' && !!record.id && stateValue(record.state) === 'enabled'
      && !hasRequiredMenu(record.topicProvider, menuCodes.value))
    if (!candidates.length) return true

    let projectMenus: ReadonlySet<string>
    try {
      projectMenus = grantedMenuCodes(readOwnMenuTree(await menu.requestMenus(false, false)))
    } catch {
      return false
    }

    let succeeded = true
    for (const { id, topicProvider } of candidates) {
      if (!isCurrent()) break
      if (hasRequiredMenu(topicProvider, projectMenus)) continue
      try {
        const response = await changeSubscriptionState_api(id, 'disabled', options)
        if (response?.success !== true) throw new Error('Subscription state update failed')
        if (!isCurrent()) break
        subscriptions.value = subscriptions.value.map(record => record.id === id ? { ...record, state: 'disabled' } : record)
      } catch {
        succeeded = false
      }
    }
    return succeeded
  }

  async function loadSettings(applicationScope: string | false, isCurrent: () => boolean, options: NotificationSubscriptionRequestOptions) {
    const [configuration, definitions, configs] = await Promise.allSettled([
      Promise.all([
        getAllNotice(options),
        getNoticeList_api({ paging: false }, options),
        menu.requestMenus(true, applicationScope),
      ]),
      getNotificationChannelDefinitions_api(),
      getNotificationNotifierConfigs_api(),
    ])
    if (!isCurrent()) return false
    let loadFailed = false
    try {
      if (configuration.status === 'rejected') throw configuration.reason
      const [channels, records, menus] = configuration.value
      const nextMenuCodes = grantedMenuCodes(readOwnMenuTree(menus))
      const nextProviders = readList<NotificationProvider>(channels).map(row => ({
        ...row,
        channels: (row.channels || []).map(channel => ({ ...channel, providerId: channel.providerId || row.id })),
      }))
      const nextSubscriptions = readList<Subscription>(records)
      menuCodes.value = nextMenuCodes
      channelProviders.value = nextProviders
      subscriptions.value = nextSubscriptions
      if (pendingBinding.value && !hasRequiredMenu(pendingBinding.value.provider.provider, nextMenuCodes)) {
        pendingBinding.value = undefined
      }
    } catch { loadFailed = true }
    try {
      if (definitions.status === 'rejected') throw definitions.reason
      channelDefinitions.value = readList<NotificationChannelDefinition>(definitions.value)
      definitionsReady.value = true
    } catch { loadFailed = true }
    // 配置列表的管理权限与接收业务通知的权限不同。
    try {
      if (configs.status === 'rejected') throw configs.reason
      const nextConfigs = readList<NotificationNotifierConfig>(configs.value)
      if (nextConfigs.some(config => !config || !config.id || !stateValue(config.type) || !stateValue(config.provider))) {
        throw new Error('Invalid notifier configuration list')
      }
      notifierConfigs.value = nextConfigs
      configsReady.value = true
      configsFailed.value = false
    } catch {
      const denied = configs.status === 'rejected'
        ? isAxiosError(configs.reason) && configs.reason.response?.status === 403
        : configs.value?.status === 403
      notifierConfigs.value = []
      configsReady.value = false
      configsFailed.value = !denied
    }
    queryFailed.value = loadFailed
    failed.value = loadFailed
    return !loadFailed
  }

  async function load() {
    if (loading.value) return
    const userId = user.userInfo?.id
    const projectCode = getProjectCodeFromLocation()
    const applicationScope = getApplicationRuntimeEntry().applicationId || false
    const access = getApplicationAccessContext()
    const controller = new AbortController()
    loadController = controller
    const options = { hiddenError: true, signal: controller.signal }

    // 只有菜单和订阅都来自当前会话与项目时才允许发出停用请求。
    const isCurrent = () => {
      if (disposed || controller.signal.aborted || user.userInfo?.id !== userId
        || getProjectCodeFromLocation() !== projectCode
        || (getApplicationRuntimeEntry().applicationId || false) !== applicationScope) return false
      const current = getApplicationAccessContext()
      return current.token === access.token && current.apiUrl === access.apiUrl && current.domain === access.domain
    }

    loading.value = true
    try {
      const ready = await loadSettings(applicationScope, isCurrent, options)
      if (!isCurrent()) return
      const [synchronized] = await Promise.all([
        ready && userId && access.token ? disableSubscriptionsWithoutMenu(isCurrent, options) : true,
        loadRecipients(),
      ])
      if (isCurrent() && !synchronized) failed.value = true
    } finally {
      loadController = undefined
      if (!disposed) loading.value = false
    }
  }

  async function save(row: NotificationProvider, channel: DeliveryChannel, enabled: boolean) {
    if (loading.value || queryFailed.value || saving.value
      || !hasRequiredMenu(row.provider, menuCodes.value) || subscriptionUnavailable(channel, enabled)) return
    saving.value = row.provider + ':' + channel.id
    failed.value = false
    try {
      const previous = subscriptions.value.find(item => item.topicProvider === row.provider)
      // 重新启用保留原选择和 topicConfig；只修改本次操作的渠道。
      const channels = new Set(previous ? previous.notifyChannels || [] : selected(row))
      if (enabled) channels.add(channel.id)
      else channels.delete(channel.id)
      const next = {
        ...previous, subscribeName: previous?.subscribeName || row.name, topicProvider: row.provider,
        providerId: channel.providerId || row.id, state: 'enabled', locale: system.language, notifyChannels: [...channels],
      }
      const response = await save_api(next)
      if (response?.success === false || (response?.success !== true && response?.status !== 200)) throw new Error('Subscription update failed')
      if (!disposed) {
        // 保存接口可能以 Flux 数组或单条对象返回，按主题取回持久化记录。
        const result = Array.isArray(response.result)
          ? response.result.find((item: Subscription) => item.topicProvider === row.provider)
          : response.result
        const persisted = result && typeof result === 'object' ? result : {}
        subscriptions.value = [...subscriptions.value.filter(item => item.topicProvider !== row.provider), { ...next, ...persisted }]
        pendingBinding.value = undefined
        onlyMessage(t('PersonalCenter.prototype.saved'), 'success')
      }
    } catch { if (!disposed) failed.value = true }
    finally { if (!disposed) saving.value = '' }
  }

  async function toggle(row: NotificationProvider, channel: DeliveryChannel, enabled: boolean) {
    if (loading.value || queryFailed.value || saving.value
      || !hasRequiredMenu(row.provider, menuCodes.value) || subscriptionUnavailable(channel, enabled)) return
    if (!enabled || channel.channelProvider === 'inside-mail') return save(row, channel, enabled)
    if (channel.channelProvider === dingTalk || requiresThirdParty(channel)) {
      saving.value = row.provider + ':' + channel.id
      const userId = user.userInfo?.id
      const loaded = await loadRecipients()
      saving.value = ''
      if (!loaded || disposed || user.userInfo?.id !== userId) return
    }
    if (channel.channelProvider === dingTalk || receiverFor(channel)) return save(row, channel, true)
    pendingBinding.value = { provider: row, channel }
  }

  async function bindingComplete() {
    const target = pendingBinding.value
    if (!target) return
    await save(target.provider, target.channel, true)
    if (requiresThirdParty(target.channel)) await loadRecipients()
    else {
      try { await user.getUserInfo() }
      catch { if (!disposed) failed.value = true }
    }
  }

  onMounted(load)
  watch(() => user.userInfo?.id, () => loadController?.abort(), { flush: 'sync' })
  onUnmounted(() => {
    disposed = true
    loadController?.abort()
    recipientVersion++
  })
  return {
    providers, channelTypes, loading, failed, configsFailed, saving, pendingBinding, recipientsFailed, recipientsLoading,
    profile, load, loadRecipients, selected, toggle, bindingComplete, channelUnavailable, unavailableType, channelChecked,
    receiverStatus, channelHeaderAction, openChannelSettings, canCheckTemplate, checkTemplate, displayedTypes, tableColumns, matrixRowNames, insideMailEnabled, channelLabel, channelIcon, matrixCells, toggleMatrixChannel,
  }
}
