<template>
  <section class="device-observation">
    <div class="device-observation-toolbar diagnostics-compact-toolbar">
      <form class="device-observation-add" @submit.prevent="addInput">
        <a-auto-complete v-model:value="input" class="device-observation-input" :options="deviceOptions" :filter-option="false" :default-active-first-option="false" :placeholder="t('runtimeDiagnostics.deviceSessions.addPlaceholder')" :aria-label="t('runtimeDiagnostics.deviceSessions.addPlaceholder')" :disabled="!allowed || entries.length >= 5" allow-clear @search="value => emit('search-device', value)" @select="selectDevice" @keydown="searchKeydown">
          <template #option="{ label, value, description }"><span class="device-observation-option"><strong>{{ label }}</strong><small>{{ value }}<span v-if="description"> · {{ description }}</span></small></span></template>
        </a-auto-complete>
        <a-tooltip :title="t('runtimeDiagnostics.deviceSessions.add')"><a-button type="text" html-type="submit" :aria-label="t('runtimeDiagnostics.deviceSessions.add')" :disabled="!allowed || !input.trim() || entries.length >= 5"><LoadingOutlined v-if="deviceSearching" /><PlusOutlined v-else /></a-button></a-tooltip>
      </form>
      <div class="device-observation-controls">
        <a-tooltip :title="t(paused ? 'runtimeDiagnostics.deviceSessions.resume' : 'runtimeDiagnostics.deviceSessions.pause')"><a-button size="small" type="text" :disabled="!allowed || !entries.length" :aria-label="t(paused ? 'runtimeDiagnostics.deviceSessions.resume' : 'runtimeDiagnostics.deviceSessions.pause')" @click="emit('update:paused', !paused)"><CaretRightOutlined v-if="paused" /><PauseOutlined v-else />{{ t(paused ? 'runtimeDiagnostics.deviceSessions.paused' : 'runtimeDiagnostics.deviceSessions.observing') }}</a-button></a-tooltip>
        <a-dropdown :trigger="['click']" :disabled="!allowed"><a-button type="text" size="small" :aria-label="t('runtimeDiagnostics.deviceSessions.frequency')">{{ interval }}s<DownOutlined /></a-button><template #overlay><a-menu @click="value => emit('update:interval', Number(value.key))"><a-menu-item v-for="seconds in [5,10,30,60]" :key="seconds">{{ t('runtimeDiagnostics.deviceSessions.everySeconds', { seconds }) }}</a-menu-item></a-menu></template></a-dropdown>
        <a-tooltip :title="t('runtimeDiagnostics.deviceSessions.refresh')"><a-button size="small" type="text" :disabled="!allowed || !entries.length" :aria-label="t('runtimeDiagnostics.deviceSessions.refresh')" @click="emit('refresh')"><ReloadOutlined /></a-button></a-tooltip>
      </div>
    </div>
    <div v-if="entries.length" class="device-observation-chips"><a-tag v-for="(entry, index) in entries" :key="entry.id" :color="entry.color ?? colors[index % colors.length]" :closable="allowed" @close.prevent="remove(entry.id)"><span :title="entry.id">{{ entry.label }}</span></a-tag><small>{{ t('runtimeDiagnostics.deviceSessions.deviceLimit', { count: entries.length }) }}</small></div>
    <a-alert v-if="!access.allowed" type="warning" show-icon :message="t('runtimeDiagnostics.deviceSessions.forbidden')" />
    <a-empty v-else-if="unsupported" :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="t('runtimeDiagnostics.deviceSessions.unsupported')" />
    <template v-else-if="entries.length">
      <div class="device-observation-trend-heading"><a-segmented size="small" :value="metric" :options="metricOptions" @change="value => emit('update:metric', value as DeviceObservationMetric)" /><a-tooltip :title="t('runtimeDiagnostics.deviceSessions.trendInfo')"><InfoCircleOutlined tabindex="0" :aria-label="t('runtimeDiagnostics.deviceSessions.trendInfo')" /></a-tooltip></div>
      <DeviceObservationChart :entries="entries" :metric="metric" :paused="paused" />
      <div class="device-observation-results">
        <article v-for="(entry, index) in entries" :key="entry.id" class="device-observation-row" :class="{ 'is-expanded': expanded[entry.id] }">
          <div class="device-observation-summary">
            <a-button type="text" class="device-observation-device" :aria-expanded="!!expanded[entry.id]" @click="toggle(entry.id)"><DownOutlined :rotate="expanded[entry.id] ? 180 : 0" /><i :style="{ background: entry.color ?? colors[index % colors.length] }" /><strong :title="entry.id">{{ entry.label }}</strong></a-button>
            <span class="device-observation-nodes" :title="nodes(entry)">{{ nodes(entry) }}</span>
            <span v-if="activity(entry).time" class="device-observation-activity">{{ t(`runtimeDiagnostics.deviceSessions.${activity(entry).heartbeat ? 'lastHeartbeat' : 'lastCommTime'}`) }} <time :title="activity(entry).time">{{ activity(entry).time }}</time></span>
            <span v-if="currentPoint(entry)?.[metric] !== undefined" class="device-observation-value" :title="entry.state.sampledAt ? t('runtimeDiagnostics.deviceSessions.snapshotAt', { time: timestamp(entry.state.sampledAt) }) : undefined">{{ formatDeviceObservationValue(currentPoint(entry)![metric]!, metric, locale, unit) }}</span>
            <span v-else-if="entry.state.sampledAt && entry.sessions.length" class="device-observation-coverage">{{ t('runtimeDiagnostics.deviceSessions.metricsUnavailable') }}</span>
            <a-tag v-if="metric !== 'pending' && (currentPoint(entry)?.pending ?? 0) > 0" color="warning">{{ t('runtimeDiagnostics.deviceSessions.pendingCount', { count: currentPoint(entry)!.pending!.toLocaleString(locale) }) }}</a-tag>
            <LoadingOutlined v-if="entry.collecting" :aria-label="t('runtimeDiagnostics.deviceSessions.observing')" />
            <span v-if="status(entry)" class="device-observation-status" :class="{ 'is-warning': ['error','stale','forbidden'].includes(entry.state.status) }" :title="entry.state.message">{{ status(entry) }}</span>
            <a-tooltip v-if="entry.state.status === 'error' || entry.state.status === 'stale'" :title="t('runtimeDiagnostics.retry')"><a-button type="text" size="small" :disabled="!allowed" :aria-label="t('runtimeDiagnostics.retry')" @click="emit('refresh', entry.id)"><ReloadOutlined /></a-button></a-tooltip>
          </div>
          <div v-if="expanded[entry.id]" class="device-observation-details"><div class="device-observation-detail-meta"><a-typography-text :copyable="{ text: entry.id }">{{ entry.id }}</a-typography-text><small v-if="entry.state.sampledAt">{{ t('runtimeDiagnostics.deviceSessions.snapshotAt', { time: timestamp(entry.state.sampledAt) }) }}</small></div><DeviceSessionViewer node-id="" details-only :sessions="entry.sessions" :result-device-id="entry.id" :queried-device-id="entry.id" :state="entry.state" :access="access" :active="active" /></div>
        </article>
      </div>
    </template>
    <a-empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="t(waiting ? 'runtimeDiagnostics.deviceSessions.waitingCapability' : 'runtimeDiagnostics.deviceSessions.observationInitial')" />
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Empty } from 'ant-design-vue'
import { CaretRightOutlined, DownOutlined, InfoCircleOutlined, LoadingOutlined, PauseOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import DeviceSessionViewer from './DeviceSessionViewer.vue'
import DeviceObservationChart from './device-sessions/DeviceObservationChart.vue'
import { deviceObservationActivity, deviceObservationColors as colors, deviceObservationCurrentPoint, formatDeviceObservationValue, type DeviceObservationEntry, type DeviceObservationMetric } from './device-sessions/observation'
import { formatDeviceSessionTimestamp } from './deviceSessionPresentation'
import type { ActionAccess, DeviceSessionDeviceOption } from './types'
const props = defineProps<{ entries: DeviceObservationEntry[]; deviceOptions: DeviceSessionDeviceOption[]; deviceSearching: boolean; active: boolean; access: ActionAccess; unsupported?: boolean; waiting?: boolean; paused: boolean; interval: number; metric: DeviceObservationMetric }>()
const emit = defineEmits<{ (event: 'add', id: string, label?: string): void; (event: 'remove' | 'search-device', value: string): void; (event: 'refresh', id?: string): void; (event: 'update:paused', value: boolean): void; (event: 'update:interval', value: number): void; (event: 'update:metric', value: DeviceObservationMetric): void }>()
const { t, locale } = useI18n(), input = ref(''), expanded = ref<Record<string, boolean>>({})
const allowed = computed(() => props.active && props.access.allowed && !props.unsupported && !props.waiting)
const metricOptions = computed(() => (['receive', 'send', 'messages', 'pending'] as const).map(value => ({ value, label: t(`runtimeDiagnostics.deviceSessions.metric.${value}`) })))
const unit = computed(() => props.metric === 'receive' || props.metric === 'send' ? 'B/s' : t(`runtimeDiagnostics.deviceSessions.${props.metric === 'messages' ? 'messagesUnit' : 'pendingUnit'}`))
const currentPoints = computed(() => new Map(props.entries.map(entry => [entry.id, deviceObservationCurrentPoint(entry.history)])))
let selectionHandled = false
function addInput() { if (allowed.value && input.value.trim() && props.entries.length < 5) { emit('add', input.value.trim()); input.value = '' } }
function selectDevice(value: unknown) { if (!allowed.value || typeof value !== 'string' || props.entries.length >= 5) return; selectionHandled = true; emit('add', value, props.deviceOptions.find(option => option.value === value)?.label); input.value = ''; void nextTick(() => { selectionHandled = false }) }
function searchKeydown(event: KeyboardEvent) { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); if (!selectionHandled) addInput() } }
function remove(id: string) { if (allowed.value) { delete expanded.value[id]; emit('remove', id) } }
function toggle(id: string) { expanded.value = { ...expanded.value, [id]: !expanded.value[id] } }
function nodes(entry: DeviceObservationEntry) { return [...new Set(entry.sessions.map(session => session.serverId).filter(Boolean))].join(', ') }
function timestamp(value: number) { return formatDeviceSessionTimestamp(value, locale.value) }
function activity(entry: DeviceObservationEntry) { const value = deviceObservationActivity(entry.sessions); return { time: timestamp(value.lastCommAt ?? value.lastHeartbeatAt ?? 0), heartbeat: value.lastCommAt === undefined } }
function currentPoint(entry: DeviceObservationEntry) { return currentPoints.value.get(entry.id) }
function status(entry: DeviceObservationEntry) { const keys: Partial<Record<DeviceObservationEntry['state']['status'], string>> = { empty: 'noSessions', loading: 'collecting', stale: 'stale', error: 'failed', forbidden: 'forbidden', unsupported: 'unsupported' }; return keys[entry.state.status] ? t(`runtimeDiagnostics.deviceSessions.${keys[entry.state.status]}`) : '' }
watch(() => props.entries.map(entry => entry.id).join('|'), () => { expanded.value = Object.fromEntries(Object.entries(expanded.value).filter(([id]) => props.entries.some(entry => entry.id === id))) })
</script>
<style scoped>
.device-observation { min-width:0; }.device-observation-toolbar { display:flex; gap:12px; justify-content:space-between; align-items:center; margin:4px 0 10px; }.device-observation-add { display:flex; align-items:center; flex:0 1 400px; min-width:180px; }.device-observation-input { width:100%; min-width:0; }.device-observation-controls { display:flex; gap:2px; align-items:center; flex:none; }.device-observation-option strong,.device-observation-option small { display:block; overflow-wrap:anywhere; }.device-observation-option small { color:var(--ink-2); }.device-observation-chips { display:flex; align-items:center; flex-wrap:wrap; gap:4px; margin-bottom:16px; }.device-observation-chips :deep(.ant-tag) { display:inline-flex; align-items:center; gap:4px; max-width:100%; margin:0; }.device-observation-chips :deep(.ant-tag)>span:first-child { max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.device-observation-chips small { font-size:var(--fs-caption,12px); color:var(--ink-2); margin-left:4px; }.device-observation-trend-heading { display:flex; gap:8px; align-items:center; color:var(--ink-2); font-size:var(--fs-body,14px); font-weight:600; }.device-observation-results { border-top:1px solid var(--line); margin-top:8px; }.device-observation-row { border-bottom:1px solid var(--line); }.device-observation-summary { display:flex; align-items:center; flex-wrap:wrap; gap:6px 12px; min-height:52px; padding:8px 0; font-size:var(--fs-sm,13px); }.device-observation-device { display:inline-flex; align-items:center; gap:7px; padding:0 2px; height:auto; max-width:100%; }.device-observation-device strong { font-size:var(--fs-body,14px); max-width:220px; overflow:hidden; text-overflow:ellipsis; font-weight:600; }.device-observation-device i { width:7px; height:7px; border-radius:50%; flex:none; }.device-observation-nodes { color:var(--ink-2); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.device-observation-activity { color:var(--ink-2); }.device-observation-activity time { color:var(--ink-1); font-variant-numeric:tabular-nums; }.device-observation-value { margin-left:auto; font-weight:500; font-variant-numeric:tabular-nums; }.device-observation-value small { font-weight:400; color:var(--ink-2); }.device-observation-status { color:var(--ink-2); font-size:var(--fs-caption,12px); }.device-observation-status.is-warning { color:var(--ant-color-warning,#d48806); }.device-observation-details { padding:0 0 12px 22px; }.device-observation-detail-meta { display:flex; flex-wrap:wrap; gap:8px 16px; color:var(--ink-2); font-size:var(--fs-caption,12px); }.device-observation-detail-meta small { font-size:var(--fs-caption,12px); }.is-expanded { background:var(--bg-sunken,#fafbfc); }.is-expanded .device-observation-summary { padding-inline:8px; }
@media(max-width:600px) { .device-observation-toolbar { flex-wrap:wrap; gap:6px; }.device-observation-add { flex:1 1 100%; }.device-observation-controls { margin-left:auto; }.device-observation-details { padding-left:8px; }.device-observation-summary { gap:6px 8px; }.device-observation-activity { flex-basis:100%; padding-left:22px; } }
</style>
