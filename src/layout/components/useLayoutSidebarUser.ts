import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { logout } from '@jetlinks-web-core/api/login'
import { clearVerifyCache } from '@jetlinks-web-core/package'
import { jumpLogin } from '@jetlinks-web-core/router'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { useUserStore } from '@jetlinks-web-core/store/user'
import type { CenterTabKey } from '@jetlinks-web-core/views/account/center/data'

interface UserMenuEntry {
  key: CenterTabKey
  label: string
  count?: number
}

/** 顶部用户菜单复用账号资料、通知角标和既有个人中心路由。 */
export function useLayoutSidebarUser() {
  const { t } = useI18n()
  const userStore = useUserStore()
  const menuStore = useMenuStore()
  const open = ref(false)
  const logoutLoading = ref(false)
  const displayName = computed(() => userStore.userInfo?.name || userStore.userInfo?.username || '-')
  const account = computed(() => userStore.userInfo?.username || userStore.userInfo?.id || '-')
  const accountTypeLabel = computed(() => t(userStore.isSubAccount
    ? 'components.LayoutSidebarUser.subAccount'
    : 'components.LayoutSidebarUser.mainAccount'))
  const avatar = computed(() => (userStore.userInfo as { avatar?: string })?.avatar || '')
  const avatarText = computed(() => displayName.value.trim().slice(0, 1) || '用')
  const userTypeName = computed(() => {
    const name = userStore.userInfo.type?.name?.trim()
    return name && name !== accountTypeLabel.value ? name : ''
  })
  const identityTags = computed(() => [
    { key: 'account', label: accountTypeLabel.value },
    ...(userTypeName.value ? [{ key: 'userType', label: userTypeName.value }] : []),
  ])
  const roleSummary = computed(() => {
    const names = (userStore.userInfo.roleList || []).flatMap(role => {
      if (!role || typeof role !== 'object' || !('name' in role)) return []
      return typeof role.name === 'string' && role.name.trim() ? [role.name.trim()] : []
    })
    // 类型和角色分别展示，类型不再随长账号一起被省略；同名信息只保留一处。
    return [...new Set(names)]
      .filter(name => name !== userTypeName.value && name !== accountTypeLabel.value)
      .join('、')
  })
  const menuEntries = computed<UserMenuEntry[]>(() => [
    { key: 'BindThirdAccount', label: t('components.LayoutSidebarUser.accountCenter') },
    { key: 'StationMessage', label: t('components.LayoutSidebarUser.messageCenter'), count: userStore.unreadNoticeCount },
    { key: 'PersonalToken', label: t('center.data.756829-4') },
  ])

  const goAccountCenter = (tabKey: CenterTabKey) => {
    open.value = false
    // 显式选择入口时清除旧通知上下文，避免旧消息将个人令牌切回消息中心。
    userStore.messageInfo = {}
    userStore.other.tabKey = ''
    // 同页导航必须携带规范化的 tab；只传临时 params 会清空 query，被框架侧栏重置为默认页。
    // 页面统一从 query 驱动内容和 Store，避免先改 Store 再导航产生两次竞争的路由更新。
    const contentTab = tabKey === 'BindThirdAccount' ? 'BasicInfo' : tabKey
    menuStore.routerPush('account/center', {
      params: { tabKey },
      query: { tab: contentTab },
    })
  }

  const handleLogout = async () => {
    if (logoutLoading.value) return
    logoutLoading.value = true
    try {
      const resp = await logout()
      if (resp.success) {
        open.value = false
        clearVerifyCache()
        jumpLogin({ reason: 'logout' })
      }
    } finally {
      logoutLoading.value = false
    }
  }

  return {
    open, logoutLoading, displayName, account, userTypeName, roleSummary, accountTypeLabel, identityTags, avatar, avatarText,
    menuEntries, goAccountCenter, handleLogout,
  }
}
