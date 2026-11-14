<template>
  <a-button class="platform-image-trigger" :disabled="disabled" :aria-label="label" :aria-busy="loading">
    <AIcon v-if="loading" type="LoadingOutlined" />
    <img v-else-if="src" :src="src" alt="" draggable="false" />
    <AIcon v-else type="PlusOutlined" />
  </a-button>
</template>

<script setup lang="ts">
defineProps<{ src: string; label: string; loading?: boolean; disabled?: boolean }>()
</script>

<style scoped>
.platform-image-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
}
.platform-image-trigger img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
