<template>
  <span class="app-tag">
    <slot>{{ name }}</slot>
  </span>
</template>

<script setup lang="ts">
defineProps<{ name?: string }>()
</script>

<style scoped>
.app-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--r-2);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: var(--fs-11);
  font-weight: 500;
  line-height: 1.6;
}
</style>
