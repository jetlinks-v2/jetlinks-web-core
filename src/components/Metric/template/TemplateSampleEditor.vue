<template>
  <a-form class="sample-editor" :disabled="loading">
    <a-empty v-if="!template.inputDefinitions.length" :description="t('noSampleInputs')" />
    <div v-for="(input, inputIndex) in template.inputDefinitions" :key="input.id" class="simulation-flow__row sample-editor__lane" :data-input="input.id">
      <div class="simulation-flow__label">
        <b><span class="simulation-shape" :class="simulationShape(inputIndex)" aria-hidden="true" />{{ input.name || input.id }}</b>
        <small>{{ input.unit }}<template v-if="input.source?.lookback"> · {{ t('lookback') }} {{ simulationDuration(input.source.lookback, t) }}</template></small>
      </div>
      <div v-for="cell in lanes.get(input.id)" :key="cell.time" class="simulation-flow__cell" :style="{ gridColumn: cell.column }">
        <div v-for="entry in cell.entries" :key="entry.index" class="sample-editor__row" :class="{ incomplete: entry.sample.value == null }">
          <div class="sample-editor__value" :inert="loading || undefined">
            <span class="simulation-shape" :class="simulationShape(inputIndex)" aria-hidden="true" />
            <a-select v-if="input.valueType?.type === 'boolean'" :value="entry.sample.value == null ? undefined : String(entry.sample.value)" :disabled="loading" :placeholder="t('fillSampleValue')" :aria-label="`${input.name || input.id} · ${t('sampleValue')}`" :options="[{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }]" @update:value="patch(entry.index, { value: $event === 'true' })" />
            <MetricParameterValue v-else :parameter="{ ...input, valueType: { ...input.valueType, type: String(input.valueType?.type || 'double') } }" :model-value="entry.sample.value" @update:model-value="patch(entry.index, { value: $event ?? null })" />
          </div>
          <div class="sample-editor__tools">
            <a-popover trigger="click" placement="bottom">
              <template #content><a-input type="datetime-local" :value="sampleDate(entry.sample.eventTime)" :disabled="loading" :aria-label="`${input.name || input.id} · ${t('sampleTime')}`" step="1" @change="changeTime(entry.index, $event.target.value)" /></template>
              <a-button type="text" size="small" class="sample-editor__time" :danger="timeErrors.has(entry.index)" :disabled="loading" :aria-label="`${input.name || input.id} · ${t('editSampleTime')}`" :title="sampleDate(entry.sample.eventTime)"><AIcon type="ClockCircleOutlined" />{{ sampleDate(entry.sample.eventTime).slice(11) }}</a-button>
            </a-popover>
            <a-button class="sample-editor__remove" type="text" size="small" danger :disabled="loading" :aria-label="t('removeSample')" @click="remove(entry.index)"><AIcon type="CloseOutlined" /></a-button>
          </div>
        </div>
      </div>
      <a-button class="sample-editor__add" size="small" type="text" :disabled="loading" :aria-label="`${input.name || input.id} · ${t('addSample')}`" :style="{ gridColumn: axis.length + 2 }" @click="add(input.id)"><AIcon type="PlusCircleOutlined" />{{ t('addData') }}</a-button>
    </div>
    <a-alert v-if="timeErrors.size" type="error" show-icon :message="t('sampleTimeRequired')" />
  </a-form>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MetricParameterValue from '../MetricParameterValue.vue'
