<template>
  <div class="page-actions">
    <slot />
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'PageActions',
})
</script>

<style scoped>
.page-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
