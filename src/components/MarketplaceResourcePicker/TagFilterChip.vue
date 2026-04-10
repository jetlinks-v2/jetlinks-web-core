<template>
  <span
    role="button"
    tabindex="0"
    class="mp-res-layout__tag-chip"
    :class="{ 'mp-res-layout__tag-chip--selected': selected }"
    @click="$emit('toggle')"
    @keydown.enter.prevent="$emit('toggle')"
  >
    <IconValueView
      v-if="tag.icon"
      class="mp-res-layout__tag-chip-icon"
      :value="tag.icon"
      :size="18"
      :border-radius="4"
      :fallback-text="tag.name"
    />
    <span class="mp-res-layout__tag-chip-label">{{ tag.name }}</span>
  </span>
</template>

<script setup lang="ts">
import type { TagChipItem } from './sidebar'
import { IconValueView } from '@jetlinks-web-core/components/IconValue'

const props = defineProps<{
  tag: TagChipItem
  selected: boolean
}>()

defineEmits<{ toggle: [] }>()
</script>

<style scoped lang="less">
.mp-res-layout__tag-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #fff;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.85);
  cursor: pointer;
  line-height: 1.35;
  max-width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  outline: none;
}
.mp-res-layout__tag-chip:focus-visible {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.96) inset, 0 0 0 3px rgba(22, 119, 255, 0.28);
}
.mp-res-layout__tag-chip--selected {
  z-index: 1;
  border-color: #0958d9;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.96) inset, 0 0 0 3px rgba(22, 119, 255, 0.2),
    0 8px 18px rgba(22, 119, 255, 0.12);
  transform: translateY(-1px);
}
.mp-res-layout__tag-chip-icon {
  flex-shrink: 0;
}
.mp-res-layout__tag-chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
</style>
