<script setup lang="ts">
import { computed, toRef, type PropType } from 'vue'
import { useContactDialog } from './useContactDialog'
import type { IdentityProvider } from './useIdentityBinding'
import type { ContactVerificationState } from '../../types'
const props = defineProps({
  provider: { type: String as PropType<IdentityProvider>, required: true },
  verificationState: { type: String as PropType<ContactVerificationState>, default: 'loading' },
  confirmedValue: { type: String, default: '' },
})
const emit = defineEmits<{ (event: 'close'): void; (event: 'notification-settings'): void; (event: 'retry-verification'): void; (event: 'update:confirmedValue', value: string): void }>()
const confirmedValue = computed({ get: () => props.confirmedValue, set: (value: string) => emit('update:confirmedValue', value) })
const {
  field, contactForm, validateInfos, hasCurrentValue, currentValue, code, validation, countdown,
  identityError, identityErrorReason, identityLoadFailed, loadIdentities, verificationMessage, needsVerification, busy, sendingCode, submitting,
  saveFailed, canSendCode, canConfirm, sendCode, confirm,
} = useContactDialog(props.provider, toRef(props, 'verificationState'), confirmedValue)
async function confirmContact() {
  if (await confirm()) emit('close')
}
</script>

<template>
  <a-modal open :width="480" centered :title="$t(provider === 'mobile' ? (hasCurrentValue ? 'PersonalCenter.changePhone' : 'PersonalCenter.prototype.bindPhone') : (hasCurrentValue ? 'PersonalCenter.changeEmail' : 'PersonalCenter.prototype.bindEmail'))" :mask-closable="false" :closable="!busy" :keyboard="!busy" @cancel="!busy && emit('close')">
    <a-typography-paragraph v-if="hasCurrentValue" type="secondary">
      {{ $t(provider === 'mobile' ? 'PersonalCenter.phoneContactChangeHint' : 'PersonalCenter.emailContactChangeHint', { value: currentValue }) }}
    </a-typography-paragraph>
    <a-typography-paragraph v-else type="secondary">
      <i18n-t :keypath="provider === 'mobile' ? 'PersonalCenter.phoneContactEmptyHint' : 'PersonalCenter.emailContactEmptyHint'" tag="span">
        <template #settings><a-typography-link :disabled="busy" @click="!busy && emit('notification-settings')">{{ $t('PersonalCenter.notifications') }}</a-typography-link></template>
      </i18n-t>
    </a-typography-paragraph>
    <a-alert v-if="verificationMessage" :type="verificationState === 'loading' ? 'info' : verificationState === 'failed' ? 'error' : 'warning'" show-icon :message="verificationMessage" class="contact-dialog__feedback">
      <template v-if="verificationState !== 'loading'" #action><a-button type="link" :disabled="busy" @click="emit('retry-verification')">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>
    <a-alert v-if="!verificationMessage && identityError" type="error" show-icon :message="identityError" :description="identityErrorReason || undefined" class="contact-dialog__feedback">
      <template v-if="identityLoadFailed" #action><a-button type="link" :disabled="busy" @click="loadIdentities">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>
    <a-alert v-if="saveFailed" type="error" show-icon :message="$t('PersonalCenter.contactSaveFailed')" class="contact-dialog__feedback" />
    <a-form :model="contactForm" layout="vertical" @finish="confirmContact">
      <a-form-item v-bind="validateInfos[field]" :name="field" required :style="needsVerification ? undefined : { marginBottom: 0 }" :label="$t(provider === 'mobile' ? (hasCurrentValue ? 'PersonalCenter.prototype.newPhone' : 'AccountInfo.basicPhone') : (hasCurrentValue ? 'PersonalCenter.prototype.newEmail' : 'AccountInfo.basicEmail'))">
        <a-input v-model:value="contactForm[field]" :disabled="busy || verificationState !== 'ready'" :type="provider === 'email' ? 'email' : 'tel'" :placeholder="$t(provider === 'mobile' ? 'AccountInfo.pleaseEnterPhone' : 'AccountInfo.pleaseEnterEmail')" autocomplete="off" allow-clear />
      </a-form-item>
      <a-form-item v-if="needsVerification" required :label="$t('verify.codeLabel')" :extra="$t(provider === 'mobile' ? 'PersonalCenter.phoneCodeHint' : 'PersonalCenter.emailCodeHint')" :style="{ marginBottom: 0 }">
        <a-space-compact block>
          <a-input v-model:value="code" :disabled="verificationState !== 'ready' || !validation || busy" :placeholder="$t('PersonalCenter.contactCodePlaceholder')" :aria-label="$t('verify.codeLabel')" inputmode="numeric" :maxlength="6" autocomplete="one-time-code" />
          <a-button :loading="sendingCode" :disabled="!canSendCode" @click="sendCode">{{ countdown ? $t('PersonalCenter.resendIn', { seconds: countdown }) : $t('PersonalCenter.sendCode') }}</a-button>
        </a-space-compact>
      </a-form-item>
    </a-form>
    <template #footer>
      <a-button :disabled="busy" @click="emit('close')">{{ $t('Save.index.551009-1') }}</a-button>
      <a-button type="primary" :loading="submitting" :disabled="!canConfirm" @click="confirmContact">{{ $t('Save.index.551009-0') }}</a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.contact-dialog__feedback { margin-bottom: var(--space-4); }
</style>
