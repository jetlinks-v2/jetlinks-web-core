<template>
    <div class="title" :style="style">
        <div class="title-content">{{ data }}</div>
        <slot name="extra"></slot>
    </div>
</template>

<script setup lang="ts" name="TitleComponent">
import type { CSSProperties, PropType } from 'vue';

const props = defineProps({
    data: {
        type: String,
        default: '',
    },
    style: {
        type: Object as PropType<CSSProperties>,
        default: () => ({}),
    },
});
</script>

<style scoped>
.title {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: var(--space-4);
}
.title .title-content {
  position: relative;
  padding-left: 0.625rem;
  color: color-mix(in srgb, var(--ink-1) 80%, transparent);
  font-weight: 600;
  line-height: 1;
}
.title .title-content::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 0.25rem;
  height: 100%;
  background-color: var(--accent);
  border-radius: 0 var(--r-1) var(--r-1) 0;
  content: ' ';
}</style>
