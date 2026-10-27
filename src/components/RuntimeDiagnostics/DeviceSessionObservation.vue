<template>
  <section class="device-observation">
    <div class="device-observation-toolbar diagnostics-compact-toolbar">
      <form class="device-observation-add" @submit.prevent="addInput">
        <a-auto-complete v-model:value="input" class="device-observation-input" :options="deviceOptions" :filter-option="false" :default-active-first-option="false" :placeholder="t('runtimeDiagnostics.deviceSessions.addPlaceholder')" :aria-label="t('runtimeDiagnostics.deviceSessions.addPlaceholder')" :disabled="!allowed || entries.length >= 5" allow-clear @search="value => emit('search-device', value)" @popup-scroll="loadMoreDevices" @select="selectDevice" @keydown="searchKeydown">
          <template #option="{ label, value, description }"><span class="device-observation-option"><strong>{{ label }}</strong><small>{{ value }}<span v-if="description"> · {{ description }}</span></small></span></template>
        </a-auto-complete>
        <a-tooltip :title="t('runtimeDiagnostics.deviceSessions.add')"><a-button type="text" html-type="submit" :aria-label="t('runtimeDiagnostics.deviceSessions.add')" :disabled="!allowed || !input.trim() || entries.length >= 5"><LoadingOutlined v-if="deviceSearching" /><PlusOutlined v-else /></a-button></a-tooltip>
      </form>
      <div class="device-observation-controls">
        <a-tooltip :title="t(paused ? 'runtimeDiagnostics.deviceSessions.resume' : 'runtimeDiagnostics.deviceSessions.pause')"><a-button size="small" type="text" :disabled="!allowed || !entries.length" :aria-label="t(paused ? 'runtimeDiagnostics.deviceSessions.resume' : 'runtimeDiagnostics.deviceSessions.pause')" @click="emit('update:paused', !paused)"><CaretRightOutlined v-if="paused" /><PauseOutlined v-else />{{ t(paused ? 'runtimeDiagnostics.deviceSessions.paused' : 'runtimeDiagnostics.deviceSessions.observing') }}</a-button></a-tooltip>
        <SamplingIntervalControl :value="interval" :disabled="!allowed" @change="value => emit('update:interval', value)" />
        <a-tooltip :title="t('runtimeDiagnostics.deviceSessions.refresh')"><a-button size="small" type="text" :disabled="!allowed || !entries.length" :aria-label="t('runtimeDiagnostics.deviceSessions.refresh')" @click="emit('refresh')"><ReloadOutlined /></a-button></a-tooltip>
      </div>
    </div>
    <div v-if="entries.length" class="device-observation-chips"><a-tag v-for="(entry, index) in entries" :key="entry.id" :color="entry.color ?? colors[index % colors.length]" :closable="allowed" @close.prevent="remove(entry.id)"><span :title="entry.id">{{ entry.label }}</span></a-tag><small>{{ t('runtimeDiagnostics.deviceSessions.deviceLimit', { count: entries.length }) }}</small></div>
    <a-alert v-if="!access.allowed" type="warning" show-icon :message="t('runtimeDiagnostics.deviceSessions.forbidden')" />
    <a-empty v-else-if="unsupported" :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="t('runtimeDiagnostics.deviceSessions.unsupported')" />
    <template v-else-if="entries.length">
      <div class="device-observation-trend-heading"><span>{{ t('runtimeDiagnostics.deviceSessions.linkedMetrics') }}</span><a-tooltip :title="t('runtimeDiagnostics.deviceSessions.trendInfo')"><InfoCircleOutlined tabindex="0" :aria-label="t('runtimeDiagnostics.deviceSessions.trendInfo')" /></a-tooltip></div>
      <div class="device-observation-results">
        <article v-for="(entry, index) in entries" :key="entry.id" class="device-observation-card">
          <div class="device-observation-card-main">
            <header class="device-observation-summary">
            <div class="device-observation-device"><i :style="{ background: entry.color ?? colors[index % colors.length] }" /><strong :title="entry.label">{{ entry.label }}</strong><small :title="entry.id">{{ entry.id }}</small></div>
            <div class="device-observation-state">
            <LoadingOutlined v-if="entry.collecting" :aria-label="t('runtimeDiagnostics.deviceSessions.observing')" />
            <span v-if="status(entry)" class="device-observation-status" :class="{ 'is-warning': ['error','stale','forbidden'].includes(entry.state.status) }" :title="entry.state.message">{{ status(entry) }}</span>
            <a-tooltip v-if="entry.state.status === 'error' || entry.state.status === 'stale'" :title="t('runtimeDiagnostics.retry')"><a-button type="text" size="small" :disabled="!allowed" :aria-label="t('runtimeDiagnostics.retry')" @click="emit('refresh', entry.id)"><ReloadOutlined /></a-button></a-tooltip>
            </div>
            </header>
            <a-popover :open="!!expanded[entry.id]" trigger="click" placement="bottomRight" @open-change="value => openDetails(entry.id, value)">
              <template #content><div class="device-observation-details" @keydown.esc.stop="openDetails(entry.id, false)"><DeviceSessionViewer node-id="" details-only expand-connections :sessions="entry.sessions" :result-device-id="entry.id" :queried-device-id="entry.id" :state="entry.state" :access="access" :active="active && !!expanded[entry.id]" /></div></template>
              <a-button type="text" size="small" class="device-observation-connection" :aria-label="t('runtimeDiagnostics.deviceSessions.connectionDetails')" :aria-expanded="!!expanded[entry.id]" @keydown.esc.stop="openDetails(entry.id, false)"><span class="device-observation-nodes" :title="connection(entry)?.serverId">{{ connection(entry)?.serverId || '—' }}</span><span class="device-observation-address" :title="[connection(entry)?.transport, connection(entry)?.address].filter(Boolean).join(' ')"><span v-if="connection(entry)?.transport">{{ connection(entry)?.transport }} </span>{{ connection(entry)?.address || '—' }}</span><span class="device-observation-connection-time" :title="timestamp(connection(entry)?.connectedAt ?? 0)"><ClockCircleOutlined :aria-label="t('runtimeDiagnostics.deviceSessions.connectedFor')" /><time>{{ connectionDuration(entry) || '—' }}</time></span><span class="device-observation-detail-link" :title="t('runtimeDiagnostics.deviceSessions.connections', { count: connectionCount(entry) })"><LinkOutlined /><span v-if="connectionCount(entry)">{{ connectionCount(entry) }}</span><DownOutlined v-if="connectionCount(entry) > 1" :rotate="expanded[entry.id] ? 180 : 0" /></span></a-button>
            </a-popover>
            <dl class="device-observation-metrics" :title="entry.state.sampledAt ? t('runtimeDiagnostics.deviceSessions.snapshotAt', { time: timestamp(entry.state.sampledAt) }) : undefined">
              <div v-for="item in metricOptions" :key="item.value" :class="{ 'is-muted': !metrics.includes(item.value), 'is-warning': item.value === 'pending' && (currentPoint(entry)?.pending ?? 0) > 0 }"><dt><i :style="{ background: metricColors[item.value] }" />{{ item.label }}</dt><dd>{{ metricValue(entry, item.value) }}</dd></div>
            </dl>
            <DeviceObservationChart :entry="entry" :metrics="metrics" :range="range" :paused="paused" @update:metrics="value => emit('update:metrics', value)" @ready="instance => register(entry.id, instance)" @dispose="instance => unregister(entry.id, instance)" />
          </div>
        </article>
      </div>
    </template>
    <a-empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="t(waiting ? 'runtimeDiagnostics.deviceSessions.waitingCapability' : 'runtimeDiagnostics.deviceSessions.observationInitial')" />
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useIntervalFn } from '@vueuse/core'
import { Empty } from 'ant-design-vue'
import { CaretRightOutlined, ClockCircleOutlined, DownOutlined, InfoCircleOutlined, LinkOutlined, LoadingOutlined, PauseOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import DeviceSessionViewer from './DeviceSessionViewer.vue'
import SamplingIntervalControl from './SamplingIntervalControl.vue'
import DeviceObservationChart from './device-sessions/DeviceObservationChart.vue'
import { deviceObservationConnection, deviceObservationColors as colors, deviceObservationMetrics, deviceObservationMetricColors as metricColors, deviceObservationCurrentPoint, formatDeviceObservationValue, type DeviceObservationEntry, type DeviceObservationMetric } from './device-sessions/observation'
import { useDeviceObservationCharts } from './device-sessions/useDeviceObservationCharts'
import { formatDeviceSessionDuration, formatDeviceSessionTimestamp } from './deviceSessionPresentation'
import type { ActionAccess, DeviceSessionDeviceOption } from './types'
const props = defineProps<{ entries: DeviceObservationEntry[]; deviceOptions: DeviceSessionDeviceOption[]; deviceSearching: boolean; active: boolean; access: ActionAccess; unsupported?: boolean; waiting?: boolean; paused: boolean; interval: number; metrics: DeviceObservationMetric[] }>()
const emit = defineEmits<{ (event: 'add', id: string, label?: string): void; (event: 'remove' | 'search-device', value: string): void; (event: 'refresh', id?: string): void; (event: 'load-more-devices'): void; (event: 'update:paused', value: boolean): void; (event: 'update:interval', value: number): void; (event: 'update:metrics', value: DeviceObservationMetric[]): void }>()
const { t, locale } = useI18n(), now = ref(Date.now()), input = ref(''), expanded = ref<Record<string, boolean>>({})
const allowed = computed(() => props.active && props.access.allowed && !props.unsupported && !props.waiting)
const metricOptions = computed(() => deviceObservationMetrics.map(value => ({ value, label: t(`runtimeDiagnostics.deviceSessions.metric.${value}`) })))
const currentPoints = computed(() => new Map(props.entries.map(entry => [entry.id, deviceObservationCurrentPoint(entry.history)])))
const connections = computed(() => new Map(props.entries.map(entry => [entry.id, deviceObservationConnection(entry.sessions)])))
const connectionCounts = computed(() => new Map(props.entries.map(entry => [entry.id, entry.sessions.reduce((count, session) => count + (session.connections?.length ?? 0), 0)])))
// 已连接时长只更新本地时钟；失活、撤权或没有建立时间时暂停，不触发采样。
const clockEnabled = computed(() => allowed.value && [...connections.value.values()].some(value => value?.connectedAt !== undefined))
const clock = useIntervalFn(() => { now.value = Date.now() }, 1000, { immediate: false })
watch(clockEnabled, enabled => { if (enabled) { now.value = Date.now(); clock.resume() } else clock.pause() }, { immediate: true })
const range = computed(() => { const times = props.entries.flatMap(entry => entry.history.map(sample => sample.sampledAt)); return times.length ? { from: Math.min(...times), to: Math.max(...times) + 1000 } : undefined })
const { register, unregister } = useDeviceObservationCharts(toRef(props, 'active'))
let selectionHandled = false
function loadMoreDevices(event: UIEvent) {
  const target = event.target as HTMLElement | null
  if (allowed.value && !props.deviceSearching && props.entries.length < 5 && target && target.scrollTop + target.clientHeight >= target.scrollHeight - 32) emit('load-more-devices')
}
function addInput() { if (allowed.value && input.value.trim() && props.entries.length < 5) { emit('add', input.value.trim()); input.value = '' } }
function selectDevice(value: unknown) { if (!allowed.value || typeof value !== 'string' || props.entries.length >= 5) return; selectionHandled = true; emit('add', value, props.deviceOptions.find(option => option.value === value)?.label); input.value = ''; void nextTick(() => { selectionHandled = false }) }
function searchKeydown(event: KeyboardEvent) { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); if (!selectionHandled) addInput() } }
function remove(id: string) { if (allowed.value) { delete expanded.value[id]; emit('remove', id) } }
function openDetails(id: string, open: boolean) { expanded.value = open ? { [id]: true } : { ...expanded.value, [id]: false } }
function timestamp(value: number) { return formatDeviceSessionTimestamp(value, locale.value) }
function connection(entry: DeviceObservationEntry) { return connections.value.get(entry.id) }
function connectionDuration(entry: DeviceObservationEntry) { return formatDeviceSessionDuration(connection(entry)?.connectedAt, now.value, locale.value) }
function connectionCount(entry: DeviceObservationEntry) { return connectionCounts.value.get(entry.id) ?? 0 }
function currentPoint(entry: DeviceObservationEntry) { return currentPoints.value.get(entry.id) }
function metricValue(entry: DeviceObservationEntry, metric: DeviceObservationMetric) { const value = currentPoint(entry)?.[metric]; return value === undefined ? '—' : formatDeviceObservationValue(value, metric, locale.value, t(`runtimeDiagnostics.deviceSessions.${metric === 'messages' ? 'messagesUnit' : 'pendingUnit'}`)) }
function status(entry: DeviceObservationEntry) { const keys: Partial<Record<DeviceObservationEntry['state']['status'], string>> = { empty: 'noSessions', loading: 'collecting', stale: 'stale', error: 'failed', forbidden: 'forbidden', unsupported: 'unsupported' }; return keys[entry.state.status] ? t(`runtimeDiagnostics.deviceSessions.${keys[entry.state.status]}`) : '' }
watch(() => props.entries.map(entry => entry.id).join('|'), () => { expanded.value = Object.fromEntries(Object.entries(expanded.value).filter(([id]) => props.entries.some(entry => entry.id === id))) })
watch(() => props.active, active => { if (!active) expanded.value = {} })
</script>
<style scoped>
.device-observation { min-width:0; }
.device-observation-toolbar { display:flex; gap:12px; justify-content:space-between; align-items:center; margin:4px 0 10px; }
.device-observation-add { display:flex; align-items:center; flex:0 1 400px; min-width:180px; }
.device-observation-input { width:100%; min-width:0; }
.device-observation-controls { display:flex; gap:2px; align-items:center; flex:none; }
.device-observation-option strong,.device-observation-option small { display:block; overflow-wrap:anywhere; }
.device-observation-option small { color:var(--ink-2); }
.device-observation-chips { display:flex; align-items:center; flex-wrap:wrap; gap:4px; margin-bottom:12px; }
.device-observation-chips :deep(.ant-tag) { display:inline-flex; align-items:center; gap:4px; max-width:100%; margin:0; }
.device-observation-chips :deep(.ant-tag)>span:first-child { max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.device-observation-chips small { font-size:var(--fs-caption,12px); color:var(--ink-2); margin-left:4px; }
.device-observation-trend-heading { display:flex; gap:8px; align-items:center; color:var(--ink-2); font-size:var(--fs-caption,12px); min-width:0; }
.device-observation-trend-heading > .anticon { flex:none; }
/* auto-fill 保留空列，单设备与多设备使用同样的卡片尺寸。 */
.device-observation-results { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,400px),1fr)); gap:12px; align-items:start; margin-top:12px; }
.device-observation-card { container-type:inline-size; min-width:0; border:1px solid var(--ant-color-border-secondary,#f0f0f0); border-radius:4px; background:var(--ant-color-bg-container,#fff); }
.device-observation-card-main { height:320px; display:flex; flex-direction:column; gap:6px; padding:10px; min-width:0; }
.device-observation-summary { display:flex; align-items:center; flex-wrap:wrap; gap:2px 8px; min-width:0; }
.device-observation-device { display:flex; align-items:center; flex:1; gap:6px; height:24px; min-width:0; }
.device-observation-device strong { max-width:65%; font-size:var(--fs-body,14px); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; }
.device-observation-device i { width:7px; height:7px; border-radius:50%; flex:none; }
.device-observation-device small { min-width:0; flex:1; font-size:var(--fs-caption,12px); color:var(--ant-color-text-tertiary,#8c8c8c); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.device-observation-state { display:flex; align-items:center; gap:4px; flex:none; }
.device-observation-connection { display:grid; grid-template-columns:auto minmax(0,1fr) auto auto; align-items:center; gap:6px; width:100%; padding:0; height:auto; text-align:left; color:var(--ink-2); font-size:var(--fs-caption,12px); }
.device-observation-nodes,.device-observation-address { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.device-observation-nodes { max-width:130px; }
.device-observation-address > span { margin-right:4px; }
.device-observation-connection-time { display:inline-flex; align-items:center; gap:4px; font-variant-numeric:tabular-nums; }
.device-observation-detail-link { display:inline-flex; align-items:center; gap:4px; color:var(--ant-color-primary,#1677ff); }
.device-observation-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px 10px; margin:2px 0 0; }
.device-observation-metrics dt { color:var(--ink-2); font-size:var(--fs-caption,12px); }
.device-observation-metrics dt i { display:inline-block; width:6px; height:6px; border-radius:50%; margin-right:5px; vertical-align:middle; }
.device-observation-metrics dd { margin:0; font-size:var(--fs-body,14px); font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.device-observation-metrics .is-muted { opacity:.55; }
.device-observation-metrics .is-warning dd,.device-observation-status.is-warning { color:var(--ant-color-warning,#d48806); }
.device-observation-card-main > .device-observation-chart { flex:1; height:auto; min-height:160px; }
.device-observation-status { color:var(--ink-2); font-size:var(--fs-caption,12px); }
.device-observation-details { width:min(480px,calc(100vw - 56px)); max-height:min(50vh,440px); overflow:auto; overscroll-behavior:contain; min-width:0; }
@media(max-width:600px) { .device-observation-toolbar { flex-wrap:wrap; gap:6px; }.device-observation-add { flex:1 1 100%; }.device-observation-controls { margin-left:auto; } }
@container(max-width:420px) { .device-observation-card-main { height:360px; }.device-observation-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }.device-observation-connection { grid-template-columns:minmax(0,1fr) auto; }.device-observation-address { grid-row:2;grid-column:1; }.device-observation-connection-time { grid-row:1;grid-column:2; } }
</style>
