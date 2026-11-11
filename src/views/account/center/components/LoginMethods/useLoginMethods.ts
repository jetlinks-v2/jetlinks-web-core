import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { useBasicLayoutVariant } from '@jetlinks-web-core/layout/hooks/useBasicLayoutVariant'
import { getPasswordChangeSetting_api } from '@jetlinks-web-core/api/account/center'
import type { AccountCardProfile } from '../../types'
import { useSsoBindings, type SsoBinding } from '../BindThirdAccount/useSsoBindings'

export interface LoginMethodEntry {
  key: string
  kind: 'password' | 'mobile' | 'email' | 'sso'
  label: string
  icon: string
  value: string
  detail?: string
  description: string
  descriptionKey?: string
  state?: { text: string; bound: boolean; status?: 'success' | 'warning' | 'default' }
  binding?: SsoBinding
}

/** 汇总登录方式展示，验证身份与资料联系方式分开判断，绑定命令复用原授权生命周期。 */
export function useLoginMethods(profile: () => AccountCardProfile) {
  const { t } = useI18n()
  const sso = useSsoBindings()
  const menu = useMenuStore()
  const layoutVariant = useBasicLayoutVariant()
  // 运营端与项目/应用端分别维护登录入口，文案和权限跳转使用同一个菜单配置。
  const ssoSettings = computed(() => layoutVariant.value === 'tenant'
    ? { code: 'system/Apply', label: t('PersonalCenter.ssoSettingsNameOperations') }
    : { code: 'system/ThirdPartyLogin', label: t('PersonalCenter.ssoSettingsName') })
  const canManageSso = computed(() => menu.hasMenu(ssoSettings.value.code))
  const passwordTime = ref<number>()
  let disposed = false
  const passwordAgeDays = computed(() => passwordTime.value
    ? dayjs().startOf('day').diff(dayjs(passwordTime.value).startOf('day'), 'day') : undefined)
  const passwordValue = computed(() => {
    if (!passwordTime.value) return ''
    return t('PersonalCenter.passwordChangedAt', { time: dayjs(passwordTime.value).format('YYYY-MM-DD') })
  })
  const passwordDetail = computed(() => passwordAgeDays.value === undefined || passwordAgeDays.value < 0 ? ''
    : passwordAgeDays.value === 0 ? t('PersonalCenter.passwordChangedToday') : t('PersonalCenter.passwordChangedDaysAgo', { days: passwordAgeDays.value }))
  const passwordState = computed<LoginMethodEntry['state']>(() => {
    if (passwordAgeDays.value === undefined || passwordAgeDays.value < 0) return undefined
    const overdue = passwordAgeDays.value > 90
    return { bound: true, status: overdue ? 'warning' : 'success', text: t(overdue ? 'PersonalCenter.passwordChangeRecommended' : 'PersonalCenter.configured') }
  })

  // 历史账号可能没有修改时间；缺失时不能推断仍在使用初始密码。
  async function loadPasswordTime() {
    try {
      const response = await getPasswordChangeSetting_api()
      if (disposed) return
      if (response?.success === false || (response?.success !== true && response?.status !== 200)) return
      const value = Number(response.result?.content)
      passwordTime.value = Number.isFinite(value) && value > 0 && dayjs(value).isValid() ? value : undefined
    } catch {
      if (!disposed) passwordTime.value = undefined
    }
  }

  /** 菜单由当前用户权限生成；无权访问时不提供配置跳转。 */
  function openSsoSettings() {
    if (canManageSso.value) return menu.jumpPage(ssoSettings.value.code)
  }
  const entries = computed<LoginMethodEntry[]>(() => {
    const contactEntries: LoginMethodEntry[] = (['mobile', 'email'] as const).map(kind => {
      const contact = profile().contacts?.[kind]
      const descriptionKey = kind === 'mobile' ? 'PersonalCenter.phoneLoginHint' : 'PersonalCenter.emailLoginHint'
      return {
        key: kind === 'mobile' ? 'phone-section' : 'email-section', kind,
        label: t(kind === 'mobile' ? 'AccountInfo.phoneSection' : 'AccountInfo.basicEmail'),
        icon: kind === 'mobile' ? 'MobileOutlined' : 'MailOutlined',
        value: contact?.value || t('AccountInfo.unbound'),
        descriptionKey,
        description: t(descriptionKey, { settings: t('PersonalCenter.notifications') }),
        // 资料值不代表身份已验证；只有已验证或确实未绑定时才展示原型状态。
        state: contact?.verified ? { bound: true, text: t('PersonalCenter.verified') }
          : contact?.value ? undefined : { bound: false, text: t('AccountInfo.unbound') },
      }
    })
    const bindingEntries: LoginMethodEntry[] = sso.bindings.value.map(binding => ({
      key: binding.id, kind: 'sso', label: binding.name,
      icon: binding.provider?.startsWith('wechat') ? 'WechatOutlined' : binding.provider?.startsWith('dingtalk') ? 'DingdingOutlined' : 'SafetyCertificateOutlined',
      value: binding.bound ? binding.others?.name || '' : '',
      detail: binding.bound && binding.bindTime && dayjs(binding.bindTime).isValid()
        ? t('PersonalCenter.boundAt', { time: dayjs(binding.bindTime).format('YYYY-MM-DD') }) : '',
      description: binding.provider?.startsWith('wechat') ? t('PersonalCenter.notificationWechat')
        : binding.provider?.startsWith('dingtalk') ? t('PersonalCenter.dingtalk') : binding.provider === 'oauth2' ? 'OAuth 2.0' : '',
      state: { bound: binding.bound, text: t(binding.bound ? 'BindThirdAccount.index.483756-0' : 'AccountInfo.unbound') }, binding,
    }))
    return [
      {
        key: 'password',
        kind: 'password',
        label: t('PersonalCenter.loginPassword'),
        icon: 'LockOutlined',
        value: passwordValue.value,
        detail: passwordDetail.value,
        state: passwordState.value,
        description: t('PersonalCenter.passwordHint'),
      },
      ...contactEntries, ...bindingEntries,
    ]
  })
  onMounted(loadPasswordTime)
  onUnmounted(() => { disposed = true })
  return { ...sso, entries, ssoSettings, canManageSso, openSsoSettings }
}
