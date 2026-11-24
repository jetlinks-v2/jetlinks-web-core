<template>
  <div ref="rootRef" class="splitter" :class="{ 'splitter--vertical': orientation === 'vertical', 'splitter--collapsed': isCollapsed, 'splitter--motion': collapseMotion }" :style="tracks" @transitionend="finishMotion">
    <div :id="startId" ref="startRef" class="splitter__pane splitter__pane--start"
      :inert="startHidden ? true : undefined" :aria-hidden="startHidden ? true : undefined">
      <div class="splitter__content" :style="contentStyle"><slot name="start" /></div>
    </div>
    <PanelResizeHandle v-if="resizable && !isCollapsed && !measuring && containerSize > 0" ref="handleRef" side="left"
      :model-value="handleSize" :orientation="orientation" :limits="limits"
      :aria-label="resizeLabel" :aria-controls="startId" :inert="collapseMotion || undefined" :aria-valuetext="collapsePreview ? t('components.Splitter.releaseToCollapse') : undefined"
      @update:model-value="resize" @drag="drag" />
    <span v-if="collapsePreview" class="splitter__collapse-preview" role="status">{{ t('components.Splitter.releaseToCollapse') }}</span>
    <div ref="endRef" class="splitter__pane splitter__pane--end" tabindex="-1">
      <slot name="end" :collapsed="isCollapsed" :toggle="toggleCollapse" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type CSSProperties } from 'vue'
import { useElementSize, useMediaQuery } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import PanelResizeHandle from '../PanelResizeHandle/index.vue'
import type { PanelResizeDragEvent } from '../PanelResizeHandle/types'

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
  resizable?: boolean
  collapseOnDrag?: boolean
  collapsed?: boolean
  resizeLabel?: string
}>(), {
  orientation: 'horizontal', defaultSize: '30%', min: 0, max: Infinity, endMin: 0,
  resizable: true, collapsed: undefined, collapseOnDrag: false,
})
const emit = defineEmits<{
  (event: 'update:size', size: number): void
  (event: 'resize', size: number): void
  (event: 'update:collapsed', collapsed: boolean): void
}>()
const startId = `splitter-pane-${useId()}`
const { t } = useI18n()
const collapsePreview = ref(false)
const collapseMotion = ref(false)
const motionExtent = ref(0)
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const contentStyle = computed<CSSProperties>(() => !collapseMotion.value ? {} : props.orientation === 'vertical'
  ? { height: `${motionExtent.value}px` } : { width: `${motionExtent.value}px` })
const rootRef = ref<HTMLElement>()
const startRef = ref<HTMLElement>()
const endRef = ref<HTMLElement>()
const handleRef = ref<InstanceType<typeof PanelResizeHandle>>()
const localSize = ref<number>()
const initialSize = ref(props.size)
const measuring = ref(false)
const localCollapsed = ref(props.collapsed ?? false)
const isCollapsed = computed(() => props.collapsed ?? localCollapsed.value)
const currentSize = computed(() => props.size ?? localSize.value)
const { width, height } = useElementSize(startRef, { width: 0, height: 0 }, { box: 'border-box' })
const { width: containerWidth, height: containerHeight } = useElementSize(rootRef)
const measuredSize = computed(() => props.orientation === 'vertical' ? height.value : width.value)
const containerSize = computed(() => props.orientation === 'vertical' ? containerHeight.value : containerWidth.value)
const startHidden = computed(() => isCollapsed.value || collapseMotion.value || (containerSize.value > 0 && measuredSize.value === 0))
const limits = computed(() => {
  const available = Math.max(0, containerSize.value - props.endMin)
  const min = Math.min(props.min, available)
  return { min, max: Math.max(min, Math.min(props.max, available)), contentMin: props.endMin, initial: initialSize.value }
})
const handleSize = computed(() => currentSize.value ?? Math.max(limits.value.min,
  Math.min(limits.value.max, initialSize.value ?? measuredSize.value)))
