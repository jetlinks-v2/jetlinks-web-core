<template>
  <section
    class="content-panel"
    :style="{
      '--content-panel-padding': `${normalizedPadding}px`,
    }"
  >
    <a-flex align="center" justify="space-between" class="content-panel__header">
      <div v-if="title || $slots.title" class="content-panel__title">
        <slot name="title">{{ title }}</slot>
      </div>
      <slot name="titleRightRender"></slot>
    </a-flex>
    <slot />
  </section>
</template>

<script setup lang="ts" name="ContentPanel">
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  padding: {
    type: Number,
    default: 16,
    validator: (value: number) => value >= 0,
  },
})

// 组件对外使用百分比，样式层使用 0 到 1 的 CSS 透明度值。
const normalizedPadding = computed(() => Math.max(props.padding, 0))
</script>

<style scoped>
.content-panel {
  box-sizing: border-box;
  gap: var(--panel-gap, var(--space-4));
  padding: var(--content-panel-padding);
  border-radius: var(--panel-radius, var(--r-6));
  background: linear-gradient(rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 14%, rgba(255, 255, 255, 0.25) 47%, rgba(255, 255, 255, 0.6) 99%);
  overflow: auto;
	backdrop-filter: blur(10px);
	box-shadow: rgba(30, 118, 255, 0.13) 0 1px 16px 0;
	height: 100%;
}

.content-panel__header {
	margin-bottom: var(--space-4);
}
.content-panel__title {
  margin-bottom: 0;
  color: var(--ink-1);
  font-size: 18px;
  font-weight: 600;
  line-height: var(--lh-snug);
}
</style>
