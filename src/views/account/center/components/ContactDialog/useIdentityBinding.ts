import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import {
  getSelfIdentities_api, requestIdentityValidation_api,
  confirmIdentityValidation_api, unbindIdentity_api,
} from '@jetlinks-web-core/api/account/center'

export type IdentityProvider = 'mobile' | 'email'
interface Identity { id: string; provider: string; identity: string; isPrimary?: boolean }
interface Validation { requestId: string; token: string; context?: Record<string, unknown>; identity: string }

/** 共享输入时由调用方保存资料，不清空地址；验证码始终对应原始验证目标。 */
export function useIdentityBinding(provider: IdentityProvider, enabled: boolean | Ref<boolean>, sharedIdentity?: Ref<string>) {
  const isEnabled = computed(() => typeof enabled === 'boolean' ? enabled : enabled.value)
  const identities = ref<Identity[]>([])
  const identity = sharedIdentity ?? ref('')
  const code = ref('')
  const validation = ref<Validation>()
  const countdown = ref(0)
  const busy = ref(false)
  const loading = ref(false)
  const failed = ref(false)
  let version = 0
  let timer: ReturnType<typeof setInterval> | undefined
  const validIdentity = computed(() => provider === 'mobile'
    ? /^1[3-9]\d{9}$/.test(identity.value.trim())
    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.value.trim()))
  function stopTimer() { if (timer) clearInterval(timer); timer = undefined }
  async function load() {
    if (!isEnabled.value) return
    const current = version
    loading.value = true
    try {
      const response = await getSelfIdentities_api()
      if (response?.success === false || !Array.isArray(response?.result)) throw new Error('Identity query failed')
      if (current === version) {
        identities.value = (response.result || []).filter(item => item.provider === provider)
        failed.value = false
      }
    } catch { if (current === version) failed.value = true }
    finally { if (current === version) loading.value = false }
  }
  async function sendCode() {
    if (!isEnabled.value || loading.value || busy.value || countdown.value || !validIdentity.value) return
    const current = ++version
    const target = identity.value.trim()
    busy.value = true
    failed.value = false
    try {
      const response = await requestIdentityValidation_api({ provider, identity: target })
      if (current !== version || target !== identity.value.trim()) return
      if (response?.success === false || (response?.success !== true && response?.status !== 200)) throw new Error('Identity challenge failed')
      if (!response.result?.requestId || !response.result?.token) throw new Error('Missing validation challenge')
      validation.value = { ...response.result, identity: target }
      code.value = ''
      countdown.value = Math.max(0, response.result.intervalSeconds ?? 60)
      stopTimer()
      if (countdown.value) timer = setInterval(() => {
        countdown.value = Math.max(0, countdown.value - 1)
        if (!countdown.value) stopTimer()
      }, 1000)
    } catch { if (current === version) failed.value = true }
    finally { if (current === version) busy.value = false }
  }
  async function confirm(): Promise<boolean> {
    const state = validation.value
    if (!isEnabled.value || busy.value || !code.value.trim() || !state || state.identity !== identity.value.trim()) return false
    const current = version
    busy.value = true
    failed.value = false
    try {
      const response = await confirmIdentityValidation_api(provider, {
        requestId: state.requestId, token: state.token, context: state.context, params: { code: code.value.trim() },
      })
      if (current !== version) return false
      if (response?.success === false || (response?.success !== true && response?.status !== 200)) throw new Error('Identity confirmation failed')
      validation.value = undefined
      if (!sharedIdentity) identity.value = ''
      code.value = ''
      stopTimer()
      countdown.value = 0
      await load()
      return current === version
    } catch {
      if (current === version) failed.value = true
      return false
    } finally { if (current === version) busy.value = false }
  }
  async function unbind(id: string) {
    if (busy.value) return
    busy.value = true
    failed.value = false
    try {
      const response = await unbindIdentity_api(provider, [id])
      if (response?.success === false || (response?.success !== true && response?.status !== 200)) throw new Error('Identity removal failed')
      await load()
    } catch { failed.value = true }
    finally { busy.value = false }
  }
  watch(identity, () => {
    if (validation.value && validation.value.identity !== identity.value.trim()) {
      validation.value = undefined
      code.value = ''
    }
  })
  // 身份提供商可能晚于锚点弹窗加载；能力就绪后再读取，不能固定使用初次打开时的值。
  watch(isEnabled, enabled => {
    if (enabled) { void load(); return }
    version++
    stopTimer()
    identities.value = []
    validation.value = undefined
    code.value = ''
    countdown.value = 0
    busy.value = false
    loading.value = false
    failed.value = false
  })
  onMounted(load)
  onUnmounted(() => { version++; stopTimer() })
  return { identities, identity, code, validation, countdown, busy, loading, failed, validIdentity, load, sendCode, confirm, unbind }
}
