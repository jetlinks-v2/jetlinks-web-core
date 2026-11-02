import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  getSelfIdentities_api, requestIdentityValidation_api,
  confirmIdentityValidation_api, unbindIdentity_api,
} from '@jetlinks-web-core/api/account/center'

export type IdentityProvider = 'mobile' | 'email'
interface Identity { id: string; provider: string; identity: string; isPrimary?: boolean }
interface Validation { requestId: string; token: string; context?: Record<string, unknown>; identity: string }

/** 复用现有验证/确认契约；新号码变化或组件卸载后，不再消费旧请求的验证码。 */
export function useIdentityBinding(provider: IdentityProvider, enabled: boolean) {
  const identities = ref<Identity[]>([])
  const identity = ref('')
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
    if (!enabled) return
    const current = version
    loading.value = true
    try {
      const response = await getSelfIdentities_api()
      if (current === version) {
        identities.value = (response.result || []).filter(item => item.provider === provider)
        failed.value = false
      }
    } catch { if (current === version) failed.value = true }
    finally { if (current === version) loading.value = false }
  }
  async function sendCode() {
    if (!enabled || loading.value || busy.value || countdown.value || !validIdentity.value) return
    const current = ++version
    const target = identity.value.trim()
    busy.value = true
    failed.value = false
    try {
      const response = await requestIdentityValidation_api({ provider, identity: target })
      if (current !== version) return
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
  async function confirm() {
    const state = validation.value
    if (busy.value || !code.value.trim() || !state || state.identity !== identity.value.trim()) return
    busy.value = true
    failed.value = false
    try {
      const response = await confirmIdentityValidation_api(provider, {
        requestId: state.requestId, token: state.token, context: state.context, params: { code: code.value.trim() },
      })
      if (!response.success && response.status !== 200) throw new Error('Identity confirmation failed')
      validation.value = undefined
      identity.value = ''
      code.value = ''
      stopTimer()
      countdown.value = 0
      await load()
    } catch { failed.value = true }
    finally { busy.value = false }
  }
  async function unbind(id: string) {
    if (busy.value) return
    busy.value = true
    failed.value = false
    try {
      const response = await unbindIdentity_api(provider, [id])
      if (!response.success && response.status !== 200) throw new Error('Identity removal failed')
      await load()
    } catch { failed.value = true }
    finally { busy.value = false }
  }
  watch(identity, () => {
    if (validation.value && validation.value.identity !== identity.value.trim()) validation.value = undefined
  })
  onMounted(load)
  onUnmounted(() => { version++; stopTimer() })
  return { identities, identity, code, validation, countdown, busy, loading, failed, validIdentity, load, sendCode, confirm, unbind }
}
