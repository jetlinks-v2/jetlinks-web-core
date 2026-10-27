<template>
  <section class="thread-viewer" :class="{ 'thread-viewer--embedded': embedded }">
    <div v-if="threads.length || $slots.actions" class="thread-toolbar diagnostics-compact-toolbar">
      <a-input-search v-if="threads.length" v-model:value="search" size="small" :placeholder="t('runtimeDiagnostics.threadSearch')" allow-clear />
      <slot name="actions"><a-button type="primary" :disabled="!sampleAccess.allowed || state.status === 'loading'" :title="sampleAccess.reason" @click="sample">{{ t('runtimeDiagnostics.sample') }}</a-button></slot>
      <small v-if="state.sampledAt">{{ t('runtimeDiagnostics.snapshotAt') }} {{ new Date(state.sampledAt).toLocaleTimeString() }}</small>
    </div>
    <div v-if="threads.length && state.status !== 'forbidden'" class="thread-states">
      <a-checkable-tag :checked="filter === 'all'" @change="filter = 'all'">{{ t('runtimeDiagnostics.all') }} {{ threads.length }}</a-checkable-tag>
      <a-checkable-tag v-for="item in counts" :key="item.state" :checked="filter === item.state" @change="filter = item.state">{{ item.state }} {{ item.count }}</a-checkable-tag>
      <a-tooltip :title="t('runtimeDiagnostics.blockedHint')"><a-tag v-if="counts.some(item => item.state === 'BLOCKED')" color="warning">{{ t('runtimeDiagnostics.blockedSnapshot') }}</a-tag></a-tooltip>
    </div>
    <DiagnosticsState :state="state" @retry="sample">
      <div v-if="!threads.length" class="thread-empty"><slot name="empty"><a-button v-if="canSample && !$slots.actions" type="primary" size="large" @click="sample">{{ t('runtimeDiagnostics.sample') }}</a-button><p>{{ t('runtimeDiagnostics.noThreadSnapshot') }}</p></slot></div>
      <a-empty v-else-if="!filtered.length" :description="t('runtimeDiagnostics.noMatchingThreads')" />
      <a-table v-else class="thread-table" :columns="columns" :data-source="filtered" row-key="id" size="small" :pagination="embedded ? false : { pageSize: 15, showSizeChanger: false }" :scroll="{ x: 480, y: embedded ? '100%' : undefined }" :expand-row-by-click="true">
        <template #bodyCell="{ column, record }">
          <span v-if="column.key === 'name'" class="thread-name" :title="record.name">{{ record.name }} <small>#{{ record.id }}</small></span>
          <a-tag v-else-if="column.key === 'state'" :color="record.state === 'BLOCKED' ? 'warning' : record.state === 'RUNNABLE' ? 'processing' : undefined">{{ record.state }}</a-tag>
          <span v-else-if="column.key === 'lock'" class="thread-lock" :title="record.lock">{{ record.lockOwner?.name || record.lock || '—' }}</span>
        </template>
        <template #expandedRowRender="{ record }">
          <a-descriptions v-if="record.lock || record.lockOwner || record.blockedCount !== undefined || record.waitedCount !== undefined" :column="{ xs: 1, sm: 2 }" size="small" class="thread-evidence">
            <a-descriptions-item v-if="record.lock" :label="t('runtimeDiagnostics.waitingLock')">{{ record.lock }}</a-descriptions-item>
            <a-descriptions-item v-if="record.lockOwner" :label="t('runtimeDiagnostics.lockOwner')">{{ record.lockOwner.name || '—' }} <small v-if="record.lockOwner.id">#{{ record.lockOwner.id }}</small></a-descriptions-item>
            <a-descriptions-item v-if="record.blockedCount !== undefined" :label="t('runtimeDiagnostics.blockedCount')">{{ record.blockedCount }}<template v-if="record.blockedTime !== undefined && record.blockedTime >= 0"> · {{ record.blockedTime }} ms</template></a-descriptions-item>
            <a-descriptions-item v-if="record.waitedCount !== undefined" :label="t('runtimeDiagnostics.waitedCount')">{{ record.waitedCount }}<template v-if="record.waitedTime !== undefined && record.waitedTime >= 0"> · {{ record.waitedTime }} ms</template></a-descriptions-item>
          </a-descriptions>
          <CodeBlock :content="record.stack || t('runtimeDiagnostics.noStack')" variant="light" copyable :copy-title="t('runtimeDiagnostics.copyStack')" :wrap="false" />
        </template>
      </a-table>
    </DiagnosticsState>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeBlock from '../CodeBlock/index.vue'
