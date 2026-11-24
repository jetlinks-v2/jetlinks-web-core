<template>
  <span class="latex-view" role="math" :aria-label="label || latex"><span v-if="markup" v-html="markup" /><slot v-else>{{ label || latex }}</slot></span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useMathMarkup } from './useMathMarkup'
const props = defineProps<{ latex:string; label?:string }>()
// 只做静态排版，共用公式反显的 MathLive 加载；不创建编辑器或执行计算。
const projection = computed(() => ({latex:props.latex,macros:{}}))
const {markup} = useMathMarkup(projection)
</script>
<style scoped>
.latex-view { display:block; min-width:0; max-width:100%; overflow-x:auto; overflow-y:hidden; color:inherit; font-size:14px; line-height:1.6; scrollbar-width:thin }
</style>
