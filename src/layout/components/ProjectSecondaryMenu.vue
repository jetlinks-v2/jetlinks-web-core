<template>
  <div v-if="items.length" class="project-secondary-menu">
    <a-tabs
      :activeKey="props.selectedKey"
      :tabPosition="props.tabPosition"
      @change="handleClick"
    >
      <a-tab-pane v-for="item in items" :key="item.key">
        <template #tab>
          <AIcon v-if="item.icon" :type="item.icon" />
          <span class="project-secondary-menu__label">{{ item.label }}</span>
        </template>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts" name="ProjectSecondaryMenu">
import { type PropType } from 'vue'
import type { ProjectNavigationItem } from '../hooks/useProjectNavigation'

const props = defineProps({
  items: {
    type: Array as PropType<ProjectNavigationItem[]>,
    default: () => [],
  },
  selectedKey: {
    type: String,
    default: '',
  },
  tabPosition: {
    type: String as PropType<'top' | 'left'>,
    default: 'top',
  },
})

const emit = defineEmits<{
  (event: 'select', path: string): void
}>()

const handleClick = (key: string | number) => {
  emit('select', String(key))
}
</script>
