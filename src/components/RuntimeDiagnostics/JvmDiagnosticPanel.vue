<template>
  <section class="jvm-panel">
    <a-tabs class="diagnostics-mode-tabs" :active-key="active" size="small" @change="changeTab">
      <a-tab-pane key="threads" :tab="t('runtimeDiagnostics.threads')" />
      <a-tab-pane key="performance" :tab="t('runtimeDiagnostics.performance')" />
      <a-tab-pane key="memory" :tab="t('runtimeDiagnostics.memoryEvidence')" />
      <template #rightExtra>
        <div v-if="active === 'performance'" class="jvm-tab-extra">
          <div v-if="hasDisplaySamples" class="jvm-tab-actions">
            <a-badge v-if="running" :status="samplingState.delay ? 'warning' : 'processing'" :text="samplingLabel" />
            <a-tag v-else :color="statusColor">{{ samplingLabel }}</a-tag>
            <a-button v-if="!running" type="primary" size="small" :disabled="!canStart" :title="startReason" @click="start">{{ t('runtimeDiagnostics.startSampling') }}</a-button>
            <a-button v-else size="small" @click="emit('stop')">{{ t('runtimeDiagnostics.stopSampling') }}</a-button>
          </div>
          <a-popover ref="morePopover" :open="moreOpen" trigger="click" placement="bottomRight" @open-change="onMoreOpen">
            <template #content>
              <div class="jvm-more-actions" role="menu" @keydown.esc.stop="closeMore">
                <a-tooltip v-if="hasSnapshot" :title="exportReason" :trigger="['hover', 'focus']">
                  <span v-if="!canExport" tabindex="0" role="menuitem" :aria-label="exportReason"><a-button type="text" size="small" disabled @click="exportHtml">{{ t('runtimeDiagnostics.exportFlameHtml') }}</a-button></span>
                  <a-button v-else type="text" size="small" role="menuitem" @click="exportHtml">{{ t('runtimeDiagnostics.exportFlameHtml') }}</a-button>
                </a-tooltip>
                <a-tooltip :title="captureReason" :trigger="['hover', 'focus']">
                  <span v-if="!canCapture" tabindex="0" role="menuitem" :aria-label="captureReason"><a-button type="text" size="small" disabled @click="captureJfr">{{ t('runtimeDiagnostics.jfrFile') }}</a-button></span>
                  <a-button v-else type="text" size="small" role="menuitem" @click="captureJfr">{{ t('runtimeDiagnostics.jfrFile') }}</a-button>
                </a-tooltip>
              </div>
            </template>
            <a-button ref="moreTrigger" type="text" size="small" :title="t('runtimeDiagnostics.jvmMoreActions')" :aria-label="t('runtimeDiagnostics.jvmMoreActions')" @keydown="onMoreTriggerKeydown"><MoreOutlined /></a-button>
          </a-popover>
        </div>
      </template>
    </a-tabs>
    <ThreadViewer v-if="active === 'threads'" :threads="threads" :state="threadState" :sample-access="access.threadDump" @sample="allowed('threadDump') && emit('sample')" />
    <template v-else-if="active === 'performance'">
      <div v-if="running && samplingState.delay" class="jvm-sampling-delay" role="status"><span>{{ t(samplingState.delay === 'first-frame' ? 'runtimeDiagnostics.samplingFirstFrameDelayHint' : 'runtimeDiagnostics.samplingUpdatesDelayHint', { seconds: samplingState.quietSeconds ?? 0 }) }}</span><a-button type="link" size="small" :disabled="!access.jfr.allowed || !access.jfrView.allowed" @click="retry">{{ t('runtimeDiagnostics.samplingReconnect') }}</a-button></div>
      <a-alert v-if="samplingState.message && !terminalSamplingState" :type="samplingState.status === 'error' ? 'error' : 'info'" show-icon :message="samplingState.message" class="jvm-message" />
      <a-result v-if="!access.jfrView.allowed" status="403" :title="access.jfrView.reason || t('runtimeDiagnostics.forbidden')" />
      <a-result v-else-if="terminalSamplingState" :status="samplingState.status === 'forbidden' ? '403' : 'warning'" :title="terminalSamplingTitle" />
      <div v-else-if="!hasDisplaySamples" class="jvm-sampling-empty" role="status"><a-badge v-if="running" :status="samplingState.delay ? 'warning' : 'processing'" :text="samplingLabel" /><a-button v-else type="primary" size="large" :disabled="!canStart" :title="startReason" @click="start"><PlayCircleOutlined />{{ t('runtimeDiagnostics.startSampling') }}</a-button><a-button v-if="running" size="large" @click="emit('stop')">{{ t('runtimeDiagnostics.stopSampling') }}</a-button><p>{{ emptyDescription }}</p><div v-if="hasSnapshot" class="jvm-sampling-feedback"><span>{{ t('runtimeDiagnostics.samplingUpdates', { count: (samplingState.updateCount ?? 0).toLocaleString() }) }}</span><span>{{ t('runtimeDiagnostics.samplingExecutionSamples', { count: sampleCount.toLocaleString() }) }}</span><span>{{ t('runtimeDiagnostics.samplingElapsed', { duration: elapsedLabel }) }}</span></div><div v-else-if="running && samplingState.startedAt !== undefined" class="jvm-sampling-feedback"><span>{{ t('runtimeDiagnostics.samplingElapsed', { duration: elapsedLabel }) }}</span></div></div>
    </template>
    <!-- 缓存属于当前节点且随撤权释放；停用时由火焰图恢复自身视口，不重新初始化筛选。 -->
    <KeepAlive v-if="access.jfrView.allowed" :key="nodeId">
      <FlameGraphViewer v-if="active === 'performance' && hasDisplaySamples" :active="flameActive" :snapshot="snapshot" :platform-prefixes="platformPrefixes" :minimum-samples="minimumSamples">
        <template #sampling-details>
          <div v-if="samplingState.startedAt !== undefined" class="jvm-sampling-feedback" role="status">
            <span>{{ t('runtimeDiagnostics.samplingElapsed', { duration: elapsedLabel }) }}</span>
            <span>{{ t('runtimeDiagnostics.samplingUpdates', { count: (samplingState.updateCount ?? 0).toLocaleString() }) }}</span>
            <span>{{ t('runtimeDiagnostics.samplingExecutionSamples', { count: sampleCount.toLocaleString() }) }}</span>
            <span>{{ samplingState.sampledAt !== undefined ? t('runtimeDiagnostics.lastFrameAt', { time: new Date(samplingState.sampledAt).toLocaleTimeString() }) : t('runtimeDiagnostics.noFrameReceived') }}</span>
          </div>
          <div class="jvm-sample-hint">{{ t('runtimeDiagnostics.samplingCountHint') }}</div>
        </template>
      </FlameGraphViewer>
    </KeepAlive>
    <template v-if="active === 'memory'">
      <AllocationRanking v-if="access.jfrView.allowed" v-model:search="allocationSearch" :allocations="snapshot?.objectAllocations" @go-performance="changeTab('performance')" />
      <a-empty v-else :description="t('runtimeDiagnostics.forbidden')" />
      <slot name="memory">
        <div class="jvm-heap">
          <div><strong>{{ t('runtimeDiagnostics.heapDump') }}</strong><p>{{ t('runtimeDiagnostics.heapEvidenceHint') }}</p></div>
          <a-space wrap><a-checkbox v-model:checked="live">{{ t('runtimeDiagnostics.liveObjects') }}</a-checkbox><a-button :disabled="!access.heapDump.allowed || !access.heapExport.allowed" :title="access.heapDump.reason || access.heapExport.reason" @click="heapDump">{{ t('runtimeDiagnostics.exportHeap') }}</a-button></a-space>
        </div>
      </slot>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { MoreOutlined, PlayCircleOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import type { JfrSnapshot, JvmDiagnosticAccess, SamplingState, ThreadSnapshot, ViewState } from './types'
import AllocationRanking from './AllocationRanking.vue'
import { createVisiblePopupFocus } from './popupFocus'
const ThreadViewer = defineAsyncComponent(() => import('./ThreadViewer.vue'))
const FlameGraphViewer = defineAsyncComponent(() => import('./FlameGraphViewer.vue'))
type DiagnosticTab = 'threads' | 'performance' | 'memory'
const props = withDefaults(defineProps<{ nodeId: string; threads?: ThreadSnapshot[]; threadState?: ViewState; snapshot?: JfrSnapshot; samplingState: SamplingState; streamPhase?: 'connecting' | 'waiting' | 'receiving'; elapsedSeconds?: number; access: JvmDiagnosticAccess; platformPrefixes?: string[]; activeTab?: DiagnosticTab; minimumSamples?: number; active?: boolean }>(), { threads: () => [], threadState: () => ({ status: 'ready' }), platformPrefixes: () => ['org.jetlinks.'], elapsedSeconds: 0, minimumSamples: 100, active: true })
const emit = defineEmits<{ (event: 'sample' | 'start' | 'stop' | 'export-html' | 'capture-jfr'): void; (event: 'heap-dump', value: { live: boolean }): void; (event: 'update:activeTab', value: DiagnosticTab): void }>()
const { t } = useI18n()
const localTab = ref<DiagnosticTab>('threads'), live = ref(false), allocationSearch = ref(''), moreOpen = ref(false), moreTrigger = ref<{ $el: HTMLButtonElement }>(), morePopover = ref<{ getPopupDomNode?: () => HTMLElement }>(), popupFocus = createVisiblePopupFocus()
const active = computed(() => props.activeTab ?? localTab.value)
const flameActive = computed(() => props.active && active.value === 'performance')
const running = computed(() => ['starting', 'recording'].includes(props.samplingState.status))
const terminalSamplingState = computed(() => ['forbidden', 'unsupported'].includes(props.samplingState.status))
const samplingLabel = computed(() => t(running.value && props.samplingState.delay ? props.samplingState.delay === 'first-frame' ? 'runtimeDiagnostics.samplingFirstFrameDelayed' : 'runtimeDiagnostics.samplingUpdatesDelayed' : props.samplingState.status === 'starting' && props.streamPhase === 'waiting' ? 'runtimeDiagnostics.waitingFirstFrame' : props.samplingState.status === 'recording' ? 'runtimeDiagnostics.receivingFrames' : `runtimeDiagnostics.samplingStatus.${props.samplingState.status}`))
const terminalSamplingTitle = computed(() => {
  const status = t(`runtimeDiagnostics.samplingStatus.${props.samplingState.status}`)
  return props.samplingState.message ? `${status}: ${props.samplingState.message}` : status
})
// 累计报告树根权重是当前可展示的样本数；接收快照次数不能作为执行样本，父子也不能累加。
const sampleCount = computed(() => props.snapshot?.flameGraph.reduce((total, frame) => total + (Number.isFinite(frame.samples) && frame.samples > 0 ? frame.samples : 0), 0) ?? 0)
const hasSnapshot = computed(() => !!props.snapshot)
const hasDisplaySamples = computed(() => sampleCount.value > 0)
const emptyDescription = computed(() => t(running.value ? props.snapshot ? 'runtimeDiagnostics.samplingEmptyActive' : 'runtimeDiagnostics.samplingEmptyWaiting' : props.samplingState.status === 'idle' ? 'runtimeDiagnostics.noFlameSamples' : props.samplingState.status === 'stopped' ? 'runtimeDiagnostics.samplingEmptyStopped' : 'runtimeDiagnostics.samplingEmptyUnavailable'))
const canExport = computed(() => props.access.jfrView.allowed && props.access.jfrExport.allowed && !!props.snapshot)
const canCapture = computed(() => props.access.jfr.allowed && props.access.jfrExport.allowed)
const canStart = computed(() => props.access.jfr.allowed && props.access.jfrView.allowed && !['forbidden', 'unsupported'].includes(props.samplingState.status))
const startReason = computed(() => !props.access.jfr.allowed ? props.access.jfr.reason || t('runtimeDiagnostics.forbidden') : !props.access.jfrView.allowed ? props.access.jfrView.reason || t('runtimeDiagnostics.forbidden') : '')
const exportReason = computed(() => !props.access.jfrView.allowed ? props.access.jfrView.reason || t('runtimeDiagnostics.forbidden') : !props.access.jfrExport.allowed ? props.access.jfrExport.reason || t('runtimeDiagnostics.forbidden') : props.snapshot ? '' : emptyDescription.value)
const captureReason = computed(() => !props.access.jfr.allowed ? props.access.jfr.reason || t('runtimeDiagnostics.forbidden') : !props.access.jfrExport.allowed ? props.access.jfrExport.reason || t('runtimeDiagnostics.forbidden') : '')
const elapsedLabel = computed(() => { const seconds = Math.max(0, Math.floor(props.elapsedSeconds)); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` })
const statusColor = computed(() => ({ recording: 'processing', starting: 'processing', error: 'error', forbidden: 'warning', unsupported: 'warning', idle: undefined, stopped: 'default' }[props.samplingState.status]))
watch(() => props.nodeId, () => { live.value = false; allocationSearch.value = ''; moreOpen.value = false; popupFocus.cancel() })
watch(() => props.access.jfrView.allowed, allowed => { if (!allowed) allocationSearch.value = '' })
watch(() => props.active, active => { if (!active) { moreOpen.value = false; popupFocus.cancel() } })
watch(moreOpen, open => { if (!open) popupFocus.cancel() }, { flush: 'sync' })
function changeTab(value: string | number) { moreOpen.value = false; const tab = value as DiagnosticTab; localTab.value = tab; emit('update:activeTab', tab) }
function allowed(action: keyof JvmDiagnosticAccess) { return props.access[action].allowed }
function start() { if (canStart.value && !running.value) emit('start') }
/** 用户显式重试才重开本页订阅；超时提示本身保留结果，不更改服务端采样策略。 */
function retry() { if (allowed('jfr') && allowed('jfrView') && running.value && props.samplingState.delay) { emit('stop'); emit('start') } }
function exportHtml() { if (canExport.value) { moreOpen.value = false; emit('export-html') } }
function captureJfr() { if (canCapture.value) { moreOpen.value = false; emit('capture-jfr') } }
function heapDump() { if (allowed('heapDump') && allowed('heapExport')) emit('heap-dump', { live: live.value }) }
function closeMore() { moreOpen.value = false; popupFocus.cancel(); moreTrigger.value?.$el.focus() }
function focusMore(nodeId = props.nodeId) { popupFocus.focus({ getPopup: () => morePopover.value?.getPopupDomNode?.(), getTarget: popup => popup.querySelector<HTMLElement>('[tabindex="0"],button:not([disabled])') ?? undefined, isActive: () => moreOpen.value && props.active && nodeId === props.nodeId }) }
function onMoreOpen(open: boolean) { moreOpen.value = open; if (open) focusMore(); else popupFocus.cancel() }
function onMoreTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closeMore(); return }
  if (event.key === 'ArrowDown') { event.preventDefault(); if (!moreOpen.value) void onMoreOpen(true); else focusMore(); return }
  if (event.key === 'Tab' && moreOpen.value && !event.shiftKey) { event.preventDefault(); focusMore() }
}
onDeactivated(() => { moreOpen.value = false; popupFocus.cancel() })
onBeforeUnmount(() => { moreOpen.value = false; popupFocus.cancel() })
</script>
<style scoped>
.jvm-panel { display:flex; flex:1 1 0; flex-direction:column; min-width:0; min-height:0; }
.jvm-panel > :deep(.ant-tabs) { margin-bottom:0; }
.jvm-tab-extra,.jvm-tab-actions { display:flex; align-items:center; gap:var(--space-1,4px); min-width:0; }
.jvm-tab-actions { white-space:nowrap; }
.jvm-message { margin-bottom:var(--space-2,8px); }
.jvm-sampling-feedback { display:flex; align-items:center; flex-wrap:wrap; gap:4px 16px; margin-bottom:8px; color:var(--ink-2); font-size:12px; font-variant-numeric:tabular-nums; }
.jvm-sampling-delay { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 8px; margin-bottom:8px; color:var(--warning); font-size:12px; }
.jvm-sampling-delay > .ant-btn { padding:0; height:auto; font-size:inherit; }
.jvm-sample-hint { max-width:360px; }
.jvm-more-actions { display:flex; flex-direction:column; gap:4px; min-width:150px; }
.jvm-sampling-empty { display:flex; flex:1 1 0; min-height:220px; flex-direction:column; align-items:center; justify-content:center; gap:12px; text-align:center; }.jvm-sampling-empty :deep(.ant-btn-lg) { min-width:160px; }.jvm-sampling-empty p { margin:0; color:var(--ink-3); font-size:12px; }.jvm-sampling-empty .jvm-sampling-feedback { justify-content:center; margin:0; }
.jvm-heap { border:1px solid var(--line); border-radius:var(--r-2,6px); padding:var(--space-3,12px); margin-top:var(--space-3,12px); display:flex; justify-content:space-between; gap:var(--space-3,12px); flex-wrap:wrap; }
.jvm-heap p { margin:var(--space-1,4px) 0 0; color:var(--ink-3); font-size:var(--fs-12,12px); }
</style>
