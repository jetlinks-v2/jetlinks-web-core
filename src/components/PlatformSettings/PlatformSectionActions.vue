<template>
  <a-space>
    <a-button v-if="!editing" :disabled="disabled" @click="emit('edit')">{{ t('PlatformSettings.modify') }}</a-button>
    <template v-else>
      <a-button :disabled="disabled" @click="emit('cancel')">{{ t('PlatformSettings.cancel') }}</a-button>
      <a-button type="primary" :disabled="disabled" :loading="saving" @click="emit('save')">{{ t('PlatformSettings.save') }}</a-button>
    </template>
  </a-space>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{ editing: boolean; disabled: boolean; saving: boolean }>()
const emit = defineEmits<{ edit: []; cancel: []; save: [] }>()
const { t } = useI18n()
</script>
