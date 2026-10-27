<template>
  <DiagnosticsState :state="state" @retry="emit('refresh')">
    <div class="runtime-mbean-overview">
      <dl v-if="showLifetime" class="runtime-lifetime"><dt>{{ t('runtimeDiagnostics.startTime') }}</dt><dd>{{ view.startTime === undefined ? '—' : new Date(view.startTime).toLocaleString() }}</dd><dt>{{ t('runtimeDiagnostics.uptime') }}</dt><dd>{{ uptime }}</dd></dl>
      <BufferOverviewChart v-if="view.buffers.length" :queues="view.buffers" :history="history" :config="config" :reset-access="resetAccess" :reset-state="resetState" @update:config="value => emit('update:config', value)" @reset="reset" @inspect="value => emit('inspect', value)" @settings="emit('settings')" />
    </div>
  </DiagnosticsState>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import BufferOverviewChart from './buffer/BufferOverviewChart.vue'
import DiagnosticsState from './DiagnosticsState.vue'
import { runtimeBeanOverview } from './utils'
import type { ActionAccess, BufferDisplayConfig, BufferHistorySample, MBeanDescriptor, ViewState } from './types'
const props = defineProps({ beans: { type: Array as PropType<MBeanDescriptor[]>, default: () => [] }, state: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) }, config: { type: Object as PropType<BufferDisplayConfig>, default: undefined }, history: { type: Array as PropType<BufferHistorySample[]>, default: () => [] }, showLifetime: { type: Boolean, default: true }, resetAccess: { type: Object as PropType<ActionAccess>, default: () => ({ allowed: false }) }, resetState: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) } })
const emit = defineEmits<{ (event: 'refresh'): void; (event: 'inspect', objectName: string): void; (event: 'update:config', config: BufferDisplayConfig): void; (event: 'reset', objectName: string): void; (event: 'settings'): void }>()
const { t } = useI18n()
const view = computed(() => runtimeBeanOverview(props.beans))
function reset(objectName: string) { if (props.resetAccess.allowed && props.resetState.status !== 'loading' && view.value.buffers.some(buffer => buffer.objectName === objectName)) emit('reset', objectName) }
const uptime = computed(() => {
  if (view.value.uptime === undefined) return '—'
  const seconds = Math.floor(view.value.uptime / 1000)
  return t('runtimeDiagnostics.uptimeDuration', { days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 })
})
</script>
<style scoped>
.runtime-mbean-overview { margin-block:8px 12px; min-width:0; }
.runtime-lifetime { display:flex; align-items:baseline; flex-wrap:wrap; gap:4px 10px; margin:0 0 6px; font-size:12px; }.runtime-lifetime dt { color:var(--ink-3); }.runtime-lifetime dt:not(:first-child) { margin-inline-start:12px; }.runtime-lifetime dd { margin:0; }
</style>
