import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Subscription } from 'rxjs'
import { BASE_API } from '@jetlinks-web/constants'
import { getSsoBinds_api, unBind_api, getSsoBindingEvents_api } from '@jetlinks-web-core/api/account/center'
import { DingTalk, WeixinCorp } from '@jetlinks-web-core/assets/notice'
import { InternalStandalone, ThirdParty } from '@jetlinks-web-core/assets/apply'
import { canBindSso } from './ssoBindingCapability'

export interface SsoBinding {
  id: string; name: string; provider: string; bound: boolean
  bindTime?: number; applicationUserId?: string; logoUrl?: string
  others?: { name?: string }; features?: string[]
}

/** 绑定沿用平台跳转流程；窗口返回时刷新，监听只在当前页存活。 */
export function useSsoBindings() {
  const bindings = ref<SsoBinding[]>([])
  const loading = ref(false)
  const failed = ref(false)
  const unbinding = ref('')
  const binding = ref<SsoBinding>()
  const authorizationUrl = ref('')
  const bindingState = ref<'loading' | 'active' | 'checking' | 'failed' | 'expired'>('loading')
  let bindingSubscription: Subscription | undefined
  let bindingVersion = 0
  let disposed = false
  let requestVersion = 0
  const icons: Record<string, string> = {
    'dingtalk-ent-app': DingTalk, 'wechat-webapp': WeixinCorp,
    'internal-standalone': InternalStandalone, 'third-party': ThirdParty,
  }
  const boundCount = computed(() => bindings.value.filter(item => item.bound).length)
  async function load() {
    const current = ++requestVersion
    loading.value = true
    try {
      const response = await getSsoBinds_api()
      if (disposed || current !== requestVersion) return
      const result = Array.isArray(response) ? response : response?.result
      if (response?.success === false || !Array.isArray(result)) {
        throw new Error('SSO binding query failed')
      }
      bindings.value = result as SsoBinding[]
      failed.value = false
    } catch { if (!disposed && current === requestVersion) failed.value = true }
    finally { if (!disposed && current === requestVersion) loading.value = false }
  }
  function closeBinding() {
    bindingVersion++
    bindingSubscription?.unsubscribe()
    bindingSubscription = undefined
    binding.value = undefined
    authorizationUrl.value = ''
  }
  function bind(item: SsoBinding) {
    if (!canBindSso(item)) return
    if (!['wechat-official-account', 'dingtalk-ent-app'].includes(item.provider)) {
      localStorage.setItem('onBind', 'false')
      localStorage.setItem('onLogin', 'yes')
      window.open(BASE_API + '/application/sso/' + encodeURIComponent(item.id) + '/login?autoCreateUser=false')
      return
    }
    closeBinding()
    binding.value = item
    bindingState.value = 'loading'
    const current = bindingVersion
    bindingSubscription = getSsoBindingEvents_api(item.id).subscribe({
      next(event) {
        if (current !== bindingVersion) return
        if (event.type === 'init') {
          authorizationUrl.value = event.result
          bindingState.value = 'active'
        } else if (event.type === 'success') {
          authorizationUrl.value = ''
          bindingState.value = event.result.bound ? 'checking' : 'failed'
          if (event.result.bound) {
            // 成功事件还需绑定列表读回确认，不消费任何登录凭证。
            void load().then(() => {
              if (current !== bindingVersion) return
              if (bindings.value.some(value => value.id === item.id && value.bound)) closeBinding()
              else bindingState.value = 'failed'
            })
          }
        } else if (event.type === 'failed') {
          authorizationUrl.value = ''
          bindingState.value = 'failed'
        }
      },
      error() { if (current === bindingVersion) bindingState.value = 'failed' },
      complete() {
        if (current === bindingVersion && ['loading', 'active'].includes(bindingState.value)) {
          authorizationUrl.value = ''
          bindingState.value = 'expired'
        }
      },
    })
  }
  async function unbind(id: string) {
    if (unbinding.value) return
    unbinding.value = id
    try {
      const response = await unBind_api(id)
      if (!response.success && response.status !== 200) throw new Error('Unbind failed')
      await load()
    } catch { failed.value = true }
    finally { unbinding.value = '' }
  }
  function onStorage(event: StorageEvent) {
    if (event.key === 'onBind' || event.key === 'onLogin') void load()
  }
  onMounted(() => {
    void load()
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', load)
  })
  onUnmounted(() => {
    disposed = true
    closeBinding()
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('focus', load)
  })
  return { bindings, boundCount, loading, failed, unbinding, icons, load, canBindSso, bind, unbind, binding, authorizationUrl, bindingState, closeBinding }
}
