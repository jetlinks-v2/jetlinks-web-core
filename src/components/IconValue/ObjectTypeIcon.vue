<template>
  <AIcon
    :type="getObjectTypeIcon(typeId)"
    class="object-type-icon"
    :style="size ? { fontSize: `${size}px` } : undefined"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { getObjectTypeIcon } from './objectTypeIcons'

defineProps<{ typeId?: string; size?: number }>()
</script>

<style scoped>
.object-type-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: inherit;
}
</style>
