<template>
  <div ref="host" class="dashboard-grid" @dragover="drag.onDragOver" @drop="drag.onDrop">
    <GridLayout ref="layoutRef" v-model:layout="layoutJSON" :col-num="settings.columns"
      :row-height="settings.rowHeight" :margin="settings.margin" :style="gridLayoutStyle"
      :is-draggable="editable" :is-resizable="editable">
      <GridItem v-for="item in layoutJSON" :key="item.i" ref="gridItemRefs"
        v-bind="item" :static="item.static || !editable"
        :is-draggable="editable && !item.static" :is-resizable="editable && !item.static"
        :drag-option="{ allowFrom: '.drag-handle', ignoreFrom: '.no-drag' }"
        @moved="onLayoutEnd" @resized="onLayoutEnd"
        @move="$emit('interaction', true)" @resize="$emit('interaction', true)">
        <slot v-if="item.i !== drag.placeholderId" :id="item.i" />
      </GridItem>
    </GridLayout>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { GridItem, GridLayout } from 'vue3-grid-layout-next'
import 'vue3-grid-layout-next/dist/style.css'
import { toGridLayout } from '../utils/layout'
import { useDashboardDrag } from '../composables/useDashboardDrag'
import type { DashboardGridItem, DashboardGridSettings, DashboardLayoutItem, DashboardWidget } from '../types'

const props = defineProps<{
  widgets: DashboardWidget[]
  settings: DashboardGridSettings
  editable: boolean
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
  if (props.editable) emit('change', drag.getCommittedLayout())
}
</script>

<style scoped lang="less">
.dashboard-grid { position: relative; width: 100%; min-height: 100%; }
:deep(.vue-grid-item) {
  &.resizing { opacity: .9; }
  .vue-resizable-handle { opacity: 0; transition: opacity .25s; }
  &:hover .vue-resizable-handle, &.resizing .vue-resizable-handle { opacity: 1; }
}
:deep(.vue-grid-item.vue-grid-placeholder) { background: var(--accent-soft); }
</style>
