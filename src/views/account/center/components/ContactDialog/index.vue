<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useContactInfo } from '../AccountInfo/useContactInfo'
import IdentityBinding from './IdentityBinding.vue'
import type { IdentityProvider } from './useIdentityBinding'
const props = defineProps({
  provider: { type: String as PropType<IdentityProvider>, required: true },
  identityEnabled: { type: Boolean, default: false },
})
const emit = defineEmits<{ (event: 'close'): void; (event: 'notification-settings'): void }>()
const { contactForm, contactChanged, savingContact, validateInfos, saveContact, profile } = useContactInfo()
const field = computed(() => props.provider === 'mobile' ? 'telephone' : 'email')
async function confirmContact() {
  if (await saveContact(field.value)) emit('close')
}
</script>

<template>
  <a-modal open :width="480" centered :title="$t(provider === 'mobile' ? (profile[field] ? 'PersonalCenter.changePhone' : 'PersonalCenter.prototype.bindPhone') : (profile[field] ? 'PersonalCenter.changeEmail' : 'PersonalCenter.prototype.bindEmail'))" :mask-closable="false" @cancel="!savingContact && $emit('close')">
    <a-typography-paragraph v-if="profile[field]" type="secondary">
      {{ $t(provider === 'mobile' ? 'PersonalCenter.phoneContactChangeHint' : 'PersonalCenter.emailContactChangeHint', { value: profile[field] }) }}
    </a-typography-paragraph>
    <a-typography-paragraph v-else type="secondary">
      <i18n-t :keypath="provider === 'mobile' ? 'PersonalCenter.phoneContactEmptyHint' : 'PersonalCenter.emailContactEmptyHint'" tag="span">
        <template #settings><a-typography-link :disabled="!!savingContact" @click="!savingContact && $emit('notification-settings')">{{ $t('PersonalCenter.notifications') }}</a-typography-link></template>
      </i18n-t>
    </a-typography-paragraph>
    <a-form :model="contactForm" layout="vertical">
      <a-form-item v-bind="validateInfos[field]" :name="field" required :style="{ marginBottom: 0 }" :label="$t(provider === 'mobile' ? (profile[field] ? 'PersonalCenter.prototype.newPhone' : 'AccountInfo.basicPhone') : (profile[field] ? 'PersonalCenter.prototype.newEmail' : 'AccountInfo.basicEmail'))">
        <a-input v-model:value="contactForm[field]" :disabled="!!savingContact" :type="provider === 'email' ? 'email' : 'tel'" allow-clear />
      </a-form-item>
    </a-form>
    <IdentityBinding v-if="identityEnabled" :provider="provider" />
    <template #footer>
      <a-button :disabled="!!savingContact" @click="emit('close')">{{ $t('Save.index.551009-1') }}</a-button>
      <a-button type="primary" :loading="savingContact === field" :disabled="!!savingContact || !contactForm[field].trim() || !contactChanged[field]" @click="confirmContact">{{ $t('Save.index.551009-0') }}</a-button>
    </template>
  </a-modal>
</template>
