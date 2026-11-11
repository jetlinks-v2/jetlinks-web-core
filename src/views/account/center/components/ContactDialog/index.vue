<script setup lang="ts">
import { toRef, type PropType } from 'vue'
import { useContactDialog } from './useContactDialog'
import type { IdentityProvider } from './useIdentityBinding'
const props = defineProps({
  provider: { type: String as PropType<IdentityProvider>, required: true },
  identityEnabled: { type: Boolean, default: false },
})
const emit = defineEmits<{ (event: 'close'): void; (event: 'notification-settings'): void }>()
const {
  field, contactForm, validateInfos, profile, code, validation, countdown,
  identityFailed, loadIdentities, needsVerification, busy, sendingCode, submitting,
  saveFailed, canSendCode, canConfirm, sendCode, confirm,
} = useContactDialog(props.provider, toRef(props, 'identityEnabled'))
async function confirmContact() {
  if (await confirm()) emit('close')
}
</script>

<template>
  <a-modal open :width="480" centered :title="$t(provider === 'mobile' ? (profile[field] ? 'PersonalCenter.changePhone' : 'PersonalCenter.prototype.bindPhone') : (profile[field] ? 'PersonalCenter.changeEmail' : 'PersonalCenter.prototype.bindEmail'))" :mask-closable="false" :closable="!busy" :keyboard="!busy" @cancel="!busy && emit('close')">
    <a-typography-paragraph v-if="profile[field]" type="secondary">
      {{ $t(provider === 'mobile' ? 'PersonalCenter.phoneContactChangeHint' : 'PersonalCenter.emailContactChangeHint', { value: profile[field] }) }}
    </a-typography-paragraph>
    <a-typography-paragraph v-else type="secondary">
      <i18n-t :keypath="provider === 'mobile' ? 'PersonalCenter.phoneContactEmptyHint' : 'PersonalCenter.emailContactEmptyHint'" tag="span">
        <template #settings><a-typography-link :disabled="busy" @click="!busy && emit('notification-settings')">{{ $t('PersonalCenter.notifications') }}</a-typography-link></template>
      </i18n-t>
    </a-typography-paragraph>
    <a-alert v-if="identityFailed" type="error" show-icon :message="$t('PersonalCenter.identityFailed')" class="contact-dialog__feedback">
      <template #action><a-button type="link" :disabled="busy" @click="loadIdentities">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>
    <a-alert v-if="saveFailed" type="error" show-icon :message="$t('PersonalCenter.contactSaveFailed')" class="contact-dialog__feedback" />
    <a-form :model="contactForm" layout="vertical" @finish="confirmContact">
      <a-form-item v-bind="validateInfos[field]" :name="field" required :style="needsVerification ? undefined : { marginBottom: 0 }" :label="$t(provider === 'mobile' ? (profile[field] ? 'PersonalCenter.prototype.newPhone' : 'AccountInfo.basicPhone') : (profile[field] ? 'PersonalCenter.prototype.newEmail' : 'AccountInfo.basicEmail'))">
        <a-input v-model:value="contactForm[field]" :disabled="busy" :type="provider === 'email' ? 'email' : 'tel'" :placeholder="$t(provider === 'mobile' ? 'AccountInfo.pleaseEnterPhone' : 'AccountInfo.pleaseEnterEmail')" allow-clear />
      </a-form-item>
      <a-form-item v-if="needsVerification" required :label="$t('verify.codeLabel')" :style="{ marginBottom: 0 }">
        <a-space-compact block>
          <a-input v-model:value="code" :disabled="!validation || busy" :placeholder="$t('AccountInfo.enterCode')" :aria-label="$t('verify.codeLabel')" autocomplete="one-time-code" />
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
