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

<style scoped>
.mp-res-layout__tag-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: var(--jet-theme-radius);
  border: 0.0625rem solid color-mix(in srgb, var(--jet-theme-text) 10%, transparent);
  background: var(--jet-theme-bg-container);
  font-size: var(--fs-14);
  color: var(--jet-theme-text);
  cursor: pointer;
  line-height: 1.35;
  max-width: 100%;
  box-sizing: border-box;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
  outline: none;
}
.mp-res-layout__tag-chip:focus-visible {
  box-shadow: 0 0 0 0.0625rem color-mix(in srgb, var(--jet-theme-bg-container) 96%, transparent) inset,
    0 0 0 0.1875rem color-mix(in srgb, var(--jet-theme-primary) 28%, transparent);
}
.mp-res-layout__tag-chip--selected {
  z-index: 1;
  border-color: var(--jet-theme-primary-active);
  box-shadow: 0 0 0 0.0625rem color-mix(in srgb, var(--jet-theme-bg-container) 96%, transparent) inset,
    0 0 0 0.1875rem color-mix(in srgb, var(--jet-theme-primary) 20%, transparent),
    0 0.5rem 1.125rem color-mix(in srgb, var(--jet-theme-primary) 12%, transparent);
  transform: translateY(-0.0625rem);
}
.mp-res-layout__tag-chip-icon {
  flex-shrink: 0;
}
.mp-res-layout__tag-chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}</style>
