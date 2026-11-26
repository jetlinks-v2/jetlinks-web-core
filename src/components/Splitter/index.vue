<template>
  <div ref="rootRef" class="splitter" :data-flush="gutter === 0 || undefined" :class="{ 'splitter--vertical': orientation === 'vertical', 'splitter--collapsed': isCollapsed, 'splitter--motion': collapseMotion, 'splitter--collapse-preview': collapsePreview, 'splitter--restore-preview': restorePreview, 'splitter--restoring': restoreSize !== undefined }" :style="tracks" @transitionend="finishMotion">
    <div :id="startId" ref="startRef" class="splitter__pane splitter__pane--start"
      :inert="startHidden ? true : undefined" :aria-hidden="startHidden ? true : undefined">
      <div class="splitter__content" :style="contentStyle"><slot name="start" /></div>
    </div>
    <PanelResizeHandle v-if="resizable && (!isCollapsed || collapseOnDrag) && !measuring && containerSize > endMin" ref="handleRef" side="left"
      :model-value="restoreSize ?? (isCollapsed ? 0 : handleSize)" :orientation="orientation" :limits="handleLimits" :collapsed="isCollapsed"
      :aria-label="isCollapsed ? t('components.Splitter.dragToExpand') : resizeLabel" :aria-controls="startId" :inert="collapseMotion || undefined" :aria-valuetext="previewLabel"
      @update:model-value="resize" @drag="drag" @expand="setCollapsed(false)" />
    <span v-if="dragPreview" class="splitter__collapse-announcement" role="status">{{ previewLabel }}</span>
    <div class="splitter__collapse-shadow" aria-hidden="true" />
    <div ref="endRef" class="splitter__pane splitter__pane--end" tabindex="-1">
      <slot name="end" :collapsed="isCollapsed" :toggle="toggleCollapse" :start-id="startId" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type CSSProperties } from 'vue'
import { useElementSize, useMediaQuery } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import PanelResizeHandle from '../PanelResizeHandle/index.vue'
import type { PanelResizeDragEvent } from '../PanelResizeHandle/types'
import { providePaneRows } from '../SplitterPane/usePaneRows'

defineOptions({ name: 'Splitter' })
const props = withDefaults(defineProps<{
  /** horizontal 为左右分区，vertical 为上下分区。 */
  orientation?: 'horizontal' | 'vertical'
  /** 起始面板的受控尺寸，单位 px。 */
  size?: number
  /** 未调整时的 CSS 长度或百分比；数字按 px 处理。 */
  defaultSize?: number | string
  min?: number
  max?: number
  endMin?: number
  /** 面板之间的布局留缝；0 用于连续结构线，拖拽命中区域仍为 12px。 */
  gutter?: number
  resizable?: boolean
  collapseOnDrag?: boolean
  collapsed?: boolean
  resizeLabel?: string
}>(), {
  orientation: 'horizontal', defaultSize: '30%', min: 0, max: Infinity, endMin: 0, gutter: 0,
  resizable: true, collapsed: undefined, collapseOnDrag: false,
})
const emit = defineEmits<{
  (event: 'update:size', size: number): void
  (event: 'resize', size: number): void
  (event: 'update:collapsed', collapsed: boolean): void
}>()
const startId = `splitter-pane-${useId()}`
const { t } = useI18n()
const dragPreview = ref(false)
const restoreSize = ref<number>()
const collapseMotion = ref(false)
const motionExtent = ref(0)
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const contentStyle = computed<CSSProperties>(() => {
  const extent = restoreSize.value === undefined ? motionExtent.value : Math.max(limits.value.min, restoreSize.value)
  return !collapseMotion.value && restoreSize.value === undefined ? {} : props.orientation === 'vertical'
    ? { height: `${extent}px` } : { width: `${extent}px` }
})
const rootRef = ref<HTMLElement>()
const startRef = ref<HTMLElement>()
const endRef = ref<HTMLElement>()
const handleRef = ref<InstanceType<typeof PanelResizeHandle>>()
const localSize = ref<number>()
const initialSize = ref(props.size)
const measuring = ref(false)
const localCollapsed = ref(props.collapsed ?? false)
const isCollapsed = computed(() => props.collapsed ?? localCollapsed.value)
const collapsePreview = computed(() => dragPreview.value && !isCollapsed.value)
const restorePreview = computed(() => dragPreview.value && isCollapsed.value)
const previewLabel = computed(() => dragPreview.value
  ? t(isCollapsed.value ? 'components.Splitter.releaseToExpand' : 'components.Splitter.releaseToCollapse') : undefined)