import { sampleInput, sampleDate, addSimulationSample, patchSimulationSample, type SimulationFacts, type SimulationSample } from './simulation'
import { simulationShape, simulationDuration, simulationTimes } from './simulationFlow'
import type { MetricTemplate } from '../types'
import { metricMessages } from '../messages'
const props = defineProps<{ template: MetricTemplate; facts: SimulationFacts; loading?: boolean; times?: number[] }>()
const emit = defineEmits<{ (event: 'change', facts: SimulationFacts): void; (event: 'invalid', value: boolean): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const timeErrors = ref(new Set<number>())
const invalid = computed(() => timeErrors.value.size > 0 || props.facts.samples.some(sample => sample.value == null))
watch(invalid, value => emit('invalid', value), { immediate: true, flush: 'sync' })
const axis = computed(() => props.times || simulationTimes(props.facts.samples, []))
const lanes = computed(() => {
  const columns = new Map(axis.value.map((time, index) => [time, index + 2]))
  const result = new Map<string, Map<number, { time: number; column: number; entries: { sample: SimulationSample; index: number }[] }>>()
  props.facts.samples.forEach((sample, index) => {
    const id = sampleInput(props.template, props.facts, sample)
    if (!id || sample.eventTime === undefined) return
    const cells = result.get(id) || new Map()
    const cell = cells.get(sample.eventTime) || { time: sample.eventTime, column: columns.get(sample.eventTime)!, entries: [] }
    cell.entries.push({ sample, index }); cells.set(sample.eventTime, cell); result.set(id, cells)
  })
  return new Map([...result].map(([id, cells]) => [id, [...cells.values()]]))
})
function patch(index: number, fields: Partial<SimulationSample>) { if (!props.loading) emit('change', patchSimulationSample(props.facts, index, fields)) }
function changeTime(index: number, value: string) {
  if (props.loading) return
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) timeErrors.value.add(index)
  else timeErrors.value.delete(index)
  if (Number.isFinite(time)) patch(index, { eventTime: time })
}
function add(id: string) {
  if (props.loading) return
  let last: number | undefined
  for (const sample of props.facts.samples) if (sampleInput(props.template, props.facts, sample) === id && sample.eventTime !== undefined) last = Math.max(last ?? sample.eventTime, sample.eventTime)
  const first = props.facts.samples[0]?.eventTime
  emit('change', addSimulationSample(props.template, props.facts, id, last === undefined ? first ?? Date.now() : last + 60_000))
}
function remove(index: number) {
  if (props.loading) return
  timeErrors.value = new Set([...timeErrors.value].filter(position => position !== index).map(position => position > index ? position - 1 : position))
  emit('change', { ...props.facts, samples: props.facts.samples.filter((_, position) => position !== index) })
}
</script>
<style scoped>
.sample-editor { display:grid; gap:var(--space-3,12px) }
.sample-editor__row { display:grid; gap:4px; padding:8px 4px; background:var(--panel-background); min-width:0; position:relative }
.sample-editor__tools { display:flex; justify-content:center; align-items:center; min-width:0 }
.sample-editor__time.ant-btn { height:24px; padding:0 4px; font-size:11px; font-variant-numeric:tabular-nums; color:var(--ink-3) }
.sample-editor__time.ant-btn-dangerous { color:var(--error-color,#ff4d4f) }
.sample-editor__remove.ant-btn { width:20px; height:24px; padding:0; opacity:0 }
.sample-editor__row:hover .sample-editor__remove,.sample-editor__row:focus-within .sample-editor__remove { opacity:1 }
.sample-editor__value { display:flex; gap:6px; align-items:center; border:1px solid var(--line); border-radius:24px; padding:4px 12px; min-height:40px; background:var(--panel-background) }
.sample-editor__value:focus-within { border-color:var(--accent); box-shadow:0 0 0 2px var(--accent-soft) }
.sample-editor__row.incomplete .sample-editor__value { border-style:dashed }
.sample-editor__value > :last-child { min-width:0; flex:1 }
.sample-editor__value :deep(.ant-input-number),.sample-editor__value :deep(.ant-input),.sample-editor__value .ant-select { width:100%; min-width:0; border:0; box-shadow:none; background:transparent }
.sample-editor__value :deep(.ant-input-number-handler-wrap) { display:none }
.sample-editor__value :deep(.ant-input-number-input) { padding:0 4px; font-size:16px; font-weight:500; font-variant-numeric:tabular-nums }
.sample-editor__value :deep(.ant-select-selector) { border:0; background:transparent; box-shadow:none !important }
.sample-editor__add { align-self:center; justify-self:start; margin:0 8px; color:var(--accent) }
@media(hover:none) { .sample-editor__remove.ant-btn { opacity:1 } }
</style>
