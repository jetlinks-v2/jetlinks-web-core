import { computed, ref, toRef, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { useContactInfo } from '../AccountInfo/useContactInfo'
import { useIdentityBinding, type IdentityProvider } from './useIdentityBinding'

/** 联系方式与验证码共用一个值，统一提交并保留验证成功后的资料重试状态。 */
export function useContactDialog(provider: IdentityProvider, identityEnabled: Ref<boolean>) {
  const { t } = useI18n()
  const contact = useContactInfo()
  const field = provider === 'mobile' ? 'telephone' : 'email'
  const value = toRef(contact.contactForm, field)
  const binding = useIdentityBinding(provider, identityEnabled, value)
  const confirmedIdentity = ref('')
  const submitting = ref(false)
  const saveFailed = ref(false)
  const verified = computed(() => {
    const target = value.value.trim()
    return !!target && (confirmedIdentity.value === target
      || binding.identities.value.some(item => item.identity === target))
  })
  const needsVerification = computed(() => identityEnabled.value && !verified.value)
  const busy = computed(() => submitting.value || binding.busy.value || !!contact.savingContact.value)
  const sendingCode = computed(() => binding.busy.value && !submitting.value)
  const canSendCode = computed(() => needsVerification.value && !busy.value && !binding.loading.value
    && !binding.countdown.value && binding.validIdentity.value)
  const canConfirm = computed(() => {
    if (busy.value || !value.value.trim() || (identityEnabled.value && binding.loading.value)) return false
    if (!contact.contactChanged.value[field] && !needsVerification.value) return false
    return !needsVerification.value || (binding.validIdentity.value
      && binding.validation.value?.identity === value.value.trim() && !!binding.code.value.trim())
  })

  async function confirm() {
    if (!canConfirm.value) return false
    submitting.value = true
    saveFailed.value = false
    const target = value.value.trim()
    try {
      if (needsVerification.value) {
        if (!await binding.confirm()) return false
        confirmedIdentity.value = target
      }
      if (value.value.trim() !== target) return false
      // 身份确认与资料保存是两个接口；保存失败时保留已确认的地址，不重复消费验证码。
      if (contact.contactChanged.value[field]) {
        const saved = await contact.saveContact(field)
        saveFailed.value = !saved && contact.validateInfos[field]?.validateStatus !== 'error'
        return saved
      }
      onlyMessage(t(provider === 'mobile' ? 'PersonalCenter.prototype.phoneBound' : 'PersonalCenter.prototype.emailBound'), 'success')
      return true
    } finally {
      submitting.value = false
    }
  }

  function sendCode() {
    if (canSendCode.value) return binding.sendCode()
  }

  watch(value, () => { saveFailed.value = false })
  return {
    field, contactForm: contact.contactForm, validateInfos: contact.validateInfos, profile: contact.profile,
    code: binding.code, validation: binding.validation, countdown: binding.countdown,
    identityFailed: binding.failed, loadIdentities: binding.load,
    needsVerification, busy, sendingCode, submitting, saveFailed, canSendCode, canConfirm, sendCode, confirm,
  }
}
