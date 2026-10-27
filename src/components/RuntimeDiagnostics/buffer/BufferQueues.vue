<template>
  <div class="buffer-queues" :style="{ '--buffer-accent': token.colorPrimary, '--buffer-error': token.colorError, '--buffer-ok': token.colorSuccess }">
    <header v-if="!compact" class="buffer-heading"><strong>{{ t('runtimeDiagnostics.bufferQueues') }}</strong><a-tooltip :title="t('runtimeDiagnostics.bufferCollectionInfo')" :trigger="['hover', 'focus']"><InfoCircleOutlined tabindex="0" :aria-label="t('runtimeDiagnostics.bufferCollectionInfo')" /></a-tooltip><span class="buffer-count">{{ buffers.length }}</span><a-segmented :value="filter" :options="filters" size="small" @change="value => emit('filter', value as BufferDisplayConfig['filter'])" /></header>
    <div v-if="visible.length" class="buffer-list">
      <div class="buffer-labels"><span>{{ t('runtimeDiagnostics.bufferName') }}</span><span>{{ t('runtimeDiagnostics.queue.pending') }}</span><span>{{ t('runtimeDiagnostics.queue.wip') }}</span><span>{{ t('runtimeDiagnostics.queue.writerPending') }}</span><span>{{ t('runtimeDiagnostics.queue.dead') }}</span></div>
      <div v-for="buffer in visible" :key="buffer.objectName" class="buffer-row">
        <div class="buffer-name"><a-button v-if="inspectable" type="link" size="small" :title="buffer.name" @click="emit('inspect', buffer.objectName)">{{ buffer.name }}</a-button><span v-else>{{ buffer.name }}</span><a-tooltip :title="buffer.error === undefined ? t('runtimeDiagnostics.unknown') : buffer.error || t('runtimeDiagnostics.noError')"><QuestionCircleOutlined v-if="buffer.error === undefined" /><WarningOutlined v-else-if="buffer.error" class="buffer-error" /><CheckCircleOutlined v-else class="buffer-ok" /></a-tooltip></div>
        <a-tooltip :title="t('runtimeDiagnostics.relativeBacklog')"><div class="buffer-pending"><div class="buffer-track"><i v-if="buffer.pending !== undefined" :style="{ width: `${buffer.pending / maximum * 100}%` }" /></div><strong>{{ buffer.pending ?? '—' }}</strong><small>{{ t('runtimeDiagnostics.items') }}</small></div></a-tooltip>
        <span class="buffer-quantity"><small class="mobile-label">{{ t('runtimeDiagnostics.queue.wip') }}</small>{{ buffer.wip ?? '—' }} <small>{{ t('runtimeDiagnostics.batches') }}</small></span>
        <span class="buffer-quantity"><small class="mobile-label">{{ t('runtimeDiagnostics.queue.writerPending') }}</small>{{ buffer.writerPending ?? '—' }} <small>{{ t('runtimeDiagnostics.requests') }}</small></span>
        <span class="buffer-failed"><small class="mobile-label">{{ t('runtimeDiagnostics.queue.dead') }}</small><a-tag v-if="buffer.dead !== undefined" :color="buffer.dead > 0 ? 'error' : undefined">{{ buffer.dead }} {{ t('runtimeDiagnostics.items') }}</a-tag><span v-else>—</span></span>
      </div>
    </div>
    <a-empty v-else :description="t('runtimeDiagnostics.noMatches')" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
  </div>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { Empty, theme } from 'ant-design-vue'
import { CheckCircleOutlined, InfoCircleOutlined, QuestionCircleOutlined, WarningOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import type { BufferDisplayConfig } from '../types'
import { runtimeBeanOverview } from '../utils'
type BufferView = ReturnType<typeof runtimeBeanOverview>['buffers'][number]
const props = defineProps({ buffers: { type: Array as PropType<BufferView[]>, default: () => [] }, filter: { type: String as PropType<BufferDisplayConfig['filter']>, default: 'all' }, compact: { type: Boolean, default: false }, inspectable: { type: Boolean, default: true } })
const emit = defineEmits<{ (event: 'inspect', objectName: string): void; (event: 'filter', value: BufferDisplayConfig['filter']): void }>()
const { t } = useI18n()
const { token } = theme.useToken()
const failed = (buffer: BufferView) => (buffer.dead ?? 0) > 0 || !!buffer.error
const visible = computed(() => props.buffers.filter(buffer => props.filter === 'all' || (props.filter === 'failed' ? failed(buffer) : (buffer.pending ?? 0) > 0)))
const maximum = computed(() => Math.max(1, ...props.buffers.map(buffer => buffer.pending ?? 0)))
const filters = computed(() => [
  { value: 'all', label: t('runtimeDiagnostics.all') },
  { value: 'failed', label: `${t('runtimeDiagnostics.hasFailures')} ${props.buffers.filter(failed).length}` },
  { value: 'pending', label: `${t('runtimeDiagnostics.hasPending')} ${props.buffers.filter(buffer => (buffer.pending ?? 0) > 0).length}` },
])
</script>
<style scoped>
.buffer-heading { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-block:12px 8px; }
.buffer-heading > strong { font-size:var(--fs-body,14px); font-weight:600; }.buffer-heading .buffer-count { color:var(--ink-1); font-size:var(--fs-16,16px); font-weight:600; font-variant-numeric:tabular-nums; }.buffer-heading :deep(.anticon),.buffer-name :deep(.anticon) { font-size:14px; }
.buffer-heading > span,.buffer-labels,small { color:var(--ink-3); font-size:12px; }
.buffer-heading :deep(.ant-segmented) { margin-inline-start:auto; }
.buffer-row,.buffer-labels { display:grid; grid-template-columns:minmax(160px,1.4fr) minmax(120px,1fr) repeat(3,minmax(72px,.55fr)); gap:12px; align-items:center; }
.buffer-labels { padding-block:4px; }
.buffer-row { padding-block:9px; border-top:1px solid var(--line); }
.buffer-name { display:flex; align-items:center; min-width:0; gap:4px; }
.buffer-name :deep(.ant-btn) { overflow:hidden; text-overflow:ellipsis; max-width:calc(100% - 20px); padding-inline:0; }
.buffer-pending { display:flex; align-items:center; gap:6px; font-variant-numeric:tabular-nums; }
.buffer-track { flex:1; height:6px; border-radius:3px; overflow:hidden; background:var(--bg-sunken); }
.buffer-track i { display:block; height:100%; min-width:0; background:var(--buffer-accent); border-radius:3px; }
.buffer-error { color:var(--buffer-error); }.buffer-ok { color:var(--buffer-ok); }
.buffer-quantity,.buffer-failed { text-align:end; white-space:nowrap; }
.mobile-label { display:none; }
@media(max-width:900px) { .buffer-labels { display:none; }.buffer-row { grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }.buffer-name { grid-column:1 / -1; }.buffer-pending { grid-column:1 / -1; }.mobile-label { display:block; }.buffer-quantity,.buffer-failed { text-align:start; } }
</style>
