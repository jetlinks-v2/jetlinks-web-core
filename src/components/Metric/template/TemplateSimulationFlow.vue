<template>
  <div class="simulation-flow">
    <div class="simulation-flow__scroll" tabindex="0" :aria-label="t('simulationFlow')" :style="{ '--simulation-columns': Math.max(1, times.length) }">
      <div class="simulation-flow__row simulation-flow__axis">
        <span class="simulation-flow__label" :title="t('flowTimeHint')"><AIcon type="ClockCircleOutlined" />{{ t('flowTime') }} →</span>
        <time v-for="(time, index) in times" :key="time" :title="sampleDate(time)" :style="{ gridColumn: index + 2 }">{{ sampleDate(time).slice(5, 10) }}<b>{{ sampleDate(time).slice(11) }}</b></time>
      </div>
      <TemplateSampleEditor v-if="facts && !advanced" :template="template" :facts="facts" :times="times" :loading="loading" @change="emit('change', $event)" @invalid="emit('invalid', $event)" />
      <section v-for="step in steps" :key="step.id" class="simulation-flow__step" :data-step="step.id">
        <div class="simulation-flow__operation">
          <div class="simulation-flow__sources"><span v-for="id in step.dependencies" :key="id"><span class="simulation-shape" :class="reference(id).shape" aria-hidden="true" />{{ reference(id).label }}</span><AIcon type="ArrowDownOutlined" /></div>
          <div class="simulation-flow__operator"><AIcon :type="step.rule.temporalCondition ? 'ClockCircleOutlined' : step.rule.calculator ? 'CalculatorOutlined' : step.rule.aggregation ? 'BarChartOutlined' : 'FunctionOutlined'" /><span>{{ operation(step.rule) }}</span><small v-if="step.rule.window?.emitPolicy === 'onSchedule'">{{ t('scheduledEvery', { duration: simulationDuration(step.rule.window.emitInterval, t) }) }}</small></div>
          <small v-if="step.rule.applicabilityExpression">{{ t('applicability') }}：{{ expressionLabel(template, step.rule.applicabilityExpression) }}</small>
        </div>
        <div class="simulation-flow__row simulation-flow__values">
          <div class="simulation-flow__label"><b><span class="simulation-shape" :class="step.shape" aria-hidden="true" />{{ stepLabel(step) }}</b><small>{{ t(step.output ? 'outputs' : 'intermediateResult') }}<template v-if="step.output?.unit"> · {{ step.output.unit }}</template></small></div>
          <div v-for="cell in simulationResultCells(step.values, columns)" :key="cell.column" class="simulation-flow__cell" :style="{ gridColumn: cell.column }">
            <a-button v-for="entry in cell.values" :key="entry.index" class="simulation-flow__value" :class="{ selected: selected?.value === entry.value, invalid: entry.value.status === 'invalid', output: !!step.output }" :aria-pressed="selected?.value === entry.value" :title="t('inspectResult')" @click="selected = { id: step.id, value: entry.value }">
              <span class="simulation-shape" :class="step.shape" aria-hidden="true" /><b>{{ entry.value.status === 'invalid' ? '—' : metricValueText(entry.value.value) }}</b><small>{{ entry.value.unit || step.output?.unit }}</small><AIcon v-if="entry.value.status === 'invalid'" type="ExclamationCircleOutlined" />
            </a-button>
          </div>
          <div v-for="cell in simulationRecordCells(pendingRecords(step.definitionId), columns)" :key="`record-${cell.column}`" class="simulation-flow__cell" :style="{ gridColumn: cell.column, gridRow: 2 }">
            <a-button v-for="{ value: record } in cell.values" :key="record.id" size="small" class="simulation-flow__record" :danger="record.hasError" :title="t('inspectProcess')" @click="selectRecord(record)">{{ record.hasError ? t('calculationFailed') : t(record.attributes.reason === 'notDue' ? 'notDue' : record.attributes.state === 'skipped' ? 'notTriggered' : 'stepNoResult') }}</a-button>
          </div>
          <small v-if="!step.values.length && !pendingRecords(step.definitionId).length" class="simulation-flow__waiting">{{ t(loading ? 'calculating' : response?.recordsTruncated ? 'processUnavailable' : response ? 'notExecuted' : 'awaitSimulation') }}</small>
        </div>
      </section>
    </div>
    <section v-if="selectedValue || selectedRecord" class="simulation-flow__detail" :aria-label="t('resultDetails')">
      <div class="simulation-flow__detail-head"><b>{{ reference(selectedValue?.metricId || String(selectedRecord?.attributes.definitionId || '')).label }}</b><a-button type="text" size="small" :aria-label="t('close')" @click="selected = undefined; inspectedRecord = undefined"><AIcon type="CloseOutlined" /></a-button></div>
      <MetricValueView v-if="selectedValue" :value="selectedValue" />
      <small v-if="participatingCount !== undefined" class="simulation-flow__participation">{{ t('participatingSampleCount', { count: participatingCount }) }}</small>
      <small v-if="selectedValue && Number(selectedValue.windowEnd) > Number(selectedValue.windowStart)">{{ t('windowRange') }}：{{ sampleDate(Number(selectedValue.windowStart)) }} — {{ sampleDate(Number(selectedValue.windowEnd)) }}</small>
      <div v-if="selectedRecord" class="simulation-flow__process">
        <small>{{ t('evaluationAt') }} · {{ sampleDate(Number(selectedProcess?.output.attributes.evaluationTime ?? selectedRecord.attributes.evaluationTime)) }}<template v-if="selectedRecord.useNanos"> · {{ (selectedRecord.useNanos / 1e6).toFixed(2) }} ms</template></small>
        <b v-if="inputSummaries.length">{{ t('currentReads') }}</b>
        <div v-for="(input, index) in inputSummaries" :key="index" class="simulation-flow__input"><span>{{ reference(String(input.id)).label }}</span><b>{{ metricValueText(input.value) }}</b><small>{{ t('inputSampleCount', { count: input.count }) }}<template v-if="input.thingId"> · {{ input.thingType }}/{{ input.thingId }}</template><template v-if="input.from !== undefined"> · {{ sampleDate(Number(input.from)) }} — {{ sampleDate(Number(input.to)) }}</template></small></div>
        <small v-if="selectedRecord.attributes.inputsTruncated">{{ t('inputSummaryTruncated') }}</small>
        <code v-if="selectedRecord.attributes.expression || selectedRecord.attributes.calculator">{{ selectedRecord.attributes.expression ? expressionLabel(template, String(selectedRecord.attributes.expression)) : selectedRecord.attributes.calculator }}</code>
        <a-alert v-if="selectedRecord.hasError" type="error" :message="selectedRecord.errorDetail || t('calculationFailed')" show-icon />
        <small v-else-if="selectedRecord.attributes.state !== 'produced'">{{ t(selectedRecord.attributes.reason === 'notDue' ? 'notDue' : selectedRecord.attributes.state === 'skipped' ? 'notTriggered' : 'stepNoResult') }}</small>
      </div>
      <MetricTrend v-if="hasTrend" :values="selectedSeries" :unit="selectedValue?.unit" />
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TemplateSampleEditor from './TemplateSampleEditor.vue'
import MetricValueView from '../MetricValue.vue'
import MetricTrend from '../MetricTrend.vue'
import { metricValueText } from '../presentation'
import { templateParameterDefault } from './parameters'
import { expressionLabel, type TemplateRule } from './designer'
import { sampleDate, type SimulationFacts } from './simulation'
import { evaluationTime, simulationShape, simulationTimes, simulationSteps, simulationResultCells, simulationDuration, simulationOperation, simulationNodeRecords, simulationProcessForResult, simulationRecordCells } from './simulationFlow'
import { metricMessages } from '../messages'
import type { MetricTemplate, MetricValue, MetricActionRecord, MetricSimulationResponse } from '../types'
const props = defineProps<{ template: MetricTemplate; facts?: SimulationFacts; advanced?: boolean; results: MetricValue[]; response?: MetricSimulationResponse; loading: boolean }>()
const emit = defineEmits<{ (event: 'change', value: SimulationFacts): void; (event: 'invalid', value: boolean): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const records = computed(() => props.response?.records || [])
const recordTime = (record: MetricActionRecord) => Number(record.attributes.evaluationTime)
const times = computed(() => [...new Set([...simulationTimes(props.facts?.samples || [], props.results), ...[...nodes.value.values()].flat().map(recordTime).filter(Number.isFinite)])].sort((a, b) => a - b))
const columns = computed(() => new Map(times.value.map((time, index) => [time, index + 2])))
const steps = computed(() => simulationSteps(props.template, props.results))
const nodes = computed(() => new Map(steps.value.map(step => [step.definitionId, simulationNodeRecords(records.value, step.definitionId)])))
function pendingRecords(id: string) { return (nodes.value.get(id) || []).filter(record => record.hasError || record.attributes.state !== 'produced') }
const references = computed(() => new Map([
  ...props.template.inputDefinitions.map((input, index) => [input.id, { label: input.name || input.id, shape: simulationShape(index) }] as const),
  ...steps.value.map(step => [step.id, { label: stepLabel(step), shape: step.shape }] as const),
]))
function stepLabel(step: typeof steps.value[number]) { return step.output?.label || (step.rule.aggregation ? t(`statistic_${step.rule.aggregation}`) : step.id) }
function reference(id: string) { return references.value.get(id) || { label: id, shape: 'circle' } }
function operation(rule: TemplateRule) {
  const names = new Map(props.template.definitions.map(item => [String(item.id), props.template.outputs.find(output => output.metricId === item.id)?.label || (item.aggregation ? t(`statistic_${item.aggregation}`) : String(item.id))]))
  if (props.facts) for (const parameter of props.template.parameterDefinitions) {
    const overrides = props.facts.configuration.parameters || {}
    const value = Object.hasOwn(overrides, parameter.id) ? overrides[parameter.id] : templateParameterDefault(props.template, parameter)
    names.set(`params.${parameter.id}`, `${parameter.name || parameter.id} (${metricValueText(value)})`)
  }
  for (const input of rule.inputs || []) if (!input.source && input.id && input.metricId) names.set(input.id, names.get(input.metricId) || props.template.inputDefinitions.find(item => item.id === input.metricId)?.name || input.metricId)
  return expressionLabel(props.template, simulationOperation(rule, t), names)
}
// 选择只属于当前返回集合；样本或规则变化清除结果后，旧详情不会继续显示。
const selected = ref<{ id: string; value: MetricValue }>()
const inspectedRecord = ref<MetricActionRecord>()
function selectRecord(record: MetricActionRecord) { selected.value = undefined; inspectedRecord.value = record }
const selectedValue = computed(() => selected.value && props.results.includes(selected.value.value) ? selected.value.value : undefined)
const selectedProcess = computed(() => selectedValue.value ? simulationProcessForResult(records.value, props.results.indexOf(selectedValue.value)) : undefined)
const selectedRecord = computed(() => selectedValue.value ? selectedProcess.value?.node
  : inspectedRecord.value && records.value.includes(inspectedRecord.value) ? inspectedRecord.value : undefined)
const inputSummaries = computed(() => selectedRecord.value?.attributes.inputs || [])
const participatingCount = computed(() => {
  const count = selectedValue.value?.quality?.attributes?.actualCount
  return typeof count === 'number' ? count : undefined
})
const selectedSeries = computed(() => props.results.filter(value => value.metricId === selectedValue.value?.metricId))
const hasTrend = computed(() => new Set(selectedSeries.value.filter(value => typeof value.value === 'number').map(evaluationTime)).size > 1)
</script>
<style scoped>
.simulation-flow { min-width:0 }
.simulation-flow__scroll { overflow:auto; max-width:100%; border:1px solid var(--line); border-radius:var(--r-4,12px); padding:16px 0; --simulation-label:160px; --simulation-cell:176px }
.simulation-flow :deep(.simulation-flow__row) { display:grid; grid-template-columns:var(--simulation-label) repeat(var(--simulation-columns),var(--simulation-cell)) 110px; position:relative; min-width:max-content; align-items:center; padding:8px 0 }
.simulation-flow :deep(.simulation-flow__label) { grid-column:1; position:sticky; left:0; z-index:1; align-self:stretch; display:flex; flex-direction:column; justify-content:center; gap:6px; padding:8px 16px; background:var(--panel-background); min-width:0; overflow-wrap:anywhere }
.simulation-flow :deep(.simulation-flow__label b) { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:500 }
.simulation-flow :deep(small) { font-size:12px; color:var(--ink-3) }
.simulation-flow :deep(.simulation-flow__cell) { grid-row:1; display:grid; gap:6px; padding:0 12px; min-width:0; z-index:0 }
.simulation-flow__axis { color:var(--ink-3); font-size:11px; border-bottom:1px solid var(--line) }
.simulation-flow__axis time { display:grid; text-align:center; font-variant-numeric:tabular-nums }
.simulation-flow__axis time b { font-weight:500; font-size:12px }
.simulation-flow__step { margin-top:16px; min-width:max-content }
.simulation-flow__operation { position:sticky; left:0; display:grid; gap:8px; width:fit-content; max-width:calc(100vw - 80px); margin:0 16px; padding:12px 0 4px 16px; border-left:1px solid var(--line); background:var(--panel-background) }
.simulation-flow__sources { display:flex; align-items:center; gap:12px; color:var(--ink-3); font-size:12px; flex-wrap:wrap }
.simulation-flow__sources > span { display:inline-flex; align-items:center; gap:4px }
.simulation-flow__operator { display:flex; flex-wrap:wrap; align-items:center; gap:8px; width:fit-content; max-width:100%; padding:7px 12px; border-radius:var(--r-2,6px); background:var(--accent-soft); color:var(--ink-2); overflow-wrap:anywhere }
.simulation-flow__values::before,.simulation-flow :deep(.sample-editor__lane)::before { content:''; position:absolute; left:var(--simulation-label); right:16px; top:50%; border-bottom:1px solid var(--line) }
.simulation-flow__values::after { content:'→'; position:absolute; right:6px; top:calc(50% - 12px); color:var(--ink-3) }
.simulation-flow__value.ant-btn { height:auto; min-height:40px; width:fit-content; min-width:80px; max-width:100%; justify-self:center; display:flex; justify-content:center; align-items:center; gap:8px; white-space:normal; overflow-wrap:anywhere; padding:8px 14px; border-radius:24px; box-shadow:none; background:var(--panel-background); font-variant-numeric:tabular-nums }
.simulation-flow__value.output { background:var(--accent-soft); border-color:transparent }
.simulation-flow__value b { font-size:15px; font-weight:600 }
.simulation-flow__value:focus-visible { outline:2px solid var(--accent); outline-offset:2px }
.simulation-flow__value.selected { border-color:var(--accent); background:var(--accent-soft) }
.simulation-flow__value.invalid { border-style:dashed }
.simulation-flow__waiting { grid-column:2; grid-row:1; padding:12px; background:var(--panel-background); z-index:0 }
.simulation-flow__detail { border:1px solid var(--line); border-radius:var(--r-2,6px); margin-top:12px; padding:12px }
.simulation-flow__detail-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px }
.simulation-flow__process { display:grid; gap:8px; margin-top:12px; overflow-wrap:anywhere }
.simulation-flow__process code { white-space:pre-wrap }
.simulation-flow__input { display:flex; align-items:center; flex-wrap:wrap; gap:8px }
.simulation-flow__input > small { flex-basis:100% }
.simulation-flow__record { justify-self:center; max-width:100%; white-space:normal; height:auto }
.simulation-flow :deep(.simulation-shape) { display:inline-block; width:12px; height:12px; flex-shrink:0; background:currentColor; color:var(--accent); vertical-align:middle }
.simulation-flow :deep(.simulation-shape.circle) { border-radius:50%; color:#1677ff }
.simulation-flow :deep(.simulation-shape.square) { border-radius:2px; color:#078879 }
.simulation-flow :deep(.simulation-shape.diamond) { clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%); color:#7856c5 }
.simulation-flow :deep(.simulation-shape.triangle) { clip-path:polygon(50% 0,100% 100%,0 100%); color:#b67a13 }
@media(max-width:640px) { .simulation-flow__scroll { --simulation-label:112px; --simulation-cell:168px } .simulation-flow__operation { margin:0 8px; padding:8px 4px } }
</style>