const currentSize = computed(() => props.size ?? localSize.value)
const { width, height } = useElementSize(startRef, { width: 0, height: 0 }, { box: 'border-box' })
const { width: containerWidth, height: containerHeight } = useElementSize(rootRef)
const measuredSize = computed(() => props.orientation === 'vertical' ? height.value : width.value)
const containerSize = computed(() => props.orientation === 'vertical' ? containerHeight.value : containerWidth.value)
const gutterSize = computed(() => props.resizable ? Math.min(Math.max(0, props.gutter), Math.max(0, containerSize.value - props.endMin)) : 0)
const startHidden = computed(() => isCollapsed.value || collapseMotion.value || (containerSize.value > 0 && measuredSize.value === 0))
providePaneRows(() => props.orientation === 'horizontal' && !startHidden.value)
const limits = computed(() => {
  const available = Math.max(0, containerSize.value - props.endMin - gutterSize.value)
  const min = Math.min(props.min, available)
  return { min, max: Math.max(min, Math.min(props.max, available)), contentMin: props.endMin, initial: initialSize.value }
})
// Temporary layout constraints change the visible size, not the remembered user preference.
const handleSize = computed(() => Math.max(limits.value.min,
  Math.min(limits.value.max, currentSize.value ?? initialSize.value ?? measuredSize.value)))
const handleLimits = computed(() => isCollapsed.value ? { ...limits.value, min: 0 } : limits.value)
const tracks = computed<CSSProperties>(() => {
  const value = currentSize.value ?? props.defaultSize
  const requested = typeof value === 'number' ? `${value}px` : value
  const max = Number.isFinite(props.max) ? `${props.max}px` : '100%'
  const start = restoreSize.value !== undefined ? `${restoreSize.value}px` : isCollapsed.value ? '0px'
    : `min(clamp(${props.min}px, ${requested}, ${max}), max(0px, calc(100% - ${props.endMin}px - ${gutterSize.value}px)))`
  const track = `minmax(0, ${start}) ${gutterSize.value}px minmax(0, 1fr)`
  return props.orientation === 'vertical'
    ? { gridTemplateRows: track, gridTemplateColumns: 'minmax(0, 1fr)' }
    : { gridTemplateColumns: track, gridTemplateRows: 'minmax(0, 1fr)' }
})
watch(measuredSize, value => {
  if (currentSize.value === undefined && !isCollapsed.value && !collapseMotion.value && !measuring.value && value > 0) initialSize.value = value
}, { immediate: true })
watch([() => props.defaultSize, () => props.orientation], () => {
  collapseMotion.value = false
  localSize.value = undefined
  initialSize.value = props.size
  void measureInitial()
})
let motionFocus: HTMLElement | undefined
watch(isCollapsed, collapsed => {
  // 固定过渡期间的内容尺寸，避免文字在收缩过程中反复重排。
  const target = collapsed ? 0 : Math.max(limits.value.min, Math.min(limits.value.max, handleSize.value))
  motionExtent.value = collapsed ? measuredSize.value : target
  collapseMotion.value = !reducedMotion.value && containerSize.value > 0 && Math.abs(measuredSize.value - target) > 0.5
  const active = rootRef.value?.ownerDocument.activeElement
  motionFocus = collapseMotion.value && active && (handleRef.value?.$el as HTMLElement | undefined)?.contains(active)
    ? active as HTMLElement : undefined
  if (!collapsed && currentSize.value === undefined && !collapseMotion.value) void measureInitial(false)
})
function finishMotion(event: TransitionEvent) {
  if (event.target !== rootRef.value || !['grid-template-columns', 'grid-template-rows'].includes(event.propertyName)) return
  collapseMotion.value = false
  restoreMotionFocus()
  if (!isCollapsed.value && currentSize.value === undefined) void measureInitial(false)
}
function restoreMotionFocus() {
  const target = motionFocus
  motionFocus = undefined
  if (!target) return
  void nextTick(() => {
    const document = rootRef.value?.ownerDocument
    if (target.isConnected && document?.activeElement === document?.body) target.focus({ preventScroll: true })
  })
}
watch(reducedMotion, reduce => {
  if (reduce) { collapseMotion.value = false; restoreMotionFocus() }
})
async function measureInitial(pauseHandle = true) {
  if (isCollapsed.value) return
  // CSS 轨道切换后重新测量，避免用上一方向的尺寸触发边界回写。
  measuring.value = pauseHandle
  await nextTick()
  const rect = startRef.value?.getBoundingClientRect()
  initialSize.value = props.size ?? (props.orientation === 'vertical' ? rect?.height : rect?.width)
  measuring.value = false
}
watch(() => props.collapsed, value => { if (value !== undefined) localCollapsed.value = value })
watch([startHidden, isCollapsed, () => props.resizable], () => {
  const active = rootRef.value?.ownerDocument.activeElement
  const handle = handleRef.value?.$el as HTMLElement | undefined
  if (active && ((startHidden.value && startRef.value?.contains(active)) ||
    ((isCollapsed.value || !props.resizable) && handle?.contains(active)))) {
    void nextTick(() => endRef.value?.focus({ preventScroll: true }))
  }
})
function resize(size: number) {
  if (restoreSize.value !== undefined) {
    restoreSize.value = size
    return
  }
  const opening = isCollapsed.value
  if (opening && size <= 0) return
  const next = opening ? Math.max(limits.value.min, Math.min(limits.value.max, size)) : size
  motionFocus = undefined
  collapseMotion.value = false
  if (props.size === undefined) localSize.value = next
  emit('update:size', next)
  emit('resize', next)
  if (opening) setCollapsed(false)
}
function toggleCollapse() {
  setCollapsed(!isCollapsed.value)
}
function setCollapsed(next: boolean) {
  if (props.collapsed === undefined) localCollapsed.value = next
  emit('update:collapsed', next)
}
function updateDragPreview(requestedSize: number) {
  const remaining = isCollapsed.value ? limits.value.min - requestedSize : requestedSize
  dragPreview.value = remaining < limits.value.min * (dragPreview.value ? 0.6 : 0.5)
}
function drag(event: PanelResizeDragEvent) {
  if (event.phase === 'start') {
    collapseMotion.value = false
    dragPreview.value = false
    if (isCollapsed.value) restoreSize.value = 0
    return
  }
  if (restoreSize.value !== undefined) {
    if (event.phase === 'move') { updateDragPreview(event.requestedSize); return }
    const size = restoreSize.value
    const opening = event.phase === 'end' && dragPreview.value && size > 0
    dragPreview.value = false
    restoreSize.value = undefined
    if (opening) resize(size)
    return
  }
  if (event.phase === 'move') {
    if (!props.collapseOnDrag) return
    updateDragPreview(event.requestedSize)
    return
  }
  const collapse = event.phase === 'end' && props.collapseOnDrag && collapsePreview.value
  dragPreview.value = false
  if (collapse) {
    if (handleSize.value !== event.initialSize) resize(event.initialSize)
    setCollapsed(true)
  }
}
watch(() => props.collapseOnDrag, enabled => { if (!enabled) dragPreview.value = false })
</script>

