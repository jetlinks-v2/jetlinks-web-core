<template>
  <span ref="viewport" class="auto-fit-text">
    <a-tooltip :title="tooltip && overflowing ? text : undefined">
      <span ref="content" :style="{ fontSize: `${fontSize}px` }">{{ text }}</span>
    </a-tooltip>
  </span>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useContentFit } from '../../hooks/useContentFit'

const props = withDefaults(defineProps<{ text: string; minSize?: number; maxSize?: number; tooltip?: boolean }>(), {
  minSize: 12,
  maxSize: 14,
  tooltip: true,
})
const viewport = ref<HTMLElement>(), content = ref<HTMLElement>()
const { fontSize, overflowing, preferredWidth, refresh } = useContentFit({
  viewport, content, minSize: () => props.minSize, maxSize: () => props.maxSize,
})
watch(() => props.text, refresh, { flush: 'post' })
defineExpose({ preferredWidth, element: viewport })
</script>

<style scoped>
.auto-fit-text {
  display: block;
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
