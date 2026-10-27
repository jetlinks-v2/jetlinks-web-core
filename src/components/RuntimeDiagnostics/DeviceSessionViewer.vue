<template>
  <section class="device-session-viewer">
    <form v-if="!detailsOnly" class="device-session-toolbar diagnostics-compact-toolbar" @submit.prevent="query">
      <a-auto-complete v-if="remoteSearch" v-model:value="input" class="device-session-input" :options="canQuery ? deviceOptions : []" :placeholder="t('runtimeDiagnostics.deviceSessions.remoteSearchPlaceholder')" :aria-label="t('runtimeDiagnostics.deviceSessions.remoteSearchPlaceholder')" :aria-busy="deviceSearching" :disabled="!canInteract" :filter-option="false" :default-active-first-option="false" allow-clear @search="searchDevice" @select="selectDevice" @keydown="searchKeydown">
        <template #option="{ label, value, description }"><span class="device-session-option"><strong>{{ label }}</strong><small><code>{{ value }}</code><span v-if="description">{{ description }}</span></small></span></template>
      </a-auto-complete>
      <a-input v-else v-model:value="input" class="device-session-input" :placeholder="t('runtimeDiagnostics.deviceSessions.searchPlaceholder')" :aria-label="t('runtimeDiagnostics.deviceSessions.deviceId')" :disabled="!canInteract" allow-clear />
      <LoadingOutlined v-if="remoteSearch && deviceSearching" role="status" :aria-label="t('runtimeDiagnostics.deviceSessions.searching')" />
      <div v-if="$slots.filters" class="device-session-filters"><slot name="filters" :disabled="!canInteract" /></div>
      <a-button type="primary" html-type="submit" :disabled="!canQuery || !input.trim()" :loading="state.status === 'loading'" :title="access.reason">{{ t('runtimeDiagnostics.deviceSessions.query') }}</a-button>
      <a-tooltip :title="access.reason || t('runtimeDiagnostics.deviceSessions.refresh')"><a-button type="text" :aria-label="t('runtimeDiagnostics.deviceSessions.refresh')" :disabled="!canQuery || !queriedDeviceId" @click="refresh"><ReloadOutlined /></a-button></a-tooltip>
    </form>
    <div v-if="state.status === 'loading'" class="device-session-query-status" role="status" aria-live="polite"><LoadingOutlined /><span>{{ t('runtimeDiagnostics.deviceSessions.loading', { deviceId: queriedDeviceId }) }}</span><small v-if="rows.length">{{ t('runtimeDiagnostics.deviceSessions.retainedResults') }}</small></div>
    <a-alert v-else-if="state.status === 'error'" type="warning" show-icon :message="t('runtimeDiagnostics.deviceSessions.failed')" :description="state.message" />
    <a-alert v-else-if="state.status === 'forbidden'" type="warning" show-icon :message="t('runtimeDiagnostics.deviceSessions.forbidden')" :description="state.message" />
    <a-alert v-else-if="state.status === 'stale'" type="warning" show-icon :message="state.message || t('runtimeDiagnostics.deviceSessions.stale')" />
    <template v-if="rows.length && !['forbidden', 'unsupported'].includes(state.status)">
      <div v-if="!detailsOnly" class="device-session-results-heading"><span>{{ t('runtimeDiagnostics.deviceSessions.results') }}</span><a-typography-text v-if="resultDeviceId" class="device-session-result-id" :copyable="{ text: resultDeviceId }">{{ resultDeviceId }}</a-typography-text><small v-if="timestamp(state.sampledAt)" class="device-session-snapshot">{{ t('runtimeDiagnostics.deviceSessions.snapshotAt', { time: timestamp(state.sampledAt) }) }}</small><small v-if="state.status === 'error'">{{ t('runtimeDiagnostics.deviceSessions.retainedResults') }}</small><small class="device-session-activity-note">{{ t('runtimeDiagnostics.deviceSessions.lastActiveHint') }}</small></div>
      <div class="device-session-list">
        <section v-for="group in groups" :key="group.key" class="device-session-group" :class="{ 'is-compact': detailsOnly }">
          <header v-if="detailsOnly" class="device-session-heading"><strong class="device-session-node">{{ group.rows[0].session.serverId || t('runtimeDiagnostics.deviceSessions.unknownNode') }}</strong></header>
        <article v-for="row in group.rows" :key="row.key" class="device-session-row">
          <header v-if="!detailsOnly" class="device-session-heading">
            <strong class="device-session-node"><code>{{ row.session.serverId || t('runtimeDiagnostics.deviceSessions.unknownNode') }}</code></strong>
            <a-tag v-if="row.session.transport">{{ row.session.transport }}</a-tag>
            <a-tag v-if="row.current" color="processing">{{ t('runtimeDiagnostics.deviceSessions.currentNode') }}</a-tag>
          </header>
          <a-typography-text v-if="!detailsOnly && row.session.deviceId && row.session.deviceId !== resultDeviceId" class="device-session-id" :copyable="{ text: row.session.deviceId }">{{ row.session.deviceId }}</a-typography-text>
          <dl v-if="!detailsOnly || !row.connections.length" class="device-session-facts">
            <div v-if="row.lastCommAt !== undefined" class="device-session-recent"><dt>{{ t('runtimeDiagnostics.deviceSessions.lastHeartbeat') }}</dt><dd><time>{{ timestamp(row.lastCommAt) }}</time></dd></div>
            <div v-if="duration(row.connectedAt)"><dt>{{ t('runtimeDiagnostics.deviceSessions.connectedFor') }}</dt><dd>{{ duration(row.connectedAt) }}</dd></div>
            <div v-if="row.connectedAt !== undefined"><dt>{{ t('runtimeDiagnostics.deviceSessions.connectTime') }}</dt><dd><time>{{ timestamp(row.connectedAt) }}</time></dd></div>
            <div v-if="row.session.address"><dt>{{ t('runtimeDiagnostics.deviceSessions.address') }}</dt><dd>{{ row.session.address }}</dd></div>
            <div v-if="row.session.parentDeviceId"><dt>{{ t('runtimeDiagnostics.deviceSessions.parentDeviceId') }}</dt><dd>{{ row.session.parentDeviceId }}</dd></div>
            <div v-if="row.pendingMessages !== undefined"><dt>{{ t('runtimeDiagnostics.deviceSessions.pendingMessages') }}</dt><dd>{{ row.pendingMessages }}</dd></div>
          </dl>
          <a-button v-if="row.connections.length > 1 && !expandConnections" class="device-session-connections-toggle" type="link" size="small" :aria-expanded="!!expanded[row.key]" :aria-controls="connectionId(row.key)" @click="toggle(row.key)"><DownOutlined :rotate="expanded[row.key] ? 180 : 0" />{{ t('runtimeDiagnostics.deviceSessions.connections', { count: row.connections.length }) }}</a-button>
          <ul v-if="row.connections.length && (expandConnections || row.connections.length === 1 || expanded[row.key])" :id="connectionId(row.key)" class="device-session-connections">
            <li v-for="connection in row.connections" :key="connection.key">
              <div class="device-session-connection-heading"><span v-if="connection.connection.address" class="device-session-connection-address" :title="[row.session.transport, connection.connection.address, connection.connection.id].filter(Boolean).join(' · ')">{{ connection.connection.address }}</span><code v-if="connection.connection.id && !connection.connection.address" :title="t('runtimeDiagnostics.deviceSessions.connectionId')">{{ connection.connection.id }}</code><span v-if="connection.connectedAt !== undefined" class="device-session-connection-duration" :title="timestamp(connection.connectedAt)"><ClockCircleOutlined :aria-label="t('runtimeDiagnostics.deviceSessions.connectedFor')" /><span>{{ duration(connection.connectedAt) || '—' }}</span></span></div>
              <dl class="device-session-facts device-session-connection-facts">
                <div v-if="connection.lastCommAt !== undefined" :title="`${t('runtimeDiagnostics.deviceSessions.lastCommTime')}: ${timestamp(connection.lastCommAt)}`"><dt><ThunderboltOutlined /><span class="device-session-sr-only">{{ t('runtimeDiagnostics.deviceSessions.lastCommTime') }}</span></dt><dd><time>{{ clockTime(connection.lastCommAt) }}</time></dd></div>
                <div v-for="metric in connection.metrics" :key="metric.key" :title="t(`runtimeDiagnostics.deviceSessions.${metric.key}`)"><dt :style="{ color: metric.key === 'droppedMessages' && metric.raw !== '0' ? 'var(--ant-color-error,#ff4d4f)' : metricColors[metric.key] }"><component :is="metricIcons[metric.key]" /><span class="device-session-sr-only">{{ t(`runtimeDiagnostics.deviceSessions.${metric.key}`) }}</span></dt><dd :title="metric.bytes ? `${metric.raw} B` : metric.raw">{{ metric.value }}</dd></div>
              </dl>
            </li>
          </ul>
        </article>
        </section>
      </div>
    </template>
    <a-empty v-else-if="!['loading', 'error', 'forbidden'].includes(state.status)" class="device-session-empty" :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="t(state.status === 'unsupported' ? 'runtimeDiagnostics.deviceSessions.unsupported' : queriedDeviceId ? 'runtimeDiagnostics.deviceSessions.noSessions' : remoteSearch ? 'runtimeDiagnostics.deviceSessions.remoteInitial' : 'runtimeDiagnostics.deviceSessions.initial')" />
  </section>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onActivated, onDeactivated, ref, watch, type PropType } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { ArrowDownOutlined, ArrowUpOutlined, ClockCircleOutlined, DeleteOutlined, DownOutlined, HourglassOutlined, InboxOutlined, LoadingOutlined, MessageOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import { Empty } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { ActionAccess, DeviceSessionDeviceOption, DeviceSessionInfo, ViewState } from './types'
import { deviceSessionRows, formatDeviceSessionDuration, formatDeviceSessionTimestamp } from './deviceSessionPresentation'
import { deviceObservationMetricColors } from './device-sessions/observation'
const props = defineProps({
  nodeId: { type: String, default: '' }, deviceId: { type: String, default: '' }, queriedDeviceId: { type: String, default: '' },
  remoteSearch: { type: Boolean, default: false }, deviceOptions: { type: Array as PropType<DeviceSessionDeviceOption[]>, default: () => [] }, deviceSearching: { type: Boolean, default: false },
  resultDeviceId: { type: String, default: '' }, sessions: { type: Array as PropType<DeviceSessionInfo[]>, default: () => [] },
  state: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) },
  access: { type: Object as PropType<ActionAccess>, default: () => ({ allowed: false }) }, active: { type: Boolean, default: true },
  detailsOnly: { type: Boolean, default: false }, expandConnections: { type: Boolean, default: false },
})
const emit = defineEmits<{ (event: 'update:deviceId', value: string): void; (event: 'query', deviceId: string): void; (event: 'refresh'): void; (event: 'search-device', keyword: string): void; (event: 'select-device', deviceId: string): void }>()
const { t, locale } = useI18n(), now = ref(Date.now()), visible = ref(true), expanded = ref<Record<string, boolean>>({})
const instanceId = getCurrentInstance()?.uid ?? 0
const canInteract = computed(() => props.active && props.access.allowed)
const input = computed({ get: () => props.deviceId, set: value => { if (canInteract.value) emit('update:deviceId', value) } })
const rows = computed(() => deviceSessionRows(props.sessions, props.nodeId))
// 浮窗按服务节点分组，不合并各会话或连接的计数；独立查询视图保留原有行顺序。
const groups = computed(() => {
  const grouped = new Map<string, typeof rows.value>()
  for (const row of rows.value) {
    const key = props.detailsOnly ? row.session.serverId ?? '' : row.key
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(row)
  }
  return [...grouped].map(([key, rows]) => ({ key, rows }))
})
const canQuery = computed(() => props.active && props.access.allowed && props.state.status !== 'loading')
let selectionHandled = false
const clockEnabled = computed(() => props.active && visible.value && !['forbidden', 'unsupported'].includes(props.state.status) && rows.value.some(row => row.connectedAt !== undefined || row.lastCommAt !== undefined || row.connections.some(connection => connection.connectedAt !== undefined || connection.lastCommAt !== undefined)))
const clock = useIntervalFn(() => { now.value = Date.now() }, 1000, { immediate: false })
/** 只刷新本地相对时间，失活暂停；无任何 API 轮询。 */
watch(clockEnabled, enabled => { if (enabled) { now.value = Date.now(); clock.resume() } else clock.pause() }, { immediate: true })
onActivated(() => { visible.value = true }); onDeactivated(() => { visible.value = false })
watch([() => props.nodeId, () => props.resultDeviceId], () => { expanded.value = {} })
// 周期快照只更新指标；完整结果确认会话消失或撤权时才回收对应的展开状态。
watch([rows, () => props.state.status, () => props.access.allowed], ([current, status, allowed]) => {
  if (!allowed || status === 'forbidden' || status === 'unsupported') { expanded.value = {}; return }
  if (status !== 'ready' && status !== 'empty') return
  const keys = new Set(current.map(row => row.key))
  expanded.value = Object.fromEntries(Object.entries(expanded.value).filter(([key]) => keys.has(key)))
})
function query() { const id = input.value.trim(); if (canQuery.value && id) emit('query', id) }
function refresh() { if (canQuery.value && props.queriedDeviceId) emit('refresh') }
function searchDevice(keyword: string) { if (props.remoteSearch && canInteract.value) emit('search-device', keyword) }
/** Ant 在同一键盘事件内先选择再回传 keydown，避免 Enter 同时选择候选和提交表单。 */
function selectDevice(value: unknown) {
  if (!props.remoteSearch || !canQuery.value || typeof value !== 'string' || !value) return
  selectionHandled = true
  emit('select-device', value)
  void nextTick(() => { selectionHandled = false })
}
function searchKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.isComposing) return
  event.preventDefault()
  if (!selectionHandled) query()
}
function toggle(key: string) { expanded.value = { ...expanded.value, [key]: !expanded.value[key] } }
function connectionId(key: string) { return `device-session-connections-${instanceId}-${encodeURIComponent(key)}` }
const metricIcons: Record<string, typeof ArrowDownOutlined> = { readBytes: ArrowDownOutlined, writeBytes: ArrowUpOutlined, totalMessages: MessageOutlined, pendingMessages: InboxOutlined, metricsPendingMessages: HourglassOutlined, droppedMessages: DeleteOutlined }
// 累计量与速率共用通信方向和颜色，含义仍通过各自指标名称区分。
const metricColors: Record<string, string> = { readBytes: deviceObservationMetricColors.receive, writeBytes: deviceObservationMetricColors.send, totalMessages: deviceObservationMetricColors.messages, pendingMessages: deviceObservationMetricColors.pending, metricsPendingMessages: deviceObservationMetricColors.pending }
function clockTime(value: number) { return new Date(value).toLocaleTimeString(locale.value, { hour12: false }) }
function timestamp(value: unknown) { return formatDeviceSessionTimestamp(value, locale.value) }
function duration(value: unknown) { return formatDeviceSessionDuration(value, now.value, locale.value) }
</script>
<style scoped>
.device-session-viewer { min-width:0; color:var(--ink-1,var(--text-color,#262626)); }.device-session-toolbar { gap:8px; margin-block:4px 12px; }.device-session-input { flex:1 1 280px; width:min(100%,480px); max-width:480px; min-width:0; }.device-session-filters { flex:0 1 auto; min-width:0; max-width:100%; }.device-session-filters :deep(.ant-select) { max-width:100%; }.device-session-option { display:block; min-width:0; max-width:100%; overflow-wrap:anywhere; white-space:normal; }.device-session-option strong { display:block; color:var(--ink-1,var(--text-color,#262626)); font-weight:500; }.device-session-option small { display:flex; flex-wrap:wrap; gap:0 8px; color:var(--ink-2,var(--text-color-secondary,#595959)); font-size:var(--fs-caption,12px); }.device-session-option small > * { min-width:0; max-width:100%; overflow-wrap:anywhere; }
.device-session-query-status,.device-session-results-heading { display:flex; align-items:center; flex-wrap:wrap; gap:8px; font-size:var(--fs-caption,12px); color:var(--ink-2,var(--text-color-secondary,#595959)); margin-block:8px; overflow-wrap:anywhere; }.device-session-query-status > span,.device-session-results-heading > span { min-width:0; overflow-wrap:anywhere; }.device-session-query-status small,.device-session-results-heading small { font-size:var(--fs-caption,12px); }.device-session-result-id { flex:1 1 280px; max-width:100%; color:var(--ink-1,var(--text-color,#262626)); font-size:var(--fs-body,14px); font-weight:600; }
.device-session-viewer > :deep(.ant-alert) { margin-block:8px; }.device-session-row { min-width:0; padding:12px 0; border-bottom:1px solid var(--line); }.device-session-heading { display:flex; flex-wrap:wrap; align-items:center; gap:6px 8px; min-width:0; }.device-session-id { display:block; margin-top:4px; min-width:0; max-width:100%; overflow-wrap:anywhere; color:var(--ink-2,var(--text-color-secondary,#595959)); font-size:var(--fs-caption,12px); }.device-session-heading :deep(.ant-tag) { margin-inline-end:0; }.device-session-node { color:var(--ink-1,var(--text-color,#262626)); font-size:var(--fs-body,14px); font-weight:600; min-width:0; overflow-wrap:anywhere; }.device-session-node code { overflow-wrap:anywhere; }
.device-session-group.is-compact { padding-block:6px; }.is-compact .device-session-row { padding:4px 0; border:0; }.is-compact .device-session-connections { margin-top:4px; }
.is-compact .device-session-connections { padding:8px; }.is-compact .device-session-connections > li + li { margin-top:8px; padding-top:8px; }.is-compact .device-session-connection-facts { gap:4px 12px; margin-top:6px; }.device-session-connection-facts dd { font-size:var(--fs-caption,12px); font-variant-numeric:tabular-nums; font-weight:500; }
.device-session-activity-note { flex-basis:100%; }.device-session-snapshot { max-width:100%; }
.device-session-facts { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr)); gap:10px 20px; margin:12px 0 0; }.device-session-facts > div { min-width:0; }.device-session-facts dt { font-size:var(--fs-caption,12px); color:var(--ink-2,var(--text-color-secondary,#595959)); margin-bottom:3px; }.device-session-facts dd { margin:0; font-size:var(--fs-sm,13px); color:var(--ink-1,var(--text-color,#262626)); overflow-wrap:anywhere; }.device-session-recent strong { font-weight:500; }.device-session-recent time { display:block; font-size:var(--fs-caption,12px); color:var(--ink-2,var(--text-color-secondary,#595959)); margin-top:2px; }
.device-session-connections-toggle { margin-top:8px; padding-inline:0; }.device-session-connections { list-style:none; margin:10px 0 0; padding:12px; background:var(--bg-sunken,var(--ant-color-fill-alter,#f5f7fa)); border-radius:var(--radius-sm,4px); }.device-session-connections > li + li { margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }.device-session-connection-heading { display:flex; flex-wrap:wrap; gap:6px 12px; font-size:var(--fs-caption,12px); color:var(--ink-2,var(--text-color-secondary,#595959)); overflow-wrap:anywhere; }.device-session-connection-heading > * { min-width:0; overflow-wrap:anywhere; }.device-session-connection-facts { display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:8px; }.device-session-connection-facts > div { display:flex; align-items:center; gap:5px; min-width:0; }.device-session-connection-facts dt { margin:0; }.device-session-connection-address { color:var(--ink-1); }.device-session-connection-duration { display:inline-flex; align-items:center; gap:4px; margin-left:auto; }.device-session-sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }.device-session-empty { margin-block:48px; }
@media(max-width:540px) { .device-session-input { flex:1 1 100%; width:100%; }.device-session-facts { gap:8px 16px; } }
</style>
