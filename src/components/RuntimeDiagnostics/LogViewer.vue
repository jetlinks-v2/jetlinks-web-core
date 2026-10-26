<template>
  <div class="log-reader" :class="{ 'log-reader--embedded': embedded }" :style="logColors" @keydown.esc.stop="closeMenus(true)">
    <div class="log-file-toolbar diagnostics-compact-toolbar">
      <slot name="source" />
      <slot name="file-prefix" />
      <template v-if="!isConsole"><slot name="file-selector"><a-select class="log-file-select" size="small" :value="fileId || undefined" :options="files.map(file => ({ value: file.id, label: file.name }))" :title="files.find(file => file.id === fileId)?.name" :disabled="state.status === 'forbidden' || fileBusy" :placeholder="t('runtimeDiagnostics.selectFile')" show-search option-filter-prop="label" @change="selectFile" /></slot>
        <a-tooltip :title="t('runtimeDiagnostics.refresh')"><a-button type="text" size="small" :disabled="!fileId || fileBusy || ['loading', 'forbidden'].includes(state.status)" :aria-label="t('runtimeDiagnostics.refresh')" @click="emit('refresh')"><ReloadOutlined /></a-button></a-tooltip>
      </template><slot v-else name="console-actions" />
        <div class="log-search-toolbar" :class="{ 'log-search-toolbar--matching': findVisible }">
          <a-tooltip :title="t('runtimeDiagnostics.windowSearch')"><a-button type="text" size="small" :disabled="controlsDisabled" :aria-label="t('runtimeDiagnostics.windowSearch')" @click="findOpen = !findOpen"><SearchOutlined /></a-button></a-tooltip>
          <div v-if="findVisible" class="log-find">
            <a-input-search size="small" :value="filter" :disabled="controlsDisabled" :placeholder="t('runtimeDiagnostics.compactWindowSearch')" :title="t('runtimeDiagnostics.windowSearch')" allow-clear @update:value="setFilter" @search="nextMatch(1)" />
            <template v-if="filter.trim() && !controlsDisabled"><span class="log-match-count">{{ t('runtimeDiagnostics.matchingEntries', { count: matches.length }) }}</span>
            <a-space-compact><a-button size="small" :disabled="!matches.length" :title="t('runtimeDiagnostics.previousMatch')" :aria-label="t('runtimeDiagnostics.previousMatch')" @click="nextMatch(-1)"><UpOutlined /></a-button><a-button size="small" :disabled="!matches.length" :title="t('runtimeDiagnostics.nextMatch')" :aria-label="t('runtimeDiagnostics.nextMatch')" @click="nextMatch(1)"><DownOutlined /></a-button></a-space-compact></template>
          </div>
          <div class="log-display-controls">
            <a-popover ref="levelMenuPopover" :open="levelMenuOpen" trigger="click" placement="bottomRight" @open-change="setLevelMenuOpen"><template #content><div tabindex="-1" @keydown.esc.stop="closeMenus(true)"><a-menu :selected-keys="[display.level]" @click="selectLevel"><a-menu-item v-for="level in levels" :key="level.value">{{ level.label }}</a-menu-item></a-menu></div></template><a-button ref="levelMenuTrigger" type="text" size="small" :disabled="controlsDisabled" :aria-label="t('runtimeDiagnostics.logLevel')" :aria-expanded="levelMenuOpen" @keydown.arrow-down.prevent="setLevelMenuOpen(true)" @keydown.tab="focusOpenedLevelMenu($event)">{{ levels.find(level => level.value === display.level)?.label }}<DownOutlined /></a-button></a-popover>
            <a-popover ref="moreMenuPopover" :open="moreMenuOpen" trigger="click" placement="bottomRight" @open-change="setMoreMenuOpen"><template #content><div class="log-more-menu" tabindex="-1" @keydown.esc.stop="closeMenus(true)"><a-checkbox :checked="display.wrap" @change="event => updateConfig({ wrap: event.target.checked })">{{ t('runtimeDiagnostics.wrap') }}</a-checkbox><a-tooltip :title="exportReason" :trigger="['hover', 'focus']"><span v-if="!canDownload" class="log-disabled-action" tabindex="0" :aria-label="exportReason"><a-button v-if="!isConsole" type="text" block disabled><DownloadOutlined />{{ t('runtimeDiagnostics.export') }}</a-button></span><a-button v-else-if="!isConsole" type="text" block @click="download"><DownloadOutlined />{{ t('runtimeDiagnostics.export') }}</a-button></a-tooltip></div></template><a-button ref="moreMenuTrigger" type="text" size="small" :disabled="controlsDisabled" :title="t('runtimeDiagnostics.logMoreOptions')" :aria-label="t('runtimeDiagnostics.logMoreOptions')" :aria-expanded="moreMenuOpen" @keydown.arrow-down.prevent="setMoreMenuOpen(true)" @keydown.tab="focusOpenedMoreMenu($event)"><MoreOutlined /></a-button></a-popover>
          </div>
        </div>
    </div>
    <div class="log-reader-state">
    <DiagnosticsState :state="state" @retry="emit('refresh')">
      <div class="log-reader-window">
        <div v-if="truncated" class="log-window-notice">{{ t(isConsole ? 'runtimeDiagnostics.consoleBoundedLogs' : 'runtimeDiagnostics.boundedLogs') }}</div>
        <div ref="scroller" class="log-stream" role="log" aria-live="off" :aria-label="t('runtimeDiagnostics.logs')" @scroll="onScroll" @pointerdown="readIntent" @wheel.passive="readIntent" @keydown="readIntent">
          <div v-if="hasPrevious" class="log-load-edge"><a-button type="text" size="small" :loading="loadingDirection === 'backward'" @click="page('previous')">{{ t('runtimeDiagnostics.loadEarlier') }}</a-button></div>
          <div v-for="(item, index) in visible" :key="item.id" :data-log-id="item.id" class="log-row" :class="{ 'log-active-match': item.id === activeMatch }">
            <span class="log-row-number" aria-hidden="true" :title="t('runtimeDiagnostics.windowRow', { number: index + 1 })">{{ index + 1 }}</span>
            <LogEntryLine :entry="item" :query="filter.trim()" :wrap="display.wrap" :expanded="detailId === item.id" :active-match="activeMatch === item.id" :trace-access="traceAccess" @inspect="inspect(item.id)" @reading="pause" @trace="openTrace" />
          </div>
          <a-empty v-if="!visible.length" :description="emptyText" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
          <div v-if="hasNext" class="log-load-edge"><a-button type="text" size="small" :loading="loadingDirection === 'forward'" @click="page('next')">{{ t('runtimeDiagnostics.loadLater') }}</a-button></div>
        </div>
        <div class="log-window-toolbar">
          <span>{{ t('runtimeDiagnostics.loadedEntries', { count: entries.length }) }}</span>
          <span v-if="!isConsole && loading" class="log-update-state"><LoadingOutlined />{{ t('runtimeDiagnostics.updating') }}</span>
          <span v-if="!isConsole && updatedTime" class="log-update-state">{{ t('runtimeDiagnostics.updatedAt', { time: updatedTime }) }}</span>
          <a-button v-if="isConsole" class="log-follow-action" type="text" size="small" :disabled="controlsDisabled" @click="following ? pause() : resume()"><PauseOutlined v-if="following" /><SyncOutlined v-else />{{ t(following ? 'runtimeDiagnostics.consoleAutoScroll' : 'runtimeDiagnostics.consoleResumeScroll') }}</a-button>
          <a-button v-else-if="followAccess.allowed" class="log-follow-action" type="text" size="small" :disabled="!fileId || controlsDisabled || fileBusy" @click="following ? pause() : resume()"><PauseOutlined v-if="following" /><SyncOutlined v-else />{{ t(following ? 'runtimeDiagnostics.pauseUpdate' : 'runtimeDiagnostics.continuousUpdate') }}</a-button>
        </div>
      </div>
    </DiagnosticsState>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, watch, type PropType } from 'vue'
