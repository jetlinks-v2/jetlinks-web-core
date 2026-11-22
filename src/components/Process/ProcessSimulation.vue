<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import ObjectInputValue from '../ObjectOverview/ObjectInputValue.vue'
import ProcessDesigner from './ProcessDesigner.vue'
import { activeProcessNodes } from './model'
import { useProcessSimulation } from './useProcessSimulation'
import { processMessages } from './messages'
import type { ProcessApi, ProcessTemplate } from './types'
const props = defineProps<{ template: ProcessTemplate; api: ProcessApi }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const { now, values, unavailable, stop, result, busy, error, advance, reset } = useProcessSimulation(toRef(props, 'template'), props.api)
const pending = computed(() => Object.entries(result.value?.state.pendingOperations || {}).filter(([,state]) => !['completed','failed','cancelled'].includes(state)))
const actionName = (id: string) => {
  const intent = result.value?.trace.flatMap(trace => trace.intents).find(item => item.operationId === id)
  return intent ? props.template.actions[intent.action]?.name || intent.action : id
}
</script>
<template>
  <section class="process-simulation">
    <a-alert :message="t('simulationOnly')" type="info" show-icon />
    <a-alert v-if="error" :message="t('operationFailed')" :description="error" type="error" show-icon />
    <a-form layout="vertical" class="process-simulation__inputs">
      <div v-for="(input,id) in template.inputs" :key="id"><a-form-item :label="input.name || id"><ObjectInputValue :field="{id,valueType:{type:input.type === 'number' ? 'double' : input.type}}" :model-value="values[id] ?? (input.type === 'boolean' ? false : input.type === 'number' ? 0 : '')" @update:model-value="values[id] = $event" /></a-form-item><a-checkbox :checked="unavailable.includes(id)" @change="event => unavailable = event.target.checked ? [...unavailable,id] : unavailable.filter(value => value !== id)">{{ t('unavailable') }}</a-checkbox></div>
      <a-form-item :label="t('virtualTime')"><a-input-number v-model:value="now" :min="0" /></a-form-item>
    </a-form>
    <a-space wrap><a-checkbox v-model:checked="stop">{{ t('stopRequested') }}</a-checkbox><a-button type="primary" :loading="busy" @click="advance()">{{ t('advance') }}</a-button><a-button :disabled="busy || !result || result.state.nextDueAt > Number.MAX_SAFE_INTEGER || result.state.status === 'ended'" @click="advance(undefined,true)">{{ t('advanceDue') }}</a-button><a-button :disabled="busy" @click="reset">{{ t('reset') }}</a-button></a-space>
    <section v-if="result" class="process-simulation__result">
      <a-space><a-tag>{{ t(result.state.status) }}</a-tag><a-tag v-if="result.state.outcome">{{ t(result.state.outcome) }}</a-tag><span>{{ result.state.reason }}</span><span>{{ result.state.cycle }} ×</span></a-space>
      <div v-for="([id,state]) in pending" :key="id" class="process-simulation__operation"><span>{{ actionName(id) }} · {{ t(state) }}</span><a-space wrap><a-button v-for="outcome in (['accepted','completed','failed','unknown'] as const)" :key="outcome" :disabled="busy" @click="advance({id,state:outcome})">{{ t(outcome) }}</a-button></a-space></div>
      <a-timeline><a-timeline-item v-for="(item,index) in result.trace.flatMap(trace => trace.history)" :key="index">{{ item.time / 1000 }} s · {{ template.stepNames[item.nodeId] || item.event }} · {{ item.reason }}</a-timeline-item></a-timeline>
      <ProcessDesigner :model-value="template" readonly :active="activeProcessNodes(result.state.root)" />
    </section>
  </section>
</template>
<style scoped>
.process-simulation { display:grid; gap:16px }.process-simulation__inputs { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:16px }.process-simulation__result { display:grid; gap:20px }.process-simulation__operation { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap }
</style>
