<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import JlDrawerShell from '../JlDrawerShell/index.vue'
import { HistoryMetricCharts, HistoryRangeControl } from '../RuntimeDiagnostics'
import ObjectInputValue from './ObjectInputValue.vue'
import ObjectDataView from './ObjectDataView.vue'
import ObjectMemberValue from './ObjectMemberValue.vue'
import type { ObjectContentEntry } from './ObjectContentGroup.vue'
import type { ObjectFunctionMetadata, ObjectPropertyMetadata } from '../../object-capability/types'
import type { DataCapabilityRuntime } from '../../data-capability/types'
import { useObjectDataQuery } from '../../object-capability/useObjectDataQuery'
import { objectOverviewMessages } from './messages'

const props = defineProps<{ entry?: ObjectContentEntry; runtime: () => DataCapabilityRuntime | undefined }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const { access, analysis, objectTypes, valueType, range, mode, operation, intervalSeconds, input, busy, failed, limited, result, samples, charts,
  query, more, changeRange, changeMode, changeOperation, retry } = useObjectDataQuery(toRef(props, 'entry'), props.runtime)
const fields = computed(() => ((props.entry?.member?.metadata as ObjectFunctionMetadata)?.inputs || []).filter(field =>
  !analysis.value || ![analysis.value.from, analysis.value.to, analysis.value.interval].includes(field.id)))
const objectTypeValue = (id: string) => typeof input.value[id] === 'string' ? input.value[id] as string : undefined
const display = ref<'chart' | 'table'>('chart')
const showChart = computed(() => display.value === 'chart' && charts.value.length > 0)
const displays = computed(() => [
  { value: 'chart', label: t('chartView'), disabled: !charts.value.length },
  { value: 'table', label: t('tableView') }
])
const columns = computed(() => [
  { key: 'timestamp', title: t('recordedAt'), dataIndex: 'timestamp' },
  ...((result.value?.values.length || 0) > 1 ? [{ key: 'object', title: t('target'), dataIndex: 'object' }] : []),
  { key: 'value', title: props.entry?.member?.name || t('recordedValue'), dataIndex: 'value' }
])
const sampleKey = (_row: unknown, index?: number) => String(index)
function changeDisplay(value: unknown) { if (value === 'chart' || value === 'table') display.value = value }
const modes = computed(() => {
  const options: Array<{ value: 'history' | 'aggregate'; label: string }> = []
  if (access.value?.history) options.push({ value: 'history', label: t('history') })
  if (access.value?.aggregate) options.push({ value: 'aggregate', label: t('aggregate') })
  return options
})
</script>
<template>
  <JlDrawerShell :open="!!entry" :title="entry?.member?.name" :width="760" destroy-on-close @update:open="!$event && emit('close')">
    <section class="object-data-explorer">
      <template v-if="access">
        <div class="object-data-explorer__tools">
          <a-radio-group :value="mode" :options="modes" option-type="button" @change="changeMode($event.target.value)" />
          <HistoryRangeControl :range="range" @change="changeRange" />
          <a-select v-if="mode === 'aggregate'" :value="operation" :aria-label="t('aggregation')" :options="access.operations.map(item => ({ value: item.id, label: item.name }))" @change="changeOperation" />
          <label v-if="mode === 'aggregate'">{{ t('bucketInterval') }} <a-input-number v-model:value="intervalSeconds" :min="1" :precision="0" /> {{ t('seconds') }}</label>
          <a-button :loading="busy" @click="query(false)">{{ t('queryData') }}</a-button>
        </div>
        <template v-if="samples.length">
          <a-segmented :value="showChart ? 'chart' : 'table'" :options="displays" :aria-label="t('dataDisplay')" @change="changeDisplay" />
          <HistoryMetricCharts v-if="showChart" :charts="charts" :range="range" compact @range-change="changeRange" />
          <a-table v-else :columns="columns" :data-source="samples" :row-key="sampleKey" :pagination="false" size="small">
            <template #bodyCell="{ column, record }"><time v-if="column.key === 'timestamp'">{{ new Date(record.timestamp).toLocaleString() }}</time><span v-else-if="column.key === 'object'">{{ record.object.name || record.object.id }}</span><ObjectDataView v-else :value="record.value" :metadata="valueType" compact /></template>
          </a-table>
        </template>
        <a-empty v-else-if="!busy && !failed" :description="t('noHistory')" />
      </template>
      <template v-else>
        <div v-if="analysis" class="object-data-explorer__tools"><HistoryRangeControl :range="range" @change="range = $event" /><label>{{ t('bucketInterval') }} <a-input-number v-model:value="intervalSeconds" :min="1" :precision="0" /> {{ t('seconds') }}</label></div>
        <a-form :model="input" layout="vertical" @finish="query(false)">
          <a-form-item v-for="field in fields" :key="field.id" :label="field.name || field.id"><a-select v-if="analysis?.objectTypes.includes(field.id)" :value="objectTypeValue(field.id)" :options="objectTypes" @change="input = { ...input, [field.id]: $event }" /><ObjectInputValue v-else :field="field" :model-value="input[field.id]" @update:model-value="input = { ...input, [field.id]: $event }" /></a-form-item>
          <a-button html-type="submit" type="primary" :loading="busy">{{ t('queryData') }}</a-button>
        </a-form>
        <template v-if="result"><div v-for="value in result.values" :key="JSON.stringify(value.object)"><small v-if="result.values.length > 1">{{ value.object.name || value.object.id }}</small><ObjectMemberValue :value="value.value" :metadata="value.metadata" :member="entry?.member" :presentation="entry?.presentation" default-expanded /></div></template>
      </template>
      <a-alert v-if="failed" type="warning" show-icon :message="t('dataQueryFailed')"><template #action><a-button type="link" @click="retry">{{ t('retry') }}</a-button></template></a-alert>
      <a-alert v-if="result?.limited" type="info" :message="t('limited')" />
      <a-button v-if="access && mode === 'history' && limited" :loading="busy" @click="more">{{ t('showMore') }}</a-button>
      <a-spin v-if="busy && !result" />
    </section>
  </JlDrawerShell>
</template>
<style scoped>
.object-data-explorer { display:grid; gap:16px; min-width:0; }
.object-data-explorer__tools { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
.object-data-explorer__tools label { display:inline-flex; align-items:center; gap:6px; }
.object-data-explorer__tools .ant-input-number { width:100px; }
.object-data-explorer :deep(.ant-segmented) { justify-self:start; }
.object-data-explorer time,.object-data-explorer small { color:var(--ant-color-text-secondary, var(--ink-2)); }
</style>
