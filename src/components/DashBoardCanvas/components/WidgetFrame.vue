<template>
  <div class="draggable-item" :class="{ 'dropdown-open': dropdownVisible }">
    <div v-if="draggable" class="drag-handle" :title="t('dashboardCanvas.drag')" />
    <div class="no-drag"><slot /></div>
    <div v-if="editable" class="topRight">
      <a-dropdown v-model:open="dropdownVisible">
        <a-button type="text" size="small" :aria-label="t('dashboardCanvas.configure')"><BarsOutlined /></a-button>
        <template #overlay>
          <a-menu @click="dropdownVisible = false">
            <a-menu-item v-if="configurable" key="edit" @click="$emit('configure')">
              <template #icon><EditOutlined /></template>{{ t('dashboardCanvas.configure') }}
            </a-menu-item>
            <a-menu-item key="delete" danger @click="remove">
              <template #icon><DeleteOutlined /></template>{{ t('dashboardCanvas.remove') }}
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button as AButton, Dropdown as ADropdown, Menu as AMenu, MenuItem as AMenuItem, Modal } from 'ant-design-vue'
import { BarsOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
defineProps<{ editable: boolean; draggable: boolean; configurable: boolean }>()
const emit = defineEmits<{ configure: []; remove: [] }>()
const { t } = useI18n()
const dropdownVisible = ref(false)
function remove() {
  Modal.confirm({ title: t('dashboardCanvas.removeConfirm'), okText: t('dashboardCanvas.remove'),
    cancelText: t('dashboardCanvas.cancel'), onOk: () => emit('remove') })
}
</script>

<style scoped lang="less">
// Selection.vue's drag strip and hover menu; the business component retains ownership of its appearance.
.draggable-item { position: absolute; width: 100%; height: 100%; user-select: none; }
.no-drag { width: 100%; height: 100%; }
.drag-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 24px;
  z-index: 1;
  cursor: grab;
  touch-action: none;
  border-top-left-radius: var(--dashboard-card-radius, 12px);
  border-top-right-radius: var(--dashboard-card-radius, 12px);
}
.drag-handle:hover { background: linear-gradient(to bottom, rgba(0, 0, 0, .05), transparent); }
.drag-handle:active { cursor: grabbing; }
.topRight { position: absolute; top: 0; right: 0; z-index: 2; opacity: 0; pointer-events: none; transition: opacity .25s; }
.draggable-item:hover > .topRight, .draggable-item:focus-within > .topRight,
.draggable-item.dropdown-open > .topRight { opacity: 1; pointer-events: auto; }
@media (hover: none) { .topRight { opacity: 1; pointer-events: auto; } }
</style>
