<script setup lang="ts">
import { ref } from 'vue'
import ProcessObjectNavigation from './ProcessObjectNavigation.vue'
import ProcessObjectPanel from './ProcessObjectPanel.vue'
import type { ProcessApi, ProcessObject } from './types'
const props = defineProps<{ api: ProcessApi; selection?: ProcessObject; initialTemplate?:{id:string;version:string}; permissions?: {configure:boolean;remove:boolean;start:boolean;stop:boolean;reconcile:boolean} }>()
const emit = defineEmits<{ 'update:selection': [value?: ProcessObject]; applied:[] }>()
const confirmed = ref<ProcessObject>()
function select(object?: ProcessObject) { confirmed.value = object; if (object) emit('update:selection',object) }
</script>
<template><div class="process-workspace"><aside><ProcessObjectNavigation :selection="selection" @select="select" /></aside><main><ProcessObjectPanel :key="JSON.stringify([confirmed?.type,confirmed?.id])" :object="confirmed" :api="api" :permissions="permissions" :initial-template="initialTemplate" @applied="emit('applied')" /></main></div></template>
<style scoped>.process-workspace { display:grid; grid-template-columns:240px minmax(0,1fr); gap:24px; height:100%; min-height:0 }.process-workspace aside,.process-workspace main { min-width:0; overflow:auto }@media(max-width:760px) { .process-workspace { grid-template-columns:minmax(0,1fr); height:auto }.process-workspace aside { max-height:260px } }</style>
