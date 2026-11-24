<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ProcessGraph from './ProcessGraph.vue'
import ProcessStepEditor from './ProcessStepEditor.vue'
import { findProcessStep } from './model'
import { processMessages } from './messages'
import type { ProcessTemplate } from './types'
const props = defineProps<{ modelValue: ProcessTemplate; readonly?: boolean; active?: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: ProcessTemplate] }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const selected = ref<string>()
const step = computed(() => findProcessStep(props.modelValue.root, selected.value))
</script>
<template>
  <div class="process-designer" :class="{'process-designer--selected':!!step}">
    <main class="process-designer__canvas"><ProcessGraph :template="modelValue" :selected="selected" :readonly="readonly" :active="active" @change="emit('update:modelValue',$event)" @select="selected = $event" /></main>
    <aside v-if="step" class="process-designer__inspector"><a-button type="text" @click="selected = undefined">{{ t('close') }}</a-button><ProcessStepEditor :key="step.id" :template="modelValue" :step="step" :readonly="readonly" @change="emit('update:modelValue', $event)" /></aside>
  </div>
</template>
<style scoped>
.process-designer { display:grid; grid-template-columns:minmax(0,1fr); gap:24px; min-height:480px; align-items:start }
.process-designer--selected { grid-template-columns:minmax(0,1fr) minmax(280px,340px) }
.process-designer__canvas { min-width:0 }.process-designer__inspector { min-width:0; position:sticky; top:12px }
@media(max-width:900px) { .process-designer { grid-template-columns:minmax(0,1fr) }.process-designer__inspector { position:static } }
</style>
