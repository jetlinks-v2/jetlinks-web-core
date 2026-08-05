<template>
  <div class="overview-card-group">
    <slot />
  </div>
</template>

<script setup lang="ts" name="OverviewCardGroup">
/**
 * OverviewCardGroup —— 单行等分排列多个 OverviewCard。
 */
</script>

<style scoped>
.overview-card-group {
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  gap: 1rem;
  min-width: 0;
}

.overview-card-group > :deep(*) {
  min-width: 0;
}
</style>
