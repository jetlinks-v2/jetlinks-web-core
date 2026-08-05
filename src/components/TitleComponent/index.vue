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
  padding-left: 0.5rem;
  color: #1D2129;
  font-weight: 500;
  font-size: 1rem;
  line-height: 1;
}
.title .title-content::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 4px;
  height: calc(100% - 2px);
  background-color: var(--primary-color);
  content: ' ';
  transform: translateY(-50%);
}
</style>
