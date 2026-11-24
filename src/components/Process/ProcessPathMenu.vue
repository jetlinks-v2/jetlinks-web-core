<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { processStepTypes } from './model'
import { processMessages } from './messages'
import type { ProcessStep } from './types'
defineProps<{label:string;compact?:boolean}>()
const emit = defineEmits<{choose:[type:ProcessStep['type']];open:[value:boolean]}>()
const {t} = useI18n({useScope:'local',messages:processMessages})
</script>
<template>
  <a-dropdown :trigger="['click']" @open-change="value => emit('open',value)"><a-button :type="compact ? 'text' : 'dashed'" :size="compact ? 'small' : 'middle'" :block="!compact" :aria-label="label">{{ compact ? '+' : '+ ' + label }}</a-button><template #overlay><a-menu @click="({key}) => emit('choose',String(key) as ProcessStep['type'])"><a-menu-item v-for="type in processStepTypes" :key="type">{{ t(type) }}</a-menu-item></a-menu></template></a-dropdown>
</template>