const tracks = computed<CSSProperties>(() => {
  const value = currentSize.value ?? props.defaultSize
  const requested = typeof value === 'number' ? `${value}px` : value
  const max = Number.isFinite(props.max) ? `${props.max}px` : '100%'
  const start = isCollapsed.value ? '0px'
    : `min(clamp(${props.min}px, ${requested}, ${max}), max(0px, calc(100% - ${props.endMin}px)))`
  const track = `minmax(0, ${start}) 0px minmax(0, 1fr)`
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
watch(isCollapsed, collapsed => {
  // 固定过渡期间的内容尺寸，避免文字在收缩过程中反复重排。
  motionExtent.value = collapsed ? measuredSize.value : Math.max(limits.value.min, Math.min(limits.value.max, handleSize.value))
  collapseMotion.value = !reducedMotion.value && motionExtent.value > 0 && containerSize.value > 0
  if (!collapsed && currentSize.value === undefined && !collapseMotion.value) void measureInitial()
})
function finishMotion(event: TransitionEvent) {
  if (event.target !== rootRef.value || !['grid-template-columns', 'grid-template-rows'].includes(event.propertyName)) return
  collapseMotion.value = false
  if (!isCollapsed.value && currentSize.value === undefined) void measureInitial()
}
watch(reducedMotion, reduce => { if (reduce) collapseMotion.value = false })
async function measureInitial() {
  if (isCollapsed.value) return
  // CSS 轨道切换后重新测量，避免用上一方向的尺寸触发边界回写。
  measuring.value = true
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
  collapseMotion.value = false
  if (props.size === undefined) localSize.value = size
  emit('update:size', size)
  emit('resize', size)
}
function toggleCollapse() {
  setCollapsed(!isCollapsed.value)
}
function setCollapsed(next: boolean) {
  if (props.collapsed === undefined) localCollapsed.value = next
  emit('update:collapsed', next)
}
function drag(event: PanelResizeDragEvent) {
  if (event.phase === 'move') {
    if (!props.collapseOnDrag) return
    collapsePreview.value = event.requestedSize < limits.value.min / 2
    return
  }
  const collapse = event.phase === 'end' && props.collapseOnDrag && collapsePreview.value
  collapsePreview.value = false
  if (collapse) {
    if (handleSize.value !== event.initialSize) resize(event.initialSize)
    setCollapsed(true)
  }
}
watch(() => props.collapseOnDrag, enabled => { if (!enabled) collapsePreview.value = false })
</script>

<style scoped>
.splitter { position:relative; display:grid; width:100%; height:100%; min-width:0; min-height:0; overflow:hidden; }
.splitter__pane { min-width:0; min-height:0; overflow:auto; }
.splitter__pane--start { grid-area:1 / 1 / 2 / 2; }
.splitter__pane--end { grid-area:1 / 3 / 2 / 4; }
.splitter--vertical > .splitter__pane--end { grid-area:3 / 1 / 4 / 2; }
.splitter__content { width:100%; height:100%; min-width:0; min-height:0 }
.splitter--motion { transition:grid-template-columns var(--motion-duration-fast,0.15s) var(--motion-ease-standard,ease),grid-template-rows var(--motion-duration-fast,0.15s) var(--motion-ease-standard,ease) }
.splitter--motion > .splitter__pane--start,.splitter--collapsed > .splitter__pane--start { overflow:hidden }
.splitter__collapse-preview { position:absolute; left:var(--space-3,12px); top:50%; transform:translateY(-50%); padding:var(--space-1,4px) var(--space-2,8px); border:1px solid var(--line-2,var(--line)); border-radius:var(--jet-theme-button-r,4px); background:var(--bg,var(--jet-theme-bg-elevated)); color:var(--ink-2,var(--jet-theme-text)); font-size:var(--fs-12,12px); pointer-events:none; z-index:3 }
.splitter--vertical > .splitter__collapse-preview { top:var(--space-3,12px); left:50%; transform:translateX(-50%) }
@media(prefers-reduced-motion:reduce) { .splitter--motion { transition:none } }
</style>
