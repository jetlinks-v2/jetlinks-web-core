<template>
  <div ref="rootRef" class="splitter" :class="{ 'splitter--vertical': orientation === 'vertical' }" :style="tracks">
    <div v-show="!isCollapsed" :id="startId" ref="startRef" class="splitter__pane splitter__pane--start"
      :inert="startHidden ? true : undefined" :aria-hidden="startHidden ? true : undefined">
      <slot name="start" />
    </div>
    <PanelResizeHandle v-if="resizable && !isCollapsed && !measuring && containerSize > 0" ref="handleRef" side="left"
      :model-value="handleSize" :orientation="orientation" :limits="limits"
      :aria-label="resizeLabel" :aria-controls="startId" @update:model-value="resize" />
    <div ref="endRef" class="splitter__pane splitter__pane--end" tabindex="-1">
      <slot name="end" :collapsed="isCollapsed" :toggle="toggleCollapse" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type CSSProperties } from 'vue'
import { useElementSize } from '@vueuse/core'
import PanelResizeHandle from '../PanelResizeHandle/index.vue'

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
  collapsed?: boolean
  resizeLabel?: string
}>(), {
  orientation: 'horizontal', defaultSize: '30%', min: 0, max: Infinity, endMin: 0,
  resizable: true, collapsed: undefined,
})
const emit = defineEmits<{
  (event: 'update:size', size: number): void
  (event: 'resize', size: number): void
  (event: 'update:collapsed', collapsed: boolean): void
}>()
const startId = `splitter-pane-${useId()}`
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
const startHidden = computed(() => isCollapsed.value || (containerSize.value > 0 && measuredSize.value === 0))
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
  if (currentSize.value === undefined && !isCollapsed.value && !measuring.value && value > 0) initialSize.value = value
}, { immediate: true })
watch([() => props.defaultSize, () => props.orientation], () => {
  localSize.value = undefined
  initialSize.value = props.size
  void measureInitial()
})
watch(isCollapsed, collapsed => {
  if (!collapsed && currentSize.value === undefined) void measureInitial()
})
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
watch([startHidden, () => props.resizable], () => {
  const active = rootRef.value?.ownerDocument.activeElement
  const handle = handleRef.value?.$el as HTMLElement | undefined
  if (active && ((startHidden.value && startRef.value?.contains(active)) ||
    ((isCollapsed.value || !props.resizable) && handle?.contains(active)))) {
    void nextTick(() => endRef.value?.focus({ preventScroll: true }))
  }
})
function resize(size: number) {
  if (props.size === undefined) localSize.value = size
  emit('update:size', size)
  emit('resize', size)
}
function toggleCollapse() {
  const next = !isCollapsed.value
  if (props.collapsed === undefined) localCollapsed.value = next
  emit('update:collapsed', next)
}
</script>

<style scoped>
.splitter { position:relative; display:grid; width:100%; height:100%; min-width:0; min-height:0; overflow:hidden; }
.splitter__pane { min-width:0; min-height:0; overflow:auto; }
.splitter__pane--start { grid-area:1 / 1 / 2 / 2; }
.splitter__pane--end { grid-area:1 / 3 / 2 / 4; }
.splitter--vertical > .splitter__pane--end { grid-area:3 / 1 / 4 / 2; }
</style>
