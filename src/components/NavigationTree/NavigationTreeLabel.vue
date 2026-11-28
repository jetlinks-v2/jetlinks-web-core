<template>
  <Tooltip :open="suppressed || !overflow ? false : undefined" :mouse-enter-delay="0.6" :mouse-leave-delay="0">
    <template #title><slot /></template>
    <span ref="label" class="navigation-tree__label" @mouseenter="measure"><slot /></span>
  </Tooltip>
</template>
<script setup lang="ts">
import { onUpdated, ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { Tooltip } from 'ant-design-vue'
defineProps<{ suppressed: boolean }>()
const label = ref<HTMLElement>()
const overflow = ref(false)
function measure() { overflow.value = Boolean(label.value && label.value.scrollWidth > label.value.clientWidth) }
useResizeObserver(label, measure)
onUpdated(measure)
</script>
<style scoped>
.navigation-tree__label { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
