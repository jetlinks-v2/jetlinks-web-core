import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { useSystemStore } from '@jetlinks-web-core/store'
import { getAllNotice } from '@jetlinks-web-core/api/account/center'
import { getNoticeList_api, getIsBindThird, getNotificationChannelDefinitions_api, save_api, type NotificationChannelDefinition } from '@jetlinks-web-core/api/account/notificationSubscription'

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
  provider: string; providerName?: string; thirdPartyUserId?: string
}
interface BindingTarget {
  provider: NotificationProvider; channel: DeliveryChannel; subscribeAfterBinding: boolean
}

const templateChannels = [
  'notifier-dingTalk', 'notifier-weixin', 'notifier-email',
  'notifier-voice', 'notifier-sms', 'notifier-webhook',
] as const
const stateValue = (state?: ChannelState) => typeof state === 'string' ? state : state?.value
const requiresThirdParty = (channel: DeliveryChannel) => ['notifier-dingTalk', 'notifier-weixin'].includes(channel.channelProvider)

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

/** 只编辑服务端可用渠道；通知接收账号独立于单点登录绑定。 */
export function useNotificationSettings() {
  const { t } = useI18n()
  const user = useUserStore()
  const system = useSystemStore()
  const channelProviders = ref<NotificationProvider[]>([])
  const channelDefinitions = ref<NotificationChannelDefinition[]>([])
  const definitionsReady = ref(false)
  // /notify/channel/all 只返回已启用且当前用户可访问的类型，状态缺省遵循该接口契约。
  const providers = computed(() => channelProviders.value.filter(row => stateValue(row.state) !== 'disabled'))
  const subscriptions = ref<Subscription[]>([])
  const recipients = ref<ThirdPartyRecipient[]>([])
  const loading = ref(false)
  const failed = ref(false)
  const recipientsFailed = ref(false)
  const recipientsLoading = ref(false)
  const saving = ref('')
  const pendingBinding = ref<BindingTarget>()
  let disposed = false
  let recipientVersion = 0
  // 沿用消息模板顺序，只展示后端明确支持个人订阅的渠道；未配置不等于不支持。
  const channelTypes = computed(() => templateChannels.filter(type => receiverPolicy(type) === 'subscriber'))
  const profile = computed(() => user.userInfo as { email?: string; telephone?: string; name?: string; username?: string })

  function selected(row: NotificationProvider) {
    const subscription = subscriptions.value.find(item => item.topicProvider === row.provider)
    if (subscription) return stateValue(subscription.state) === 'disabled' ? [] : subscription.notifyChannels || []
    return row.defaultSubscribed ? row.defaultNotifyChannels || [] : []
  }

  /** 接收人按通知器 ID 匹配，不拿其他通知器或单点登录的绑定冒充。 */
  function receiverFor(channel: DeliveryChannel): string | undefined {
    if (channel.channelProvider === 'inside-mail') return profile.value.name || profile.value.username || t('PersonalCenter.notificationCurrentAccount')
    if (channel.channelProvider === 'notifier-email') return profile.value.email
    if (['notifier-sms', 'notifier-voice'].includes(channel.channelProvider)) return profile.value.telephone
    const recipient = recipients.value.find(item => item.provider === channel.channelConfiguration?.notifierId)
    return recipient ? recipient.providerName || recipient.thirdPartyUserId || t('BindThirdAccount.index.483756-0') : undefined
  }

  function receiverSummary(type: string) {
    if (type === 'inside-mail') return profile.value.name || profile.value.username || ''
    if (type === 'notifier-email') return profile.value.email || t('PersonalCenter.notificationNoEmail')
    if (['notifier-sms', 'notifier-voice'].includes(type)) {
      return profile.value.telephone
        ? profile.value.telephone.replace(/^(.{3}).*(.{4})$/, '$1****$2')
        : t('PersonalCenter.notificationNoPhone')
    }
    if (type === 'notifier-webhook') return t('PersonalCenter.notificationTemplateManaged')
    if (!providers.value.some(row => row.channels.some(channel => channel.channelProvider === type))) return ''
    if (recipientsFailed.value) return t('PersonalCenter.notificationReceiverUnavailable')
    const names = providers.value.flatMap(row => row.channels)
      .filter(channel => channel.channelProvider === type).map(receiverFor).filter(Boolean)
    return [...new Set(names)].join('、') || t('PersonalCenter.notificationUnboundReceiver')
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
    if (templateChannels.some(type => type === channel.channelProvider) && !channel.channelConfiguration?.templateId) {
      return t('PersonalCenter.notificationChannelIncomplete')
    }
    if (requiresThirdParty(channel) && !channel.channelConfiguration?.notifierId) {
      return t('PersonalCenter.notificationChannelIncomplete')
    }
    return ''
  }

  function unavailableType(type: string) {
    return receiverPolicy(type) === 'explicit'
      ? t('PersonalCenter.notificationPersonalSubscriptionUnsupported')
      : t('PersonalCenter.notificationChannelNotConfigured')
  }

  function channelChecked(row: NotificationProvider, channel: DeliveryChannel) {
    return receiverPolicy(channel.channelProvider) === 'subscriber' && selected(row).includes(channel.id)
  }

  async function loadRecipients() {
    const current = ++recipientVersion
    if (!providers.value.some(row => row.channels.some(requiresThirdParty))) {
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

  async function load() {
    if (loading.value) return
    loading.value = true
    const [configuration, definitions] = await Promise.allSettled([
      Promise.all([getAllNotice(), getNoticeList_api({ paging: false })]),
      getNotificationChannelDefinitions_api(),
    ])
    if (disposed) return
    let loadFailed = false
    try {
      if (configuration.status === 'rejected') throw configuration.reason
      const [channels, records] = configuration.value
      const nextProviders = readList<NotificationProvider>(channels).map(row => ({
        ...row,
        channels: (row.channels || []).map(channel => ({ ...channel, providerId: channel.providerId || row.id })),
      }))
      const nextSubscriptions = readList<Subscription>(records)
      channelProviders.value = nextProviders
      subscriptions.value = nextSubscriptions
    } catch { loadFailed = true }
    try {
      if (definitions.status === 'rejected') throw definitions.reason
      channelDefinitions.value = readList<NotificationChannelDefinition>(definitions.value)
      definitionsReady.value = true
    } catch { loadFailed = true }
    failed.value = loadFailed
    await loadRecipients()
    if (!disposed) loading.value = false
  }

  async function save(row: NotificationProvider, channel: DeliveryChannel, enabled: boolean) {
    if (saving.value || channelUnavailable(channel)) return
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
      }
    } catch { if (!disposed) failed.value = true }
    finally { if (!disposed) saving.value = '' }
  }

  async function toggle(row: NotificationProvider, channel: DeliveryChannel, enabled: boolean) {
    if (saving.value || channelUnavailable(channel)) return
    if (!enabled || channel.channelProvider === 'inside-mail') return save(row, channel, enabled)
    if (requiresThirdParty(channel)) {
      saving.value = row.provider + ':' + channel.id
      const loaded = await loadRecipients()
      saving.value = ''
      if (!loaded || disposed) return
    }
    if (receiverFor(channel)) return save(row, channel, true)
    pendingBinding.value = { provider: row, channel, subscribeAfterBinding: true }
  }

  function canBindReceiver(type: string) {
    return ['notifier-dingTalk', 'notifier-weixin'].includes(type)
      && providers.value.some(row => row.channels.some(channel => channel.channelProvider === type && !channelUnavailable(channel) && !receiverFor(channel)))
  }

  function beginReceiverBinding(type: string) {
    if (saving.value) return
    const candidates = providers.value.flatMap(provider => provider.channels
      .filter(channel => channel.channelProvider === type && !channelUnavailable(channel))
      .map(channel => ({ provider, channel })))
    const target = candidates.find(item => !receiverFor(item.channel))
    // 表头绑定只维护接收账号，开关引导绑定成功后才继续订阅。
    if (target) pendingBinding.value = { ...target, subscribeAfterBinding: false }
  }

  async function bindingComplete() {
    const target = pendingBinding.value
    if (!target) return
    if (target.subscribeAfterBinding) await save(target.provider, target.channel, true)
    else pendingBinding.value = undefined
    if (requiresThirdParty(target.channel)) await loadRecipients()
    else {
      try { await user.getUserInfo() }
      catch { if (!disposed) failed.value = true }
    }
  }

  onMounted(load)
  onUnmounted(() => { disposed = true; recipientVersion++ })
  return {
    providers, channelTypes, loading, failed, saving, pendingBinding, recipientsFailed, recipientsLoading,
    profile, load, loadRecipients, selected, toggle, bindingComplete, receiverSummary, channelUnavailable, unavailableType, channelChecked,
    canBindReceiver, beginReceiverBinding,
  }
}
