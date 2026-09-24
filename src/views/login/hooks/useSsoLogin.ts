import { onBeforeUnmount, ref } from 'vue'
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
 * `bindInfo` 提供登录页入口：有 appId 的公众号扫码，其它应用打开 SSO 登录页。
 * 两类入口共用一次请求，避免同一个公众号被渲染两次。
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
    ensureLoaded,
    openSsoLogin,
  }
}
