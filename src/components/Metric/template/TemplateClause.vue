<template>
  <section class="template-clause">
    <AIcon :type="icon" class="template-clause__icon" />
    <div class="template-clause__body"><span v-if="title" class="template-clause__title">{{ title }}</span><div class="template-clause__content"><slot /></div><small v-if="hint">{{ hint }}</small></div>
  </section>
</template>
<script setup lang="ts">
defineProps<{ icon?: string; title?: string; hint?: string }>()
</script>
<style scoped>
.template-clause { display:flex; align-items:flex-start; gap:var(--space-3,12px); padding:var(--space-3,12px) 0 }
.template-clause__icon { color:var(--ink-3); margin-top:5px }
.template-clause__body { min-width:0; flex:1 }
.template-clause__title { display:block; margin-bottom:var(--space-2,8px); color:var(--ink-2); font-size:var(--fs-12,12px) }
.template-clause__content { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-2,8px) }
.template-clause__content>* { max-width:100% }
.template-clause__body small { display:block; color:var(--ink-3); margin-top:var(--space-2,8px) }
</style>
