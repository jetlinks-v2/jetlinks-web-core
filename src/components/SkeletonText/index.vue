<template><SkeletonInput class="skeleton-text" :active="active" :style="{ width: css(width), height: css(height) }" aria-hidden="true" /></template>
<script setup lang="ts">
import { SkeletonInput } from 'ant-design-vue'
withDefaults(defineProps<{ width?: number | string; height?: number | string; active?: boolean }>(), { width: 64, height: 14, active: true })
const css = (value: number | string) => typeof value === 'number' ? `${value}px` : value
</script>
<style scoped>
.skeleton-text { display:inline-flex; flex:none; max-width:100%; min-width:0; vertical-align:middle; }
/* Ant 的输入骨架带输入框最小宽度；文本骨架由调用方尺寸决定。 */
.skeleton-text :deep(.ant-skeleton-input) { width:100%; min-width:0; height:100%; }
</style>
