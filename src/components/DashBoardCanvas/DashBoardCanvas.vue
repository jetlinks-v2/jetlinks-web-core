<template>
  <div class="dashboard-card-layout">
    <div class="dashboard-card-content" :style="surfaceStyle">
      <GridCanvas :widgets="state.value.value.components" :settings="state.gridSettings.value"
        :editable="editable" :layout-editable="layoutEditable" :dragging="dragging"
        @change="state.updateLayout" @drop="onDrop"
        @interaction="isDrawerDragging = $event" @drag-end="endDrag">
        <template #default="{ id }">
          <WidgetFrame v-if="widgetsById[id]" :editable="editable && !widgetsById[id].isLocked"
            :draggable="layoutEditable && !widgetsById[id].isLocked"
            :configurable="Boolean(catalog.components[widgetsById[id].type]?.configs.length)"
            @configure="openWidgetConfig(id)" @remove="state.removeWidget(id)">
            <WidgetRenderer :widget="widgetsById[id]" :definition="catalog.components[widgetsById[id].type]"
              :preview-mode="previewMode" />
          </WidgetFrame>
        </template>
      </GridCanvas>
    </div>

    <div v-if="!visibleCount && !drawerVisible" class="dashboard-empty-state">
      <div class="dashboard-empty-content">
        <AppstoreAddOutlined class="dashboard-empty-icon" />
        <div class="dashboard-empty-desc">{{ t(editable ? 'dashboardCanvas.emptyEditable' : 'dashboardCanvas.empty') }}</div>
        <a-button v-if="editable" type="primary" @click="openDrawer('components')">
          <PlusOutlined />{{ t('dashboardCanvas.addComponent') }}
        </a-button>
      </div>
    </div>

    <div v-if="editable && !drawerVisible" class="dashboard-setting-dock" :class="{ 'is-open': settingMenuVisible }">
      <div class="dashboard-setting-hotspot" aria-hidden="true" />
      <a-dropdown v-model:open="settingMenuVisible" placement="topLeft" :trigger="['click']">
        <button type="button" class="dashboard-setting-trigger" :aria-label="t('dashboardCanvas.canvasSettings')">
          <SettingOutlined />
        </button>
        <template #overlay>
          <a-menu @click="settingMenuVisible = false">
            <a-menu-item key="components" @click="openDrawer('components')">
              <PlusOutlined /> {{ t('dashboardCanvas.addComponent') }}
            </a-menu-item>
            <a-menu-item key="canvas" @click="openDrawer('canvas-config')">
              <LayoutOutlined /> {{ t('dashboardCanvas.canvasSettings') }}
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>

    <UnifiedDrawer :open="drawerVisible && editable" :title="drawerTitle" :dragging="isDrawerDragging" @close="closeDrawer">
      <ComponentPalette v-if="drawerVisible && drawerMode === 'components'" :catalog="catalog"
        @add="state.addWidget" @drag-start="startDrag" @drag-end="endDrag" />
      <ConfigDrawer v-else-if="drawerVisible && drawerMode === 'component-config' && selected && selectedDefinition"
        :key="selected.id" :widget="selected" :definition="selectedDefinition"
        @close="closeDrawer" @apply="applyWidget" />
      <CanvasConfig v-else-if="drawerVisible && drawerMode === 'canvas-config'" :canvas="state.value.value.canvas"
        @close="closeDrawer" @apply="applyCanvas" />
    </UnifiedDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Button as AButton, Dropdown as ADropdown, Menu as AMenu, MenuItem as AMenuItem } from 'ant-design-vue'
