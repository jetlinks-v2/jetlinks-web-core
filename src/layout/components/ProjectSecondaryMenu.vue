<template>
  <div v-if="items.length" class="project-secondary-menu">
    <a-tabs :activeKey="props.selectedKey" @change="handleClick">
      <a-tab-pane v-for="item in items" :key="item.key">
        <template #tab>
          <AIcon v-if="item.icon" :type="item.icon" />
          {{ item.label }}
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
})

const emit = defineEmits<{
  (event: 'select', path: string): void
}>()

const handleClick = (key: string | number) => {
  emit('select', String(key))
}
</script>

<style scoped lang="less">

</style>
