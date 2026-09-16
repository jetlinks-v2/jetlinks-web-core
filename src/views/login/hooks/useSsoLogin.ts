import { computed, onBeforeUnmount, ref } from 'vue'
import { LocalStore } from '@jetlinks-web/utils'
import { useRequest } from '@jetlinks-web/hooks'
import { bindInfoWithoutProjectContext } from '@jetlinks-web-core/api/login'
import { toDefaultLoginSuccessHref } from '../utils/redirect'

export interface SsoBinding {
  id: string
  name?: string
  provider?: string
  logoUrl?: string
  config?: Record<string, any>
  [key: string]: any
}

const BASE_API_PATH = import.meta.env.VITE_APP_BASE_API

/**
 * SSO 登录入口。
 *
 * `bindInfo` 同时喂两条链路：公众号应用给扫码/微信浏览器登录用，其余应用在页面上
 * 直接以图标入口弹出对应 SSO 登录页。两者共用同一次请求，避免重复拉取绑定信息。
 */
export const useSsoLogin = () => {
  const bindings = ref<SsoBinding[]>([])
  const hasLoaded = ref(false)
  const ssoPopupPending = ref(false)

  const { run: loadBindings } = useRequest(bindInfoWithoutProjectContext, {
    immediate: false,
    onSuccess: (res) => {
      bindings.value = Array.isArray(res?.result) ? res.result : []
    },
  })

  /** 登录方式区已提供微信扫码时的公众号应用；没有 appId 时不能作为扫码入口。 */
  const wechatRecord = computed<SsoBinding | null>(() => (
    bindings.value.find(item => (
      item.provider === 'wechat-official-account' && item.config?.appId
    )) || null
  ))

  /** 图标入口列表：排除已作为微信扫码方式展示的同一个应用，避免重复入口。 */
  const thirdPartyBindings = computed(() => {
    const wechatId = wechatRecord.value?.id

    return bindings.value.filter(item => item.id !== wechatId)
  })

  const handleCredentialStorage = (event: StorageEvent) => {
    // SSO 弹窗登录成功后会把凭证写入 storage；只处理当前这次弹窗，避免重复跳转。
    if (!ssoPopupPending.value || !event.newValue) {
      return
    }

    ssoPopupPending.value = false
    window.location.href = toDefaultLoginSuccessHref()
  }

  const openSsoLogin = (item: SsoBinding) => {
    if (!item?.id) {
      return
    }

    // 与重登录弹窗一致：跳走前标记本次不是普通登录，避免回到页面时重复初始化。
    LocalStore.set('onLogin', 'no')
    window.removeEventListener('storage', handleCredentialStorage)
    window.addEventListener('storage', handleCredentialStorage)
    ssoPopupPending.value = true
    window.open(`${BASE_API_PATH}/application/sso/${item.id}/login`)
  }

  const ensureLoaded = () => {
    if (hasLoaded.value) {
      return
    }

    hasLoaded.value = true
    loadBindings()
  }

  onBeforeUnmount(() => {
    window.removeEventListener('storage', handleCredentialStorage)
  })

  return {
    bindings,
    wechatRecord,
    thirdPartyBindings,
    ensureLoaded,
    openSsoLogin,
  }
}