<style scoped>
.splitter { --splitter-edge-shadow:color-mix(in srgb,var(--ink,var(--jet-theme-text)) 16%,transparent); position:relative; display:grid; width:100%; height:100%; min-width:0; min-height:0; overflow:hidden; }
.splitter__pane { min-width:0; min-height:0; overflow:auto; }
.splitter__pane--start { grid-area:1 / 1 / 2 / 2; }
.splitter__pane--end { grid-area:1 / 3 / 2 / 4; }
.splitter--vertical > .splitter__pane--end { grid-area:3 / 1 / 4 / 2; }
.splitter__content { width:100%; height:100%; min-width:0; min-height:0 }
.splitter--motion { transition:grid-template-columns var(--motion-duration-fast,0.15s) var(--motion-ease-standard,ease),grid-template-rows var(--motion-duration-fast,0.15s) var(--motion-ease-standard,ease) }
.splitter--motion > .splitter__pane--start,.splitter--collapsed > .splitter__pane--start { overflow:hidden }
.splitter__collapse-announcement { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0 }
.splitter__collapse-shadow { grid-area:1 / 1 / 2 / 2; justify-self:end; width:6px; max-width:100%; max-height:100%; min-width:0; min-height:0; z-index:1; pointer-events:none; visibility:hidden; opacity:0; box-shadow:inset -4px 0 4px -4px var(--splitter-edge-shadow); mask-image:linear-gradient(to bottom,transparent,#000 18%,#000 82%,transparent); transition:opacity var(--motion-duration-fast,0.15s) var(--motion-ease-standard,ease) }
.splitter--collapse-preview > .splitter__collapse-shadow,.splitter--restore-preview > .splitter__collapse-shadow { visibility:visible; opacity:1 }
.splitter--vertical > .splitter__collapse-shadow { align-self:end; justify-self:stretch; width:auto; height:6px; box-shadow:inset 0 -4px 4px -4px var(--splitter-edge-shadow); mask-image:linear-gradient(to right,transparent,#000 18%,#000 82%,transparent) }
.splitter--collapsed > .splitter__collapse-shadow { grid-area:1 / 3 / 2 / 4; justify-self:start; box-shadow:inset 4px 0 4px -4px var(--splitter-edge-shadow) }
.splitter--collapsed.splitter--vertical > .splitter__collapse-shadow { grid-area:3 / 1 / 4 / 2; align-self:start; justify-self:stretch; box-shadow:inset 0 4px 4px -4px var(--splitter-edge-shadow) }
.splitter > .panel-resize-handle { width:100%; margin-left:0 }
.splitter--vertical > .panel-resize-handle { height:100%; margin-top:0 }
.splitter[data-flush] > .panel-resize-handle { width:12px; justify-self:center }
.splitter[data-flush].splitter--collapsed > .panel-resize-handle { justify-self:start }
.splitter[data-flush].splitter--vertical > .panel-resize-handle { width:100%; height:12px; align-self:center }
.splitter[data-flush].splitter--collapsed.splitter--vertical > .panel-resize-handle { align-self:start }
@media(prefers-reduced-motion:reduce) { .splitter--motion,.splitter__collapse-shadow { transition:none } }
</style>
