<script setup lang="ts">
import type { PropType } from 'vue'
import { QRCode } from 'ant-design-vue'
import type { SsoBinding } from './useSsoBindings'
defineProps({
  binding: { type: Object as PropType<SsoBinding>, default: undefined },
  state: { type: String, required: true },
  url: { type: String, default: '' },
})
defineEmits<{ (event: 'close'): void; (event: 'retry'): void }>()
</script>

<template>
  <a-modal :open="!!binding" :title="binding?.name" :width="440" :footer="null" destroy-on-close @cancel="$emit('close')">
    <div v-if="binding" class="sso-authorization">
      <a-spin v-if="state === 'loading' || state === 'checking'" />
      <template v-else-if="state === 'active'">
        <QRCode v-if="binding.provider === 'wechat-official-account'" :value="url" :size="240" />
        <iframe v-else :src="url" :title="binding.name" />
      </template>
      <template v-else>
        <a-alert type="warning" show-icon :message="$t('PersonalCenter.bindingRetry')" />
        <a-button @click="$emit('retry')">{{ $t('AccountCenter.retry') }}</a-button>
      </template>
    </div>
  </a-modal>
</template>

<style scoped>
.sso-authorization { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 16rem; gap: var(--space-4); }
.sso-authorization iframe { width: 100%; height: 26rem; border: 0; }
</style>
