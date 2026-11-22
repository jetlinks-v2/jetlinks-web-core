<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ProcessSequence from './ProcessSequence.vue'
import ProcessStepEditor from './ProcessStepEditor.vue'
import { processLanes, findProcessStep } from './model'
import { processMessages } from './messages'
import type { ProcessTemplate } from './types'
const props = defineProps<{ modelValue: ProcessTemplate; readonly?: boolean; active?: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: ProcessTemplate] }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const selected = ref(props.modelValue.root.id)
const step = computed(() => findProcessStep(props.modelValue.root, selected.value))
</script>
<template>
  <div class="process-designer">
    <main class="process-designer__canvas">
      <a-button class="process-designer__root" :type="selected === modelValue.root.id ? 'primary' : 'default'" @click="selected = modelValue.root.id">{{ modelValue.name || t('steps') }}</a-button>
      <div v-for="lane in processLanes(modelValue.root)" :key="lane.key" class="process-designer__lane">
        <h4>{{ t(lane.label) }}</h4>
        <ProcessSequence :template="modelValue" :parent="modelValue.root" :lane-key="lane.key" :selected="selected" :readonly="readonly" :active="active" @change="emit('update:modelValue', $event)" @select="selected = $event" />
      </div>
    </main>
    <aside class="process-designer__inspector"><ProcessStepEditor v-if="step" :key="step.id" :template="modelValue" :step="step" :readonly="readonly" @change="emit('update:modelValue', $event)" /><a-empty v-else :description="t('selectStep')" /></aside>
  </div>
</template>
<style scoped>
.process-designer { display:grid; grid-template-columns:minmax(0,1fr) minmax(280px,340px); gap:24px; min-height:480px; align-items:start }
.process-designer__canvas { min-width:0; padding:20px; background:var(--ant-color-fill-quaternary,#fafafa); border-radius:8px }.process-designer__root { display:block; margin:auto; max-width:100%; height:auto; white-space:normal }
.process-designer__lane { margin-top:20px }.process-designer__lane h4 { font-size:12px; color:var(--ant-color-text-secondary); font-weight:500 }.process-designer__inspector { min-width:0; position:sticky; top:12px }
@media(max-width:900px) { .process-designer { grid-template-columns:minmax(0,1fr) }.process-designer__inspector { position:static } }
</style>
