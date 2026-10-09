import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRouterParams } from '@jetlinks-web/hooks'
import dayjs from 'dayjs'
import { useUserStore, type UserInfo } from '@jetlinks-web-core/store/user'
import { queryModal } from '@jetlinks-web-core/api/login'
import { getIdentityProviders_api, getSelfIdentities_api, getSsoBinds_api } from '@jetlinks-web-core/api/account/center'
import i18n from '@jetlinks-web-core/locales'
import { isNoCommunity } from '@jetlinks-web-core/utils'
import { tabList } from './data'
import type { AccountCardProfile, AccountEditTarget, CenterContentKey } from './types'

interface IdentityItem {
  provider: string
  identity: string
  isPrimary?: boolean
}

interface ThirdAccount {
  id: string
  name: string
  bound: boolean
  features?: string[]
}

type CenterUserInfo = Partial<UserInfo> & {
  avatar?: string
  telephone?: string
  email?: string
}

/** 仅三个主功能参与分段切换，历史账号信息和首页视图通过辅助弹窗承接。 */
const isContentKey = (key: unknown): key is CenterContentKey =>
  key === 'StationMessage' || key === 'Subscribe' || key === 'PersonalToken'

/** Store 的组织、角色、职位是 unknown[]，展示前只接受带名称的条目。 */
const formatDimensions = (items: unknown[] | undefined, emptyText: string): string => {
  const names = (items || []).flatMap(item => {
    if (!item || typeof item !== 'object' || !('name' in item)) return []
    return typeof item.name === 'string' ? [item.name] : []
  })
  return names.join('、') || emptyText
}

/** 联系方式卡片沿用参考页的脱敏方式，详细编辑仍显示原绑定信息。 */
const maskIdentity = (value: string | undefined, provider: 'mobile' | 'email'): string => {
  if (!value) return i18n.global.t('AccountInfo.unbound')
  return provider === 'mobile'
    ? value.replace(/^(.{3}).*(.{4})$/, '$1****$2')
    : value.replace(/^(.{2}).*(@.*)$/, '$1****$2')
}

