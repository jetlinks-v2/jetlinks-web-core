<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useContactInfo } from '../AccountInfo/useContactInfo'
import IdentityBinding from './IdentityBinding.vue'
import type { IdentityProvider } from './useIdentityBinding'
const props = defineProps({
  provider: { type: String as PropType<IdentityProvider>, required: true },
  identityEnabled: { type: Boolean, default: false },
})
defineEmits<{ (event: 'close'): void }>()
const { contactForm, contactChanged, savingContact, validateInfos, saveContact } = useContactInfo()
const field = computed(() => props.provider === 'mobile' ? 'telephone' : 'email')
</script>

<template>
  <a-modal open :width="480" :title="$t(provider === 'mobile' ? 'AccountInfo.basicPhone' : 'AccountInfo.basicEmail')" :footer="null" :mask-closable="false" @cancel="!savingContact && $emit('close')">
    <a-form :model="contactForm" layout="vertical">
      <a-form-item v-bind="validateInfos[field]" :name="field" :label="$t('PersonalCenter.contactProfile')">
        <a-input v-model:value="contactForm[field]" :disabled="!!savingContact" :type="provider === 'email' ? 'email' : 'tel'" allow-clear />
      </a-form-item>
      <a-button type="primary" :loading="savingContact === field" :disabled="!!savingContact || !contactChanged[field]" @click="saveContact(field)">{{ $t('AccountInfo.save') }}</a-button>
    </a-form>
    <IdentityBinding v-if="identityEnabled" :provider="provider" />
  </a-modal>
</template>