import DiagnosticsState from './DiagnosticsState.vue'
import type { ThreadSnapshot, ViewState, ActionAccess } from './types'
import { threadStackDepth } from './utils'
type ThreadRow = ThreadSnapshot & { stackDepth: number }
const props = withDefaults(defineProps<{ threads?: ThreadSnapshot[]; state?: ViewState; sampleAccess?: ActionAccess; embedded?: boolean }>(), {
  threads: () => [], state: () => ({ status: 'ready' }), sampleAccess: () => ({ allowed: false }),
})
const emit = defineEmits<{ (event: 'sample'): void }>()
const { t } = useI18n()
const search = ref(''), filter = ref('all')
const counts = computed(() => {
  const groups = new Map<string, number>(); props.threads.forEach(item => groups.set(item.state, (groups.get(item.state) ?? 0) + 1))
  return [...groups].map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count)
})
const rows = computed<ThreadRow[]>(() => props.threads.map(thread => ({ ...thread, stackDepth: threadStackDepth(thread.stack) })))
const filtered = computed(() => rows.value.filter(thread => `${thread.name} ${thread.id} ${thread.lock ?? ''} ${thread.lockOwner?.name ?? ''}`.toLowerCase().includes(search.value.toLowerCase()) && (filter.value === 'all' || thread.state === filter.value)))
const canSample = computed(() => props.sampleAccess.allowed && !['loading', 'error', 'forbidden', 'unsupported'].includes(props.state.status))
const columns = computed(() => [
  { key: 'name', title: t('runtimeDiagnostics.thread'), ellipsis: true, sorter: (a: ThreadSnapshot, b: ThreadSnapshot) => a.name.localeCompare(b.name) },
  { key: 'stackDepth', dataIndex: 'stackDepth', title: t('runtimeDiagnostics.stackDepth'), width: 96, align: 'right' as const, defaultSortOrder: 'descend' as const, sorter: (a: ThreadRow, b: ThreadRow) => a.stackDepth - b.stackDepth },
  { key: 'state', title: t('runtimeDiagnostics.state'), width: 160 },
  { key: 'lock', title: t('runtimeDiagnostics.lockOrOwner'), ellipsis: true, width: 200 },
])
watch(counts, value => { if (filter.value !== 'all' && !value.some(item => item.state === filter.value)) filter.value = 'all' })
function sample() { if (props.sampleAccess.allowed && props.state.status !== 'loading') emit('sample') }
</script>
<style scoped>
.thread-viewer { display:flex; flex:1 1 0; flex-direction:column; min-width:0; min-height:0; }.thread-viewer :deep(> .ant-spin-nested-loading),.thread-viewer :deep(> .ant-spin-nested-loading > .ant-spin-container) { display:flex; flex:1 1 0; flex-direction:column; min-height:0; }
.thread-viewer--embedded :deep(.thread-table),.thread-viewer--embedded :deep(.thread-table > .ant-spin-nested-loading),.thread-viewer--embedded :deep(.thread-table > .ant-spin-nested-loading > .ant-spin-container),.thread-viewer--embedded :deep(.thread-table .ant-table),.thread-viewer--embedded :deep(.thread-table .ant-table-container) { display:flex; flex:1 1 0; flex-direction:column; min-width:0; min-height:0; }
.thread-viewer--embedded :deep(.thread-table .ant-table-header) { flex:0 0 auto; }
.thread-viewer--embedded :deep(.thread-table .ant-table-body) { flex:1 1 0; min-height:0; overscroll-behavior:contain; }
.thread-toolbar,.thread-states { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-2,8px); margin-bottom:var(--space-2,8px); }
.thread-toolbar .ant-input-search { width:min(100%,300px); }
.thread-toolbar small,.thread-name small { color:var(--ink-3); }
.thread-toolbar small { margin-inline-start:auto; }
.thread-name,.thread-lock { display:block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.thread-evidence { overflow-wrap:anywhere; }
.thread-empty { flex:1 1 0; min-height:220px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; text-align:center; }.thread-empty :deep(.ant-btn-lg) { min-width:160px; }.thread-empty p { margin:0; color:var(--ink-3); font-size:12px; }
</style>
