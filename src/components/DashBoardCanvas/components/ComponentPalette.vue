<template>
  <div class="dashboard-palette" :aria-label="t('dashboardCanvas.components')">
    <a-collapse :default-active-key="groups.map(group => group.id)" ghost>
      <a-collapse-panel v-for="group in groups" :key="group.id" :header="group.name">
        <div class="card-container">
          <button v-for="[type, definition] in group.widgets" :key="type" type="button"
            class="card-item" draggable="true" @click="$emit('add', type)"
            @dragstart="startDrag($event, type)" @dragend="$emit('drag-end')">
            <img v-if="definition.thumbnail" :src="definition.thumbnail" alt="" draggable="false" />
            <AppstoreOutlined v-else class="card-icon" />
            <span>{{ definition.defaultConfig.name || t('dashboardCanvas.component') }}</span>
          </button>
        </div>
      </a-collapse-panel>
    </a-collapse>
    <span v-if="!groups.length">{{ t('dashboardCanvas.noComponents') }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AppstoreOutlined } from '@ant-design/icons-vue'
import { Collapse as ACollapse, CollapsePanel as ACollapsePanel } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { DashboardCatalog } from '../types'
const props = defineProps<{ catalog: DashboardCatalog }>()
const emit = defineEmits<{ add: [type: string]; 'drag-start': [type: string]; 'drag-end': [] }>()
const { t } = useI18n()
const groups = computed(() => {
  const definitions = Object.entries(props.catalog.components)
  const known = new Set(props.catalog.groups.map(group => group.id))
  const all = [...props.catalog.groups]
  // Keep injected definitions selectable even if their optional display group has not been supplied.
  for (const [, definition] of definitions) {
    if (!known.has(definition.groupId)) {
      all.push({ id: definition.groupId, name: t('dashboardCanvas.components') })
      known.add(definition.groupId)
    }
  }
  return all.map(group => ({ ...group, widgets: definitions.filter(([, item]) => item.groupId === group.id) }))
    .filter(group => group.widgets.length)
})
function startDrag(event: DragEvent, type: string) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('text/plain', type)
  emit('drag-start', type)
}
</script>

<style scoped lang="less">
// Preserve LeftSiderCollapse's grouped thumbnail grid, without its designer store and resource APIs.
.dashboard-palette { color: var(--ink-2); }
.card-container { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); }
.card-item { display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
  min-width: 0; padding: var(--space-2); background: var(--bg); border: 0; color: var(--ink-2); cursor: grab;
  img { width: 78px; max-width: 100%; height: 78px; object-fit: contain; }
  span { max-width: 100%; overflow-wrap: anywhere; }
  &:hover { background: var(--bg-sunken); }
}
.card-icon { display: grid; place-items: center; height: 78px; font-size: 32px; color: var(--ink-4); }
</style>