import { DownOutlined, DownloadOutlined, LoadingOutlined, MoreOutlined, PauseOutlined, ReloadOutlined, SearchOutlined, SyncOutlined, UpOutlined } from '@ant-design/icons-vue'
import { Empty, theme } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import DiagnosticsState from './DiagnosticsState.vue'
import LogEntryLine from './logs/LogEntryLine.vue'
import { logPresentation, nextLogMatchId } from './logs/presentation'
import { createVisiblePopupFocus } from './popupFocus'
import type { LogDisplayConfig, LogEntry, LogFile, ViewState, ActionAccess } from './types'
import { useRetainedScroll } from '../../hooks/useRetainedScroll'
defineSlots<{ 'file-prefix'?(): unknown; 'file-selector'?(): unknown; source?(): unknown; 'console-actions'?(): unknown }>()
const props = defineProps({
  entries: { type: Array as PropType<LogEntry[]>, default: () => [] }, files: { type: Array as PropType<LogFile[]>, default: () => [] },
  fileId: { type: String, default: '' }, filter: { type: String, default: '' }, following: { type: Boolean, default: false }, config: { type: Object as PropType<LogDisplayConfig>, default: undefined },
  state: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) },
  active: { type: Boolean, default: true },
  embedded: { type: Boolean, default: false }, fileBusy: { type: Boolean, default: false },
  isConsole: { type: Boolean, default: false }, emptyDescription: { type: String, default: '' }, loadingDirection: { type: String, default: '' }, loading: { type: Boolean, default: false }, updatedAt: { type: [String, Number], default: '' },
  exportAccess: { type: Object as PropType<ActionAccess>, default: () => ({ allowed: false }) }, traceAccess: { type: Object as PropType<ActionAccess>, default: () => ({ allowed: false }) },
  followAccess: { type: Object as PropType<ActionAccess>, default: () => ({ allowed: true }) },
  hasPrevious: { type: Boolean, default: false }, hasNext: { type: Boolean, default: false }, truncated: { type: Boolean, default: false },
})
const emit = defineEmits<{
  (event: 'refresh' | 'export' | 'previous' | 'next'): void; (event: 'file' | 'trace' | 'filter', value: string): void
  (event: 'follow', value: boolean): void; (event: 'update:config', config: LogDisplayConfig): void
}>()
const { t } = useI18n(), { token } = theme.useToken()
const scroller = ref<HTMLDivElement>(), activeMatch = ref(''), detailId = ref(''), findOpen = ref(false), levelMenuOpen = ref(false), moreMenuOpen = ref(false)
const levelMenuTrigger = ref<{ $el?: HTMLElement; focus?: () => void }>(), moreMenuTrigger = ref<{ $el?: HTMLElement; focus?: () => void }>()
type PopoverRef = { getPopupDomNode?: () => HTMLElement | undefined }
const levelMenuPopover = ref<PopoverRef>(), moreMenuPopover = ref<PopoverRef>()
const menuFocus = createVisiblePopupFocus()
let edgeReady = false
const reading = useRetainedScroll(scroller, () => props.active)
const localConfig = ref<LogDisplayConfig>({ level: 'all', wrap: true })
const display = computed(() => props.config ?? localConfig.value)
const logColors = computed(() => ({ '--diagnostic-log-highlight': token.value.colorWarningBg, '--diagnostic-log-selected': token.value.colorPrimaryBg, '--diagnostic-log-error': token.value.colorError, '--diagnostic-log-warning': token.value.colorWarning, '--diagnostic-log-info': token.value.colorSuccess }))
const levels = computed(() => ['all', 'ERROR', 'FATAL', 'WARN', 'INFO', 'DEBUG', 'TRACE'].map(value => ({ value, label: value === 'all' ? t('runtimeDiagnostics.all') : value })))
const controlsDisabled = computed(() => ['forbidden', 'unsupported'].includes(props.state.status))
const visible = computed(() => controlsDisabled.value ? [] : props.entries.filter(entry => display.value.level === 'all' || entry.level === display.value.level))
const emptyText = computed(() => props.entries.length ? t('runtimeDiagnostics.noMatches') : props.emptyDescription || t(!props.fileId ? 'runtimeDiagnostics.selectFile' : 'runtimeDiagnostics.empty'))
const findVisible = computed(() => findOpen.value || !!props.filter.trim())
const matches = computed(() => props.filter.trim() ? visible.value.filter(entry => [entry.text, entry.raw, entry.message, entry.stack, entry.thread, entry.traceId].join(' ').toLowerCase().includes(props.filter.trim().toLowerCase())) : [])
const canDownload = computed(() => props.exportAccess.allowed && !!props.fileId && !props.fileBusy && !['loading', 'forbidden'].includes(props.state.status))
const exportReason = computed(() => {
  if (props.exportAccess.reason) return props.exportAccess.reason
  if (!props.exportAccess.allowed) return t('runtimeDiagnostics.forbidden')
  if (!props.fileId) return t('runtimeDiagnostics.selectFile')
  return props.fileBusy || props.state.status === 'loading' ? t('runtimeDiagnostics.updating') : t('runtimeDiagnostics.export')
})
const updatedTime = computed(() => props.updatedAt ? new Date(props.updatedAt).toLocaleTimeString() : '')
function pause() { if (props.following) emit('follow', false) }
function updateConfig(patch: Partial<LogDisplayConfig>) { pause(); const value = { ...display.value, ...patch }; localConfig.value = value; emit('update:config', value) }
function focusTrigger(trigger: typeof levelMenuTrigger) { trigger.value?.focus?.() ?? trigger.value?.$el?.focus() }
function scheduleMenuFocus(popover: typeof levelMenuPopover, isActive: () => boolean) { menuFocus.focus({ getPopup: () => popover.value?.getPopupDomNode?.(), isActive }) }
function setLevelMenuOpen(open: boolean) { levelMenuOpen.value = open; if (open) scheduleMenuFocus(levelMenuPopover, () => levelMenuOpen.value && props.active); else menuFocus.cancel() }
function setMoreMenuOpen(open: boolean) { moreMenuOpen.value = open; if (open) scheduleMenuFocus(moreMenuPopover, () => moreMenuOpen.value && props.active); else menuFocus.cancel() }
function focusOpenedMenu(open: boolean, popover: typeof levelMenuPopover, isActive: () => boolean, event: KeyboardEvent) { if (open) { event.preventDefault(); scheduleMenuFocus(popover, isActive) } }
function focusOpenedLevelMenu(event: KeyboardEvent) { focusOpenedMenu(levelMenuOpen.value, levelMenuPopover, () => levelMenuOpen.value && props.active, event) }
function focusOpenedMoreMenu(event: KeyboardEvent) { focusOpenedMenu(moreMenuOpen.value, moreMenuPopover, () => moreMenuOpen.value && props.active, event) }
function selectLevel(event: { key: string | number }) { updateConfig({ level: String(event.key) }); levelMenuOpen.value = false }
function setFilter(value: string) { pause(); emit('filter', value) }
function page(direction: 'previous' | 'next') { if (props.loadingDirection) return; pause(); edgeReady = false; emit(direction) }
function selectFile(value: unknown) { if (props.state.status === 'forbidden' || props.fileBusy || typeof value !== 'string' && typeof value !== 'number') return; pause(); emit('file', String(value)) }
function download() { if (canDownload.value) emit('export') }
function closeMenus(returnFocus = false) {
  const levelOpen = levelMenuOpen.value, moreOpen = moreMenuOpen.value
  levelMenuOpen.value = false; moreMenuOpen.value = false
  menuFocus.cancel()
  if (returnFocus) void nextTick(() => { if (levelOpen) focusTrigger(levelMenuTrigger); else if (moreOpen) focusTrigger(moreMenuTrigger) })
}
function inspect(id: string) { pause(); detailId.value = detailId.value === id ? '' : id }
function openTrace(traceId: string) { if (props.traceAccess.allowed && props.state.status !== 'forbidden') { pause(); emit('trace', traceId) } }
function readIntent() { edgeReady = true; pause() }
function onScroll() {
  if (!reading.onScroll()) return
  const element = scroller.value
  if (!element) return
  if (element.scrollHeight - element.scrollTop - element.clientHeight > 36) pause()
  if (!edgeReady || props.isConsole || props.loadingDirection) return
  if (element.scrollTop < 48 && props.hasPrevious) page('previous')
  else if (element.scrollHeight - element.scrollTop - element.clientHeight < 48 && props.hasNext) page('next')
}
function bottom() { if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight }
/** 宿主收到 follow(true) 后加载文件末尾，不把旧窗口底部误认为最新。 */
function resume() { if (props.fileId && props.state.status !== 'forbidden') { detailId.value = ''; if (props.isConsole) bottom(); emit('follow', true) } }
/** 查找按匹配条目循环，保留上下文；只在命中折叠内容时展开相应证据。 */
async function nextMatch(direction: -1 | 1) {
  if (!matches.value.length) return
  pause()
  activeMatch.value = nextLogMatchId(matches.value, activeMatch.value, direction)
  const entry = matches.value.find(item => item.id === activeMatch.value)
  if (entry) {
    const view = logPresentation(entry), query = props.filter.trim().toLowerCase()
    if (![view.message, view.stack].join('\n').toLowerCase().includes(query)) detailId.value = entry.id
  }
  await nextTick()
  const row = Array.from(scroller.value?.querySelectorAll<HTMLElement>('[data-log-id]') ?? []).find(element => element.dataset.logId === activeMatch.value)
  if (row && scroller.value) {
    const top = row.getBoundingClientRect().top - scroller.value.getBoundingClientRect().top + scroller.value.scrollTop
    scroller.value.scrollTop = top
  }
}
watch([() => props.filter, () => display.value.level], () => { activeMatch.value = '' })
watch(() => props.active, active => { if (!active) closeMenus() })
watch(() => props.fileId, () => { activeMatch.value = ''; detailId.value = ''; closeMenus(); reading.reset() })
watch(() => props.state.status, value => { if (value === 'forbidden' || value === 'unsupported') reading.reset() }, { flush: 'sync' })
watch(visible, entries => { if (!entries.some(entry => entry.id === detailId.value)) detailId.value = ''; if (!entries.some(entry => entry.id === activeMatch.value)) activeMatch.value = '' })
onDeactivated(closeMenus)
onBeforeUnmount(closeMenus)
// 只跟随新窗口数据；切换 following 不先滚动仍在屏上的旧窗口。
watch(() => props.entries, async (entries, previous) => {
  if (!reading.visible()) return
  const element = scroller.value
  const rows = Array.from(element?.querySelectorAll?.<HTMLElement>('[data-log-id]') ?? [])
  const anchor = rows.find(row => row.getBoundingClientRect().bottom > element!.getBoundingClientRect().top)
  const id = anchor?.dataset.logId, offset = anchor && element ? anchor.getBoundingClientRect().top - element.getBoundingClientRect().top : 0
  await nextTick()
  if (!reading.visible()) return
  if (props.following || !previous.length && entries.length && !props.isConsole) { bottom(); return }
  const next = id ? Array.from(scroller.value?.querySelectorAll?.<HTMLElement>('[data-log-id]') ?? []).find(row => row.dataset.logId === id) : undefined
  if (next && scroller.value) scroller.value.scrollTop += next.getBoundingClientRect().top - scroller.value.getBoundingClientRect().top - offset
}, { flush: 'pre' })
</script>
<style scoped>
.log-reader { display:flex; flex-direction:column; height:100%; min-width:0; min-height:0; gap:6px; container-type:inline-size; }
.log-file-toolbar { display:flex; align-items:center; flex:none; gap:6px; min-width:0; flex-wrap:wrap; }.log-file-select { flex:1 1 180px; min-width:140px; }.log-file-toolbar :deep(.ant-radio-group) { flex:none; }
.log-reader-state { display:flex; flex:1; min-width:0; min-height:0; }
/* Spin 的 class 用于加载指示器，布局需从自有 DOM 接到真实的 nested-loading/container。 */
.log-reader-state :deep(> .ant-spin-nested-loading),.log-reader-state :deep(> .ant-spin-nested-loading > .ant-spin-container) { display:flex; flex-direction:column; flex:1; min-width:0; min-height:0; }
.log-reader-state :deep(> .ant-spin-nested-loading > .ant-spin-container) { overflow:auto; }
.log-reader-window { display:flex; flex-direction:column; flex:1; border:1px solid var(--line); border-radius:6px; min-width:0; min-height:0; overflow:hidden; }
.log-reader--embedded { gap:0; }.log-reader--embedded .log-reader-window { border:0; border-radius:0; }.log-reader--embedded .log-file-toolbar { padding:6px 8px; min-height:36px; border-bottom:1px solid var(--line); }
.log-search-toolbar { display:flex; flex:2 1 auto; align-items:center; gap:4px; min-width:0; }.log-search-toolbar--matching { flex-basis:390px; min-width:min(100%,280px); }
.log-find { display:flex; align-items:center; gap:6px; flex:1 1 120px; min-width:0; }.log-find :deep(.ant-input-search) { flex:1; min-width:100px; }.log-match-count { color:var(--ink-3); font-size:var(--fs-caption,12px); white-space:nowrap; }
.log-display-controls { display:flex; align-items:center; flex:none; gap:2px; }.log-display-controls :deep(.ant-btn) { display:inline-flex; align-items:center; gap:3px; }.log-more-menu { display:flex; flex-direction:column; gap:4px; min-width:132px; }
.log-stream { flex:1; min-height:0; overflow:auto; background:var(--bg-surface); scrollbar-gutter:stable; }
.log-row { display:flex; align-items:baseline; min-width:0; padding:5px 10px 5px 6px; border-bottom:1px solid var(--line); }
.log-row-number { flex:0 0 32px; text-align:end; padding-inline-end:10px; color:var(--ink-3); font:var(--fs-caption,12px)/var(--lh-relaxed,1.65) var(--font-mono,monospace); user-select:none; }
.log-row:last-child { border-bottom:0; }.log-active-match { background:var(--diagnostic-log-selected); }
.log-stream :deep(.ant-empty) { margin-block:40px; }.log-window-notice { padding:3px 8px; font-size:var(--fs-caption,12px); color:var(--ink-3); border-bottom:1px solid var(--line); }.log-load-edge { text-align:center; color:var(--ink-3); background:var(--bg-sunken); }.log-load-edge > .ant-btn { font-size:var(--fs-caption,12px); color:var(--ink-3); }
.log-window-toolbar { display:flex; flex:none; align-items:center; flex-wrap:wrap; gap:6px 10px; padding:6px 8px; border-top:1px solid var(--line); color:var(--ink-3); font-size:var(--fs-caption,12px); }.log-update-state { display:inline-flex; align-items:center; gap:4px; }.log-follow-status,.log-follow-action { margin-inline-start:auto; }.log-follow-action { display:inline-flex; align-items:center; gap:4px; }
@container(max-width:460px) { .log-search-toolbar { flex-basis:100%; flex-wrap:wrap; }.log-find { flex-basis:150px; }.log-display-controls { margin-inline-start:auto; }.log-row { padding-inline:8px; }.log-row-number { display:none; }.log-follow-status { margin-inline-start:0; } }
@container(max-width:320px) { .log-find { flex-wrap:wrap; }.log-find :deep(.ant-input-search) { flex-basis:100%; min-width:0; } }
</style>
