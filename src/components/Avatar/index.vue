<template>
  <span
    class="av"
    :class="{ more: isMore }"
    :title="label"
  >
    <slot>{{ initial }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 单个协作者头像。label 是 "+1" 或数字时自动切 more 样式（灰底无色 chip）。
 */
const props = defineProps<{ label?: string }>()
const isMore = computed(() => !!props.label?.startsWith('+'))
const initial = computed(() => props.label?.trim().slice(0, 1) || '用')
</script>

<style scoped>
.av {
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: var(--fs-12);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0.125rem solid var(--bg);
  margin-left: -0.375rem;
}
.av:first-child {
  margin-left: 0;
}
.av.more {
  background: var(--bg-sunken);
  color: var(--ink-3);
  font-weight: 500;
}</style>
