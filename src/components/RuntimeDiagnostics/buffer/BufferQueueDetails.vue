<template>
  <div class="buffer-details">
    <div class="buffer-details-heading">
      <a-button ref="detailsTrigger" type="text" size="small" :aria-expanded="expanded" @click="expanded = !expanded"><RightOutlined :rotate="expanded ? 90 : 0" />{{ t('runtimeDiagnostics.bufferQueueDetails', { count: queues.length }) }}</a-button>
      <span>{{ coverage }}</span>
    </div>
    <div v-if="expanded" class="buffer-details-table">
      <a-table :columns="columns" :data-source="queues" :pagination="false" :scroll="{ x: 1060 }" row-key="objectName" size="small">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'"><a-button type="link" size="small" :title="record.objectName" @click="emit('inspect', record.objectName)">{{ record.name }}</a-button></template>
          <template v-else-if="column.key === 'pending'">{{ numberText(record.pending) }}</template>
          <template v-else-if="column.key === 'rates'"><span :title="t('runtimeDiagnostics.bufferThroughputInfo')">{{ numberText(rates.get(record.objectName)?.writtenRate) }} / {{ numberText(rates.get(record.objectName)?.attemptedRate) }}</span></template>
          <template v-else-if="column.key === 'written' || column.key === 'attempted'">{{ counterText(record[column.key]) }}</template>
          <template v-else-if="column.key === 'dead'"><span :class="{ 'buffer-retained': record.dead !== undefined && record.dead > 0 }">{{ numberText(record.dead) }}</span></template>
          <template v-else-if="column.key === 'actions'">
            <a-space :size="2"><a-button type="link" size="small" @click="emit('inspect', record.objectName)">{{ t('runtimeDiagnostics.bufferInspect') }}</a-button><a-tooltip v-if="resetAccess.allowed" :title="resetAccess.reason" :trigger="['hover', 'focus']"><a-button type="link" size="small" :disabled="!canReset(record.objectName)" @click="event => request(record.objectName, event.currentTarget as HTMLElement)">{{ t('runtimeDiagnostics.bufferReset') }}</a-button></a-tooltip></a-space>
          </template>
        </template>
      </a-table>
    </div>
    <a-modal :open="resetOpen" :title="t('runtimeDiagnostics.bufferReset')" :ok-text="t('runtimeDiagnostics.bufferConfirm')" :cancel-text="t('runtimeDiagnostics.bufferCancel')" :confirm-loading="resetState.status === 'loading'" @ok="confirm" @cancel="cancel" @after-close="restoreFocus(detailsTrigger?.$el)">
      <p>{{ t('runtimeDiagnostics.bufferResetConfirm') }}</p><p class="buffer-reset-identity">{{ resetTarget }}</p>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, toRef, type PropType } from 'vue'
import { RightOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import type { ActionAccess, BufferHistorySample, ViewState } from '../types'
import type { runtimeBeanOverview } from '../utils'
import { bufferCounterText } from './counters'
import { bufferThroughputPoints } from './history'
import { useBufferQueueReset } from './useBufferQueueReset'
type BufferQueue = ReturnType<typeof runtimeBeanOverview>['buffers'][number]
const props = defineProps({ queues: { type: Array as PropType<BufferQueue[]>, default: () => [] }, history: { type: Array as PropType<BufferHistorySample[]>, default: () => [] }, scopeKey: { type: String, required: true }, coverage: { type: String, default: '' }, resetAccess: { type: Object as PropType<ActionAccess>, default: () => ({ allowed: false }) }, resetState: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) } })
const emit = defineEmits<{ (event: 'inspect' | 'reset', objectName: string): void }>()
const { t } = useI18n()
const expanded = ref(false), detailsTrigger = ref<{ $el: HTMLElement }>()
const { resetOpen, resetTarget, canReset, request, cancel, confirm, restoreFocus } = useBufferQueueReset({ queues: toRef(props, 'queues'), active: expanded, scope: toRef(props, 'scopeKey'), access: toRef(props, 'resetAccess'), state: toRef(props, 'resetState') }, objectName => emit('reset', objectName))
const rates = computed(() => new Map(props.queues.map(queue => [queue.objectName, bufferThroughputPoints(props.history, queue.objectName).at(-1)])))
const numberText = (value: number | undefined) => value === undefined || !Number.isFinite(value) || value < 0 ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
const counterText = (value: unknown) => { const count = bufferCounterText(value); return count === undefined ? '—' : BigInt(count).toLocaleString() }
const columns = computed(() => [
  { key: 'name', title: t('runtimeDiagnostics.bufferName'), width: 240, ellipsis: true },
  { key: 'pending', title: t('runtimeDiagnostics.queue.pending'), width: 100, align: 'right' as const },
  { key: 'rates', title: t('runtimeDiagnostics.bufferDetailRates'), width: 160, align: 'right' as const },
  { key: 'written', title: t('runtimeDiagnostics.bufferWritten'), width: 140, align: 'right' as const },
  { key: 'attempted', title: t('runtimeDiagnostics.bufferAttempted'), width: 140, align: 'right' as const },
  { key: 'dead', title: t('runtimeDiagnostics.bufferRetainedFailures'), width: 120, align: 'right' as const },
  { key: 'actions', title: t('runtimeDiagnostics.bufferActions'), width: 160, align: 'right' as const },
])
</script>
<style scoped>
.buffer-details { margin-top:8px; }.buffer-details-heading { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:4px 12px; color:var(--ink-3); font-size:var(--fs-caption,12px); }.buffer-details-heading > :deep(.ant-btn) { padding-inline:0; color:var(--ink-2); }.buffer-details-heading :deep(.anticon) { font-size:var(--fs-caption,12px); }
.buffer-details-table { min-width:0; margin-top:6px; }.buffer-details-table :deep(.ant-table) { font-size:var(--fs-caption,12px); }.buffer-details-table :deep(.ant-btn) { padding-inline:0; max-width:100%; font-size:var(--fs-caption,12px); overflow:hidden; text-overflow:ellipsis; }.buffer-retained { color:var(--buffer-error); }.buffer-reset-identity { overflow-wrap:anywhere; color:var(--ink-3); }
</style>
