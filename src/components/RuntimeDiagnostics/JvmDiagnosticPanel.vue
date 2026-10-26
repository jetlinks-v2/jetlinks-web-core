<template>
  <section class="jvm-panel">
    <a-tabs class="diagnostics-mode-tabs" :active-key="active" @change="changeTab">
      <a-tab-pane v-if="access.jfrView.allowed" key="performance"><template #tab><span class="jvm-mode-label"><FireOutlined />{{ t('runtimeDiagnostics.realtimeAnalysis') }}</span></template></a-tab-pane>
      <a-tab-pane v-if="canViewSnapshots" key="snapshots"><template #tab><span class="jvm-mode-label"><CameraOutlined />{{ t('runtimeDiagnostics.diagnosticSnapshots') }}</span></template></a-tab-pane>
      <template #rightExtra>
        <div class="jvm-tab-extra">
          <div v-if="running || (active === 'performance' && hasSnapshot)" class="jvm-tab-actions">
            <a-badge v-if="running" :status="samplingState.delay ? 'warning' : 'processing'" :text="samplingLabel" />
            <a-tag v-else :color="statusColor">{{ samplingLabel }}</a-tag>
            <a-button v-if="running" size="small" @click="emit('stop')">{{ t('runtimeDiagnostics.stopSampling') }}</a-button>
            <a-button v-else type="primary" size="small" :disabled="!canStart" :title="startReason" @click="start"><PlayCircleOutlined />{{ t('runtimeDiagnostics.startSampling') }}</a-button>
          </div>
          <a-popover v-if="active === 'performance'" ref="morePopover" :open="moreOpen" trigger="click" placement="bottomRight" @open-change="onMoreOpen">
            <template #content>
              <div class="jvm-more-actions" role="menu" @keydown.esc.stop="closeMore">
                <a-tooltip v-if="hasSnapshot" :title="exportReason" :trigger="['hover', 'focus']">
                  <span v-if="!canExport" tabindex="0" role="menuitem" :aria-label="exportReason"><a-button type="text" size="small" disabled>{{ t('runtimeDiagnostics.exportFlameHtml') }}</a-button></span>
                  <a-button v-else type="text" size="small" role="menuitem" @click="exportHtml">{{ t('runtimeDiagnostics.exportFlameHtml') }}</a-button>
                </a-tooltip>
                <a-tooltip :title="captureReason" :trigger="['hover', 'focus']">
                  <span v-if="!canCapture" tabindex="0" role="menuitem" :aria-label="captureReason"><a-button type="text" size="small" disabled>{{ t('runtimeDiagnostics.jfrFile') }}</a-button></span>
                  <a-button v-else type="text" size="small" role="menuitem" @click="captureJfr">{{ t('runtimeDiagnostics.jfrFile') }}</a-button>
                </a-tooltip>
              </div>
            </template>
            <a-button ref="moreTrigger" type="text" size="small" :title="t('runtimeDiagnostics.jvmMoreActions')" :aria-label="t('runtimeDiagnostics.jvmMoreActions')" @keydown="onMoreTriggerKeydown"><MoreOutlined /></a-button>
          </a-popover>
        </div>
      </template>
    </a-tabs>
    <section v-show="active === 'performance'" class="jvm-live-analysis">
      <div v-if="running && samplingState.delay" class="jvm-sampling-delay" role="status"><span>{{ t(samplingState.delay === 'first-frame' ? 'runtimeDiagnostics.samplingFirstFrameDelayHint' : 'runtimeDiagnostics.samplingUpdatesDelayHint', { seconds: samplingState.quietSeconds ?? 0 }) }}</span><a-button type="link" size="small" :disabled="!access.jfr.allowed || !access.jfrView.allowed" @click="retry">{{ t('runtimeDiagnostics.samplingReconnect') }}</a-button></div>
      <a-alert v-if="samplingState.message && !terminalSamplingState" :type="samplingState.status === 'error' ? 'error' : 'info'" show-icon :message="samplingState.message" class="jvm-message" />
      <a-result v-if="!access.jfrView.allowed" status="403" :title="access.jfrView.reason || t('runtimeDiagnostics.forbidden')" />
      <a-result v-else-if="terminalSamplingState" :status="samplingState.status === 'forbidden' ? '403' : 'warning'" :title="terminalSamplingTitle" />
      <div v-else-if="!hasDisplaySamples" class="jvm-sampling-empty" :class="{ 'jvm-sampling-empty--partial': hasAllocations }" role="status">
        <a-button v-if="!running && !hasSnapshot" type="primary" size="large" :disabled="!canStart" :title="startReason" @click="start"><PlayCircleOutlined />{{ t('runtimeDiagnostics.startSampling') }}</a-button>
        <p>{{ emptyDescription }}</p>
        <div v-if="hasSnapshot" class="jvm-sampling-feedback"><span>{{ t('runtimeDiagnostics.samplingUpdates', { count: (samplingState.updateCount ?? 0).toLocaleString() }) }}</span><span>{{ t('runtimeDiagnostics.samplingExecutionSamples', { count: sampleCount.toLocaleString() }) }}</span><span>{{ t('runtimeDiagnostics.samplingElapsed', { duration: elapsedLabel }) }}</span></div>
        <div v-else-if="running && samplingState.startedAt !== undefined" class="jvm-sampling-feedback"><span>{{ t('runtimeDiagnostics.samplingElapsed', { duration: elapsedLabel }) }}</span></div>
      </div>
      <!-- 同一节点复用阅读实例；隐藏时保存视口，撤权时释放证据。 -->
      <KeepAlive v-if="access.jfrView.allowed" :key="nodeId">
        <FlameGraphViewer v-if="active === 'performance' && hasDisplaySamples" embedded :active="flameActive" :snapshot="snapshot" :platform-prefixes="platformPrefixes" :minimum-samples="minimumSamples">
          <template #sampling-details>
            <div v-if="samplingState.startedAt !== undefined" class="jvm-sampling-feedback" role="status"><span>{{ t('runtimeDiagnostics.samplingElapsed', { duration: elapsedLabel }) }}</span><span>{{ t('runtimeDiagnostics.samplingUpdates', { count: (samplingState.updateCount ?? 0).toLocaleString() }) }}</span><span>{{ t('runtimeDiagnostics.samplingExecutionSamples', { count: sampleCount.toLocaleString() }) }}</span><span>{{ samplingState.sampledAt !== undefined ? t('runtimeDiagnostics.lastFrameAt', { time: new Date(samplingState.sampledAt).toLocaleTimeString() }) : t('runtimeDiagnostics.noFrameReceived') }}</span></div>
            <div class="jvm-sample-hint">{{ t('runtimeDiagnostics.samplingCountHint') }}</div>
          </template>
        </FlameGraphViewer>
      </KeepAlive>
      <section v-if="hasSnapshot && access.jfrView.allowed && !terminalSamplingState" class="jvm-allocation-evidence">
        <AllocationRanking :key="nodeId" v-model:search="allocationSearch" integrated :allocations="snapshot?.objectAllocations" />
      </section>
    </section>
    <section v-if="visitedSnapshots && canViewSnapshots" v-show="active === 'snapshots'" class="jvm-snapshot-evidence">
      <ThreadViewer :key="nodeId" embedded :threads="access.threadDump.allowed ? threads : []" :state="access.threadDump.allowed ? threadState : { status: 'ready' }" :sample-access="access.threadDump" @sample="sampleThreads">
        <template #actions>
          <a-button v-if="access.threadDump.allowed" type="primary" :loading="threadState.status === 'loading'" :disabled="threadState.status === 'loading'" @click="sampleThreads"><BranchesOutlined />{{ t('runtimeDiagnostics.captureThreads') }}</a-button>
          <slot name="memory"><a-button v-if="access.heapDump.allowed || access.heapExport.allowed" :disabled="!canHeap" :title="access.heapDump.reason || access.heapExport.reason" @click="heapDump"><DatabaseOutlined />{{ t('runtimeDiagnostics.exportHeapSnapshot') }}</a-button></slot>
        </template>
        <template #empty><p>{{ t(access.threadDump.allowed ? 'runtimeDiagnostics.noThreadSnapshot' : 'runtimeDiagnostics.heapSnapshotHint') }}</p></template>
      </ThreadViewer>
    </section>
  </section>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { BranchesOutlined, CameraOutlined, DatabaseOutlined, FireOutlined, MoreOutlined, PlayCircleOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import type { JfrSnapshot, JvmDiagnosticAccess, JvmDiagnosticTab, SamplingState, ThreadSnapshot, ViewState } from './types'
import AllocationRanking from './AllocationRanking.vue'
import { createVisiblePopupFocus } from './popupFocus'
const ThreadViewer = defineAsyncComponent(() => import('./ThreadViewer.vue'))
const FlameGraphViewer = defineAsyncComponent(() => import('./FlameGraphViewer.vue'))
const props = withDefaults(defineProps<{ nodeId: string; threads?: ThreadSnapshot[]; threadState?: ViewState; snapshot?: JfrSnapshot; samplingState: SamplingState; streamPhase?: 'connecting' | 'waiting' | 'receiving'; elapsedSeconds?: number; access: JvmDiagnosticAccess; platformPrefixes?: string[]; activeTab?: JvmDiagnosticTab | 'threads' | 'memory'; minimumSamples?: number; active?: boolean }>(), { threads: () => [], threadState: () => ({ status: 'ready' }), platformPrefixes: () => ['org.jetlinks.'], elapsedSeconds: 0, minimumSamples: 100, active: true })
const emit = defineEmits<{ (event: 'sample' | 'start' | 'stop' | 'export-html' | 'capture-jfr'): void; (event: 'heap-dump', value: { live: boolean }): void; (event: 'update:activeTab', value: JvmDiagnosticTab): void }>()
const { t } = useI18n()
const localTab = ref<JvmDiagnosticTab>('performance'), allocationSearch = ref(''), moreOpen = ref(false), moreTrigger = ref<{ $el: HTMLButtonElement }>(), morePopover = ref<{ getPopupDomNode?: () => HTMLElement }>(), popupFocus = createVisiblePopupFocus()
const canViewSnapshots = computed(() => props.access.threadDump.allowed || props.access.heapDump.allowed || props.access.heapExport.allowed)
/** 旧线程页归到快照，旧内存页归到实时分析；没有 JFR 能力时进入可用的快照页。 */
const active = computed<JvmDiagnosticTab>(() => {
  const requested = props.activeTab ?? localTab.value
  const tab = requested === 'threads' || requested === 'snapshots' ? 'snapshots' : 'performance'
  return tab === 'performance' && !props.access.jfrView.allowed && canViewSnapshots.value ? 'snapshots' : tab === 'snapshots' && !canViewSnapshots.value ? 'performance' : tab
})
const visitedSnapshots = ref(false)
watch(active, value => { if (value === 'snapshots') visitedSnapshots.value = true }, { immediate: true })
const flameActive = computed(() => props.active && active.value === 'performance')
const running = computed(() => ['starting', 'recording'].includes(props.samplingState.status))
const terminalSamplingState = computed(() => ['forbidden', 'unsupported'].includes(props.samplingState.status))
const samplingLabel = computed(() => t(running.value && props.samplingState.delay ? props.samplingState.delay === 'first-frame' ? 'runtimeDiagnostics.samplingFirstFrameDelayed' : 'runtimeDiagnostics.samplingUpdatesDelayed' : props.samplingState.status === 'starting' && props.streamPhase === 'waiting' ? 'runtimeDiagnostics.waitingFirstFrame' : props.samplingState.status === 'recording' ? 'runtimeDiagnostics.receivingFrames' : `runtimeDiagnostics.samplingStatus.${props.samplingState.status}`))
const terminalSamplingTitle = computed(() => { const status = t(`runtimeDiagnostics.samplingStatus.${props.samplingState.status}`); return props.samplingState.message ? `${status}: ${props.samplingState.message}` : status })
// 根权重是执行样本数，更新次数和分配样本不能与之相加。
const sampleCount = computed(() => props.snapshot?.flameGraph.reduce((total, frame) => total + (Number.isFinite(frame.samples) && frame.samples > 0 ? frame.samples : 0), 0) ?? 0)
const hasSnapshot = computed(() => !!props.snapshot), hasDisplaySamples = computed(() => sampleCount.value > 0), hasAllocations = computed(() => !!props.snapshot?.objectAllocations.length)
const emptyDescription = computed(() => t(running.value ? props.snapshot ? 'runtimeDiagnostics.samplingEmptyActive' : 'runtimeDiagnostics.samplingEmptyWaiting' : props.samplingState.status === 'idle' ? 'runtimeDiagnostics.noFlameSamples' : props.samplingState.status === 'stopped' ? 'runtimeDiagnostics.samplingEmptyStopped' : 'runtimeDiagnostics.samplingEmptyUnavailable'))
const canExport = computed(() => props.access.jfrView.allowed && props.access.jfrExport.allowed && !!props.snapshot)
const canCapture = computed(() => props.access.jfr.allowed && props.access.jfrExport.allowed)
const canHeap = computed(() => props.access.heapDump.allowed && props.access.heapExport.allowed)
const canStart = computed(() => props.access.jfr.allowed && props.access.jfrView.allowed && !terminalSamplingState.value)
const startReason = computed(() => !props.access.jfr.allowed ? props.access.jfr.reason || t('runtimeDiagnostics.forbidden') : !props.access.jfrView.allowed ? props.access.jfrView.reason || t('runtimeDiagnostics.forbidden') : '')
const exportReason = computed(() => !props.access.jfrView.allowed ? props.access.jfrView.reason || t('runtimeDiagnostics.forbidden') : !props.access.jfrExport.allowed ? props.access.jfrExport.reason || t('runtimeDiagnostics.forbidden') : props.snapshot ? '' : emptyDescription.value)
const captureReason = computed(() => !props.access.jfr.allowed ? props.access.jfr.reason || t('runtimeDiagnostics.forbidden') : !props.access.jfrExport.allowed ? props.access.jfrExport.reason || t('runtimeDiagnostics.forbidden') : '')
const elapsedLabel = computed(() => { const seconds = Math.max(0, Math.floor(props.elapsedSeconds)); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` })
const statusColor = computed(() => ({ recording: 'processing', starting: 'processing', error: 'error', forbidden: 'warning', unsupported: 'warning', idle: undefined, stopped: 'default' }[props.samplingState.status]))
watch(() => props.nodeId, () => { allocationSearch.value = ''; moreOpen.value = false; popupFocus.cancel() })
watch(() => props.access.jfrView.allowed, allowed => { if (!allowed) allocationSearch.value = '' })
watch(() => props.active, active => { if (!active) { moreOpen.value = false; popupFocus.cancel() } })
watch(moreOpen, open => { if (!open) popupFocus.cancel() }, { flush: 'sync' })
function changeTab(value: string | number) { moreOpen.value = false; if (value === 'performance' || value === 'snapshots') { localTab.value = value; emit('update:activeTab', value) } }
function start() { if (props.active && canStart.value && !running.value) emit('start') }
function sampleThreads() { if (props.active && props.access.threadDump.allowed && props.threadState.status !== 'loading') emit('sample') }
/** 只有显式重连重开本页订阅，不调用全局停止。 */
function retry() { if (props.active && props.access.jfr.allowed && props.access.jfrView.allowed && running.value && props.samplingState.delay) { emit('stop'); emit('start') } }
function exportHtml() { if (props.active && canExport.value) { moreOpen.value = false; emit('export-html') } }
function captureJfr() { if (props.active && canCapture.value) { moreOpen.value = false; emit('capture-jfr') } }
function heapDump() { if (props.active && canHeap.value) emit('heap-dump', { live: false }) }
function closeMore() { moreOpen.value = false; popupFocus.cancel(); moreTrigger.value?.$el.focus() }
function focusMore(nodeId = props.nodeId) { popupFocus.focus({ getPopup: () => morePopover.value?.getPopupDomNode?.(), getTarget: popup => popup.querySelector<HTMLElement>('[tabindex="0"],button:not([disabled])') ?? undefined, isActive: () => moreOpen.value && props.active && nodeId === props.nodeId }) }
function onMoreOpen(open: boolean) { moreOpen.value = open; if (open) focusMore(); else popupFocus.cancel() }
function onMoreTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closeMore(); return }
  if (event.key === 'ArrowDown') { event.preventDefault(); if (!moreOpen.value) onMoreOpen(true); else focusMore(); return }
  if (event.key === 'Tab' && moreOpen.value && !event.shiftKey) { event.preventDefault(); focusMore() }
}
onDeactivated(() => { moreOpen.value = false; popupFocus.cancel() })
onBeforeUnmount(() => { moreOpen.value = false; popupFocus.cancel() })
</script>
<style scoped>
.jvm-panel,.jvm-live-analysis { display:flex; flex:1 1 0; flex-direction:column; min-width:0; min-height:0; }
.jvm-panel > :deep(.ant-tabs) { flex:none; margin-bottom:16px; }
.jvm-panel > :deep(.ant-tabs .ant-tabs-nav) { margin-bottom:0; }
.jvm-mode-label,.jvm-tab-extra,.jvm-tab-actions,.jvm-snapshot-actions { display:flex; align-items:center; gap:8px; }
.jvm-mode-label { font-size:13px; }
.jvm-tab-extra { padding-inline-start:12px; }
.jvm-tab-actions { white-space:nowrap; }
.jvm-tab-actions :deep(.ant-badge-status-text) { font-size:12px; }
.jvm-tab-actions :deep(.ant-tag) { margin:0; }
.jvm-allocation-evidence { margin-top:24px; padding-top:16px; border-top:1px solid var(--line); }
.jvm-snapshot-evidence { min-width:0; }
.jvm-message { margin-bottom:8px; }
.jvm-sampling-feedback { display:flex; align-items:center; flex-wrap:wrap; gap:4px 16px; margin-bottom:8px; color:var(--ink-2); font-size:12px; font-variant-numeric:tabular-nums; }
.jvm-sampling-delay { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 8px; margin-bottom:8px; color:var(--warning); font-size:12px; }
.jvm-sampling-delay > .ant-btn { padding:0; height:auto; font-size:inherit; }
.jvm-sample-hint { max-width:360px; }
.jvm-more-actions { display:flex; flex-direction:column; gap:4px; min-width:150px; }
.jvm-sampling-empty { display:flex; flex:1 1 0; min-height:220px; flex-direction:column; align-items:center; justify-content:center; gap:12px; text-align:center; }
.jvm-sampling-empty--partial { min-height:120px; flex:none; }
.jvm-sampling-empty :deep(.ant-btn-lg) { min-width:160px; }
.jvm-sampling-empty p { margin:0; color:var(--ink-3); font-size:12px; }
.jvm-sampling-empty .jvm-sampling-feedback { justify-content:center; margin:0; }
@media(max-width:800px) { .jvm-panel > :deep(.ant-tabs .ant-tabs-nav) { flex-wrap:wrap; row-gap:8px; }.jvm-tab-extra { padding-inline-start:0; }.jvm-tab-actions { flex-wrap:wrap; white-space:normal; } }
</style>
