<template>
  <a-spin class="runtime-diagnostics" :spinning="state.status === 'loading'">
    <a-result v-if="state.status === 'forbidden'" status="403" :title="t('runtimeDiagnostics.forbidden')" />
    <a-result v-else-if="state.status === 'error'" status="warning" :title="t('runtimeDiagnostics.failed')">
      <template #subTitle>{{ state.message }}</template>
      <template #extra><a-button @click="emit('retry')">{{ t('runtimeDiagnostics.retry') }}</a-button></template>
    </a-result>
    <a-empty v-else-if="['empty', 'unsupported'].includes(state.status)" class="diagnostics-state-empty" :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="t(`runtimeDiagnostics.${state.status}`)" />
    <template v-else>
      <a-alert v-if="state.status === 'stale'" type="warning" show-icon :message="state.message || t('runtimeDiagnostics.stale')" />
      <slot />
    </template>
  </a-spin>
</template>
<script setup lang="ts">
import { Empty } from 'ant-design-vue'
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ViewState } from './types'
defineProps({ state: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) } })
const emit = defineEmits<{ (event: 'retry'): void }>()
const { t } = useI18n()
</script>
