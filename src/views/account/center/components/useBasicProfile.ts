import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { updateMeInfo_api } from '@jetlinks-web-core/api/account/center'
import type { AccountCardItem, AccountCardProfile } from '../types'

/** 资料修改继续提交完整用户资料，串行保存避免头像与姓名相互覆盖。 */
export function useBasicProfile(profile: () => AccountCardProfile) {
  const user = useUserStore()
  const { t } = useI18n()
  const saving = ref(false)
  const saveError = ref(false)
  const accountType = computed(() => t(user.isSubAccount
    ? 'components.LayoutSidebarUser.subAccount' : 'components.LayoutSidebarUser.mainAccount'))
  const userType = computed(() => user.userInfo.type?.name !== accountType.value ? user.userInfo.type?.name : '')
  const fields = computed<AccountCardItem[]>(() => {
    const items = ['username', 'mobile', 'email', 'orgs', 'roles']
      .flatMap(key => profile().items.filter(item => item.key === key))
    // 登录成功会覆盖此时间，因此展示“最近登录”，不冒充本次之前的登录时间。
    const loginTime = Number(user.userInfo.loginInfo?.loginTime)
    const date = dayjs(loginTime)
    if (Number.isFinite(loginTime) && loginTime > 0 && date.isValid()) {
      items.push({
        key: 'loginTime',
        label: t('PersonalCenter.latestLogin'),
        value: date.format('YYYY-MM-DD HH:mm:ss'),
      })
    }
    return items
  })
  async function save(patch: { name?: string; avatar?: string }) {
    if (saving.value || !profile().canEdit) return
    saving.value = true
    saveError.value = false
    try {
      const response = await updateMeInfo_api({ ...user.userInfo, ...patch })
      if (!response.success && response.status !== 200) throw new Error('Profile update failed')
      await user.getUserInfo()
      onlyMessage(t('AccountInfo.saveSuccess'), 'success')
    } catch {
      saveError.value = true
    } finally {
      saving.value = false
    }
  }
  function saveName(value: string) {
    const name = value.trim()
    if (!name) {
      onlyMessage(t('AccountInfo.basicNamePlaceholder'), 'warning')
      return
    }
    if (name !== user.userInfo.name) return save({ name })
  }
  function saveAvatar(avatar: string) { return save({ avatar }) }
  return { saving, saveError, fields, accountType, userType, saveName, saveAvatar }
}