/** Core 个人中心的数据加载、弹窗及通知/历史页签联动；不依赖项目覆盖模块。 */
export const useCenter = () => {
  const user = useUserStore()
  const routerParams = useRouterParams()
  const route = useRoute()
  const router = useRouter()
  const activeKey = ref<CenterContentKey>('StationMessage')
  const accountInfoVisible = ref(false)
  const homeViewVisible = ref(false)
  const editPasswordVisible = ref(false)
  const loading = ref(false)
  const loadError = ref(false)
  const identities = ref<IdentityItem[]>([])
  const editableProviders = ref<string[]>([])
  const thirdAccounts = ref<ThirdAccount[]>([])
  let loadVersion = 0

  const segments = computed(() => [
    { label: i18n.global.t('AccountCenter.messageCenter'), value: 'StationMessage' },
    { label: i18n.global.t('center.data.756829-0'), value: 'Subscribe' },
    { label: i18n.global.t('center.data.756829-4'), value: 'PersonalToken' },
  ])
  const activeTitle = computed(() => segments.value.find(item => item.value === activeKey.value)?.label)

  const profile = computed<AccountCardProfile>(() => {
    const info: CenterUserInfo = user.userInfo
    const getIdentity = (provider: string) => {
      const list = identities.value.filter(item => item.provider === provider)
      return (list.find(item => item.isPrimary) || list[0])?.identity
    }
    const createdAt = info.createTime ? dayjs(info.createTime) : undefined
    return {
      name: info.name || info.username || '--',
      username: info.username || '--',
      avatar: info.avatar,
      canEdit: isNoCommunity,
      canConfigureHome: !user.isApplicationUser,
      items: [
        { key: 'id', label: i18n.global.t('AccountCenter.accountId'), value: info.id || '--' },
        { key: 'username', label: i18n.global.t('AccountInfo.basicUsername'), value: info.username || '--' },
        { key: 'roles', label: i18n.global.t('AccountInfo.roles'), value: formatDimensions(info.roleList, i18n.global.t('Detail.index.153077-6')) },
        { key: 'orgs', label: i18n.global.t('AccountInfo.orgs'), value: formatDimensions(info.orgList, i18n.global.t('Detail.index.153077-7')) },
        { key: 'mobile', label: i18n.global.t('AccountInfo.basicPhone'), value: maskIdentity(getIdentity('mobile') || info.telephone, 'mobile'), editTarget: editableProviders.value.includes('mobile') ? 'phone-section' : undefined },
      ],
      thirdAccounts: thirdAccounts.value.map(item => ({
        key: item.id,
        label: item.name,
        value: i18n.global.t(item.bound ? 'BindThirdAccount.index.483756-0' : 'BindThirdAccount.index.483756-1'),
      })),
    }
  })

  /** 查询前保留现有 authService:identity 能力判断，兼容没有身份服务的 core 宿主。 */
  const loadIdentities = async (): Promise<{ identities: IdentityItem[]; providers: string[] }> => {
    const unsupported = { identities: [], providers: [] }
    if (!isNoCommunity) return unsupported
    const response: unknown = await queryModal('authService:identity')
    const supported = response === true || (
      !!response && typeof response === 'object' && 'result' in response && response.result === true
    )
    if (!supported) return unsupported
    const [result, providers] = await Promise.all([getSelfIdentities_api(), getIdentityProviders_api()])
    const providerItems: { id: string }[] = providers.result || []
    return { identities: result.result || [], providers: providerItems.map(item => item.id) }
  }

  /** 第三方登录只展示后端支持重定向的应用，操作继续由原账号信息组件承接。 */
  const loadThirdAccounts = async (): Promise<ThirdAccount[]> => {
    if (!isNoCommunity) return []
    const response: { result?: ThirdAccount[] } = await getSsoBinds_api()
    return (response.result || []).filter(item => !item.features?.includes('ssoUnsupportedRedirect'))
  }

  /** 独立加载账户各区块；部分请求失败时保留可用数据并提供重试，不阻塞消息区。 */
  const loadAccount = async () => {
    const version = ++loadVersion
    loading.value = true
    const results = await Promise.allSettled([user.getUserInfo(), loadIdentities(), loadThirdAccounts()])
    if (version !== loadVersion) return
    const [, identityResult, thirdResult] = results
    if (identityResult.status === 'fulfilled') {
      identities.value = identityResult.value.identities
      editableProviders.value = identityResult.value.providers
    }
    if (thirdResult.status === 'fulfilled') thirdAccounts.value = thirdResult.value
    loadError.value = results.some(result => result.status === 'rejected')
    loading.value = false
  }

  /** 切换主功能时同步旧 Store 页签，通知入口继续使用原大写 key。 */
  const selectContent = (key: unknown) => {
    activeKey.value = isContentKey(key) ? key : 'StationMessage'
    accountInfoVisible.value = false
    homeViewVisible.value = false
    user.tabKey = activeKey.value
  }

  /** 复用旧组件的 query.anchor 定位邮箱/手机号编辑区。 */
  const openAccountInfo = (target?: AccountEditTarget) => {
    if (!isNoCommunity) return
    homeViewVisible.value = false
    accountInfoVisible.value = true
    if (target) void router.replace({ query: { ...route.query, anchor: target } })
  }

  /** 首页视图只对普通用户开放，应用用户沿用原限制。 */
  const openHomeView = () => {
    if (user.isApplicationUser) return
    accountInfoVisible.value = false
    homeViewVisible.value = true
  }

  /** 历史 HomeView/BindThirdAccount 入口仍可打开对应功能，无效 key 回落消息中心。 */
  const applyLegacyTab = (key: unknown) => {
    if (key === 'HomeView' && !user.isApplicationUser) openHomeView()
    else if (key === 'BindThirdAccount' && isNoCommunity) openAccountInfo()
    else selectContent(key)
  }

  /** 编辑可能变更身份及第三方绑定，关闭后重新读取卡片数据。 */
  const closeAccountInfo = () => {
    accountInfoVisible.value = false
    void loadAccount()
  }

  // 同步处理 Store 页签，避免排队的回声关闭随后打开的锚点弹窗；外部通知仍可关闭辅助视图。
  watch(() => user.tabKey, applyLegacyTab, { flush: 'sync' })
  watch(() => routerParams.params.value?.tabKey, key => {
    if (key) applyLegacyTab(key)
  })
  watch(() => route.query.anchor, anchor => {
    if (anchor === 'email-section' || anchor === 'phone-section') openAccountInfo()
  }, { immediate: true })

  // 仅在收到新通知上下文时切换，避免旧消息持续把手动选择的订阅/令牌页切回。
  watch([() => user.messageInfo, () => routerParams.params.value?.row], ([message, row]) => {
    if (message?.topicProvider || row?.topicProvider) selectContent('StationMessage')
  })
  watch(() => user.isApplicationUser, isApplication => {
    if (isApplication) homeViewVisible.value = false
  })

  onMounted(() => {
    const requestedKey = routerParams.params.value?.tabKey
    if (requestedKey) applyLegacyTab(requestedKey)
    else selectContent(isContentKey(user.tabKey) ? user.tabKey : 'StationMessage')
    if (route.query.anchor === 'email-section' || route.query.anchor === 'phone-section') openAccountInfo()
    if (user.messageInfo?.topicProvider || routerParams.params.value?.row?.topicProvider) selectContent('StationMessage')
    void loadAccount()
  })
  onUnmounted(() => {
    // 使尚未返回的卡片请求失效；Store 清理与旧页面保持一致。
    loadVersion += 1
    user.tabKey = tabList[0]?.key || 'HomeView'
    user.other.tabKey = ''
  })

  return {
    activeKey, activeTitle, segments, profile, loading, loadError,
    accountInfoVisible, homeViewVisible, editPasswordVisible,
    selectContent, loadAccount, openAccountInfo, openHomeView, closeAccountInfo,
  }
}
