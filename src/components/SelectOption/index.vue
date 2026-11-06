<template>
  <span class="select-option">
    <AIcon v-if="icon" :type="icon" class="select-option__icon" />
    <span class="select-option__text"><span>{{ label }}</span><small v-if="description">{{ description }}</small></span>
  </span>
</template>
<script setup lang="ts">
defineProps<{ label?: string | number; icon?: string; description?: string }>()
</script>
<style scoped>
.select-option { display:flex; align-items:flex-start; gap:8px; min-width:160px; max-width:min(280px,calc(100vw - 64px)); padding:3px 0; line-height:1.5; white-space:normal }
.select-option__icon { flex:none; color:var(--ink-3,#8c8c8c); margin-top:3px }
.select-option__text { display:grid; gap:2px; min-width:0; overflow-wrap:anywhere; font-size:13px }
.select-option__text small { color:var(--ink-3,#8c8c8c); font-size:12px; font-weight:400 }
/* Selected values keep a single line; the expanded menu retains its explanatory second line. */
:global(.ant-select-selection-item .select-option) { min-width:0; max-width:100%; align-items:center; padding:0; height:100%; white-space:nowrap }
:global(.ant-select-selection-item .select-option__icon) { margin-top:0 }
:global(.ant-select-selection-item .select-option__text) { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
:global(.ant-select-selection-item .select-option__text small) { display:none }
</style>
