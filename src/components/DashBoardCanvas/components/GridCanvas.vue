<template>
  <div ref="host" class="dashboard-grid" :class="{ 'dashboard-grid--initializing': !layoutReady }" @dragover="drag.onDragOver" @drop="drag.onDrop">
    <GridLayout ref="layoutRef" v-model:layout="layoutJSON" :col-num="settings.columns"
      :row-height="settings.rowHeight" :margin="settings.margin" :style="gridLayoutStyle"
      :is-draggable="layoutEditable" :is-resizable="layoutEditable" @layout-ready="finishInitialLayout">
      <GridItem v-for="item in layoutJSON" :key="item.i" ref="gridItemRefs"
        v-bind="item" :static="item.static || (!editable && !layoutEditable)"
        :is-draggable="layoutEditable && !item.static" :is-resizable="layoutEditable && !item.static"
        :drag-option="{ allowFrom: '.drag-handle', ignoreFrom: '.no-drag' }"
        @moved="onLayoutEnd" @resized="onLayoutEnd"
        @move="$emit('interaction', true)" @resize="$emit('interaction', true)">
        <slot v-if="item.i !== drag.placeholderId" :id="item.i" />
      </GridItem>
    </GridLayout>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, ref, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { GridItem, GridLayout } from 'vue3-grid-layout-next'
import 'vue3-grid-layout-next/dist/style.css'
import { toGridLayout } from '../utils/layout'
import { useDashboardDrag } from '../composables/useDashboardDrag'
import { useDashboardPlaceholder } from '../composables/useDashboardPlaceholder'
import type { DashboardGridItem, DashboardGridSettings, DashboardLayoutItem, DashboardWidget } from '../types'

const props = defineProps<{
  widgets: DashboardWidget[]
  settings: DashboardGridSettings
  editable: boolean
  layoutEditable: boolean
  dragging?: { type: string; gridItem?: Partial<DashboardGridItem> }
}>()
const emit = defineEmits<{
  change: [layout: DashboardLayoutItem[]]
  drop: [type: string, position: { x: number; y: number }, layout: DashboardLayoutItem[]]
  interaction: [dragging: boolean]
  'drag-end': []
}>()
const host = ref<HTMLElement>()
const layoutRef = ref<InstanceType<typeof GridLayout>>()
const gridItemRefs = ref<InstanceType<typeof GridItem>[]>([])
const layoutJSON = ref<DashboardLayoutItem[]>([])
useDashboardPlaceholder(layoutRef, layoutJSON)
const layoutReady = ref(false)

// 子组件读取尺寸可能提前计算默认布局；首次定位完成前不从该布局做位移动画。
function finishInitialLayout() {
  (layoutRef.value?.$el as HTMLElement | undefined)?.getBoundingClientRect()
  layoutReady.value = true
}

// 容器滚动条或侧栏变化未必触发 window.resize，补齐网格公开宽度状态的同步。
// 使用观察器给出的尺寸，不重建网格、业务组件或个人坐标。
useResizeObserver(computed(() => layoutRef.value?.$el as HTMLElement | undefined), ([entry]) => {
  if (!entry) return
  updateWidth(Math.round(entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width))
}, { box: 'border-box' })
function updateWidth(width: number) {
  const layout = layoutRef.value
  if (layout && width > 0 && layout.width !== width) layout.width = width
}
// GridLayout 自身会记录隐藏时的零宽度；缓存页恢复时在绘制前同步，避免从零宽度过渡。
onActivated(() => updateWidth((layoutRef.value?.$el as HTMLElement | undefined)?.offsetWidth ?? 0))

// Retain LoadingBoard's negative margins: the first/last cells align with the viewport edges.
const gridLayoutStyle = computed(() => ({
  marginLeft: `-${props.settings.margin[0]}px`,
  marginRight: `-${props.settings.margin[0]}px`,
  marginTop: `-${props.settings.margin[1]}px`,
  marginBottom: `-${props.settings.margin[1]}px`,
}))
const drag = useDashboardDrag({
  host, layoutRef, gridItemRefs, layout: layoutJSON,
  settings: () => props.settings,
  dragging: () => props.dragging,
  editable: () => props.editable,
  onDrop: (type, position, layout) => emit('drop', type, position, layout),
  onEnd: () => emit('drag-end'),
})

watch(() => [props.widgets, props.settings] as const, () => {
  // An incoming configuration supersedes the current drag preview and its rollback snapshot.
  drag.cancel()
  layoutJSON.value = toGridLayout(props.widgets, props.settings.columns)
}, { immediate: true, deep: true })

async function onLayoutEnd() {
  emit('interaction', false)
  // The grid emits moved/resized before its final collision/compaction update has completed.
  await nextTick()
  if (props.layoutEditable) emit('change', drag.getCommittedLayout())
}
</script>

<style scoped lang="less">
.dashboard-grid { position: relative; width: 100%; min-height: 100%; }
.dashboard-grid--initializing :deep(.vue-grid-item) { transition:none; }
:deep(.vue-grid-item) {
  &.resizing { opacity: .9; }
  .vue-resizable-handle {
    position: absolute;
    width: 20px;
    height: 20px;
    bottom: 2px;
    right: 2px;
    z-index: 10;
    cursor: se-resize;
    opacity: 0;
    transition: opacity .2s ease;
    background: none;

    &::after {
      content: '';
      position: absolute;
      right: 5px;
      bottom: 5px;
      width: 8px;
      height: 8px;
      border-right: 2px solid #bfbfbf;
      border-bottom: 2px solid #bfbfbf;
      transition: border-color .2s ease;
    }

    &:hover::after,
    &.resizing::after {
      border-color: var(--ant-primary-color, #1677ff);
    }
  }
  &:hover .vue-resizable-handle, &.resizing .vue-resizable-handle { opacity: 1; }
}
:deep(.vue-grid-item.vue-draggable-dragging),
:deep(.vue-grid-item.resizing) {
  border-radius: var(--r-3, 8px) !important;
  clip-path: inset(0 round var(--r-3, 8px));
  overflow: hidden;
}
/* 透明占位仅用阴影标出落点；不裁切自身阴影，也不覆盖卡片内容。 */
:deep(.vue-grid-item.vue-grid-placeholder) {
  box-sizing: border-box;
  border-radius: var(--r-3, 8px);
  background: transparent;
  box-shadow: var(--shadow-lifted, 0 .375rem 1.25rem rgb(0 0 0 / 6%));
  z-index: var(--dashboard-placeholder-z-index, 4);
  opacity: 1;
  pointer-events: none;
}
:deep(.vue-grid-item.vue-draggable-dragging) {
  cursor: grabbing;
}
</style>