import { AppstoreAddOutlined, LayoutOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import GridCanvas from './components/GridCanvas.vue'
import WidgetFrame from './components/WidgetFrame.vue'
import WidgetRenderer from './components/WidgetRenderer.vue'
import ComponentPalette from './components/ComponentPalette.vue'
import ConfigDrawer from './components/ConfigDrawer.vue'
import CanvasConfig from './components/CanvasConfig.vue'
import UnifiedDrawer from './components/UnifiedDrawer.vue'
import { useDashboardState } from './composables/useDashboardState'
import { getCanvasStyle } from './utils/style'
import type { DashboardCanvasConfig, DashboardCatalog, DashboardLayoutItem, DashboardValue, DashboardWidget } from './types'

/** LoadingBoard's canvas and drawer orchestration, with injected definitions and instance-local state. */
const props = withDefaults(defineProps<{
  modelValue: DashboardValue
  catalog: DashboardCatalog
  editable?: boolean
  layoutEditable?: boolean
  /** Stable localStorage key for this dashboard's personal layout. */
  storageKey?: string
  /** Business component isEdit; independent from permission to rearrange a live dashboard. */
  previewMode?: boolean
  resolveImage?: (fileId: string) => string
}>(), { editable: false, layoutEditable: false, previewMode: false })
const emit = defineEmits<{ 'update:modelValue': [value: DashboardValue] }>()
const { t } = useI18n()
const state = useDashboardState({ value: () => props.modelValue, catalog: () => props.catalog,
  editable: () => props.editable, layoutEditable: () => props.layoutEditable,
  storageKey: () => props.storageKey, onChange: value => emit('update:modelValue', value) })
type DrawerMode = 'components' | 'component-config' | 'canvas-config'
const drawerVisible = ref(false)
const drawerMode = ref<DrawerMode>('components')
const selectedId = ref<string>()
const settingMenuVisible = ref(false)
const isDrawerDragging = ref(false)
const draggingType = ref<string>()
const widgetsById = computed(() => Object.fromEntries(state.value.value.components.map(widget => [widget.id, widget])))
const visibleCount = computed(() => state.value.value.components.filter(widget => widget.visible !== false).length)
const selected = computed(() => selectedId.value ? widgetsById.value[selectedId.value] : undefined)
const selectedDefinition = computed(() => selected.value ? props.catalog.components[selected.value.type] : undefined)
const drawerTitle = computed(() => t(drawerMode.value === 'components' ? 'dashboardCanvas.components'
  : drawerMode.value === 'canvas-config' ? 'dashboardCanvas.canvasSettings' : 'dashboardCanvas.configure'))
const surfaceStyle = computed(() => getCanvasStyle(state.value.value.canvas, props.resolveImage))
const dragging = computed(() => {
  const type = draggingType.value
  const definition = type ? props.catalog.components[type] : undefined
  return type && definition ? { type, gridItem: {
    ...definition.defaultConfig.componentProps.gridItem, ...definition.defaultGridItem,
  } } : undefined
})
function openDrawer(mode: DrawerMode) {
  if (!props.editable) return
  endDrag()
  drawerMode.value = mode
  drawerVisible.value = true
}
function closeDrawer() { drawerVisible.value = false; selectedId.value = undefined; endDrag() }
function openWidgetConfig(id: string) {
  if (widgetsById.value[id]?.isLocked) return
  selectedId.value = id
  openDrawer('component-config')
}
function applyWidget(initial: DashboardWidget, draft: DashboardWidget) { state.updateWidget(initial, draft); closeDrawer() }
function applyCanvas(canvas: DashboardCanvasConfig) { state.updateCanvas(canvas); closeDrawer() }
function startDrag(type: string) { draggingType.value = type; isDrawerDragging.value = true }
function endDrag() { draggingType.value = undefined; isDrawerDragging.value = false }
function onDrop(type: string, position: { x: number; y: number }, layout: DashboardLayoutItem[]) {
  state.addWidget(type, position, layout)
  endDrag()
}
function handleMouseUp() { isDrawerDragging.value = false }
watch(() => props.editable, editable => { if (!editable) closeDrawer() })
watch(selected, widget => {
  if (drawerMode.value === 'component-config' && (!widget || widget.isLocked)) closeDrawer()
})
onMounted(() => document.addEventListener('mouseup', handleMouseUp))
onBeforeUnmount(() => document.removeEventListener('mouseup', handleMouseUp))
</script>

<style scoped lang="less" src="./styles/canvas.less"></style>
