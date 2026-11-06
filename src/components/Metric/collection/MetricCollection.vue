<template>
  <section class="metric-collection">
    <a-tag v-if="selection" closable @close="emit('clearSelection')">{{ t('templateFilter') }}</a-tag>
    <header class="metric-collection__tools">
      <a-dropdown :trigger="['click']" class="metric-collection__output-menu"><button type="button" class="metric-collection__heading"><AIcon :type="activeGroup ? metricOutputPresentation(activeGroup.output,{labels:activeGroup.stateLabels}).icon : 'UnorderedListOutlined'" /><span>{{ activeGroup?.output.label || activeGroup?.output.metricId || t('all') }}<small v-if="activeGroup">{{ activeGroup.templateName }}</small></span><AIcon type="DownOutlined" /></button><template #overlay><a-menu :selected-keys="[group || '']" :aria-label="t('output')" @click="selectGroup($event.key ? String($event.key) : undefined)">
        <a-menu-item key=""><SelectOption :label="t('all')" icon="UnorderedListOutlined" :description="t('readOnly')" /></a-menu-item>
        <a-menu-item v-for="item in result?.groups || []" :key="item.id"><SelectOption :label="item.output.label || item.output.metricId" :icon="metricOutputPresentation(item.output,{labels:item.stateLabels}).icon" :description="item.templateName" /></a-menu-item>
      </a-menu></template></a-dropdown>
      <div class="metric-collection__actions">
      <a-dropdown v-if="activeGroup && activeGroup.operations.length > 1" :trigger="['click']"><a-button type="text" size="small"><AIcon :type="operationIcon(operation)" />{{ t(operation) }} <AIcon type="DownOutlined" /></a-button><template #overlay><a-menu :selected-keys="[operation]" @click="selectOperation($event.key as ReadOperation)"><a-menu-item v-for="item in activeGroup.operations" :key="item"><SelectOption :label="t(item)" :icon="operationIcon(item)" :description="t(item === 'collection' ? 'readOnly' : 'operationHint')" /></a-menu-item></a-menu></template></a-dropdown>
      <a-tooltip v-if="group && canCompare" :title="t(view === 'list' ? 'bars' : 'list')"><a-button type="text" size="small" :aria-label="t(view === 'list' ? 'bars' : 'list')" @click="changeView(view === 'list' ? 'bars' : 'list')"><AIcon :type="view === 'list' ? 'BarChartOutlined' : 'AppstoreOutlined'" /></a-button></a-tooltip>
      <a-button v-if="scope.tree" type="text" size="small" :class="{ 'is-active':descendants }" :aria-pressed="descendants" @click="changeDepth(!descendants)"><AIcon type="BranchesOutlined" />{{ t(descendants ? 'descendants' : 'direct') }}</a-button>
      <a-tooltip :title="t('refresh')"><a-button type="text" size="small" :loading="loading" :aria-label="t('refresh')" @click="refresh"><AIcon type="ReloadOutlined" /></a-button></a-tooltip>
      </div>
    </header>
    <a-alert v-if="error" type="error" show-icon :message="t('failed')" :description="error"><template #action><a-button @click="refresh">{{ t('retry') }}</a-button></template></a-alert>
    <div v-if="result" class="metric-collection__scope">
      <strong>{{ t('scope', { count:result.visibleMembers }) }}</strong>
      <template v-if="result.coverage"><span>{{ t('configured', { count:result.coverage.configuredMembers }) }}</span><span v-if="result.coverage.unconfiguredMembers">{{ t('unconfigured', { count:result.coverage.unconfiguredMembers }) }}</span></template>
      <a-tooltip :title="[t('readOnly'),fallback ? t('unsupported') : ''].filter(Boolean).join(' · ')"><time>{{ t('refreshed', { time:new Date(result.readTime).toLocaleTimeString(String(locale)) }) }}</time></a-tooltip>
    </div>
    <div v-if="result?.summary" class="metric-collection__summary">
      <template v-if="operation === 'distribution'">
        <div v-for="(count, key) in result.summary.distribution" :key="key" class="metric-collection__state">
          <IconValueView v-if="appearance(String(key)).icon" :value="appearance(String(key)).icon" :size="16" indicator :fallback-text="stateName(String(key))" />
          <span>{{ stateName(String(key)) }}</span><b>{{ count }}</b><i :style="{ width:`${100 * count / Math.max(1,result.summary.valid)}%`, background:appearance(String(key)).color }" />
        </div>
      </template>
      <div v-else class="metric-collection__number"><span>{{ t(operation) }} · {{ activeGroup?.output.label || activeGroup?.output.metricId }}</span><strong>{{ formatMetricValue(result.summary.value,activeGroup?.displaySettings,activeGroup?.output) }}<small>{{ activeGroup?.output.unit }}</small></strong></div>
      <small>{{ t('valid', { valid:result.summary.valid, total:result.summary.valid + result.summary.missing }) }} · {{ t('missing', { count:result.summary.missing }) }}</small>
    </div>
    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !result?.data.length && !error" :description="t('empty')" />
      <ResponsiveGrid v-else min="min(100%, 280px)" :gap="12" class="metric-collection__grid">
        <EntityCard v-for="record in result?.data || []" :key="record.key" :title="record.target.name || record.target.id" class="metric-collection__card" :class="{ 'is-unconfigured':record.kind === 'unconfigured' }">
          <template #icon><AIcon :type="scope.icon" /></template>
          <template #subtitle><span :title="record.target.id">{{ record.target.path || scope.label }}</span></template>
          <template #body>
            <div v-if="record.kind === 'unconfigured'" class="metric-collection__placeholder"><AIcon type="AppstoreAddOutlined" /><span>{{ t('notConfigured') }}</span></div>
            <template v-else>
              <div class="metric-collection__metric"><span>{{ record.output.label || record.output.metricId }}</span><small>{{ record.configName || groupFor(record)?.templateName }}</small></div>
              <MetricStateDuration v-if="record.value?.state" :value="record.value" :labels="groupFor(record)?.stateLabels" :disabled="record.configState === 'disabled'" compact />
              <MetricValueView v-else :value="record.value" :output="record.output" :unit="record.output.unit" :disabled="record.configState === 'disabled'" :settings="groupFor(record)?.displaySettings" :labels="groupFor(record)?.stateLabels" compact summary hide-quality />
              <div v-if="record.highlights?.length" class="metric-collection__highlights"><div v-for="item in record.highlights" :key="item.output.metricId"><span>{{ item.output.label || item.output.metricId }}</span><MetricValueView :value="item.value" :output="item.output" :unit="item.output.unit" :settings="groupFor(record)?.displaySettings" :disabled="record.configState === 'disabled'" inline hide-quality /></div></div>
              <div v-if="view === 'bars' && typeof record.value?.value === 'number' && groupFor(record)?.policy?.semantic !== 'state' && record.configState !== 'disabled'" class="metric-collection__bar"><i :style="{ width:`${barWidth(record)}%` }" /></div>
            </template>
          </template>
          <template #footer>
            <span v-if="record.kind === 'unconfigured'">{{ t('member') }}</span>
            <template v-else><span>{{ record.configState === 'disabled' ? t('stopped') : !record.value ? t('noData') : '' }}</span><a-button type="link" size="small" @click="selected = record">{{ t('detail') }}<AIcon type="RightOutlined" /></a-button></template>
          </template>
        </EntityCard>
      </ResponsiveGrid>
    </a-spin>
    <footer v-if="result?.total" class="metric-collection__footer"><small v-if="view === 'bars'">{{ t('pageHint') }}</small><a-pagination :current="page" :total="result.total" :page-size="20" :show-size-changer="false" @change="changePage" /></footer>
    <JlDrawerShell :open="!!selected" :title="selected?.configName || detail.template.value?.name" :sub="selected?.target.name" :width="860" @update:open="!$event && (selected = undefined)">
      <a-alert v-if="detail.error.value" type="error" :message="detail.error.value" />
      <a-spin :spinning="detail.loading.value"><MetricResult v-if="selected && detail.template.value" :key="selected.key" :reference="{ configId:selected.configId, outputId:detail.outputId.value, targetType:selected.target.type, targetId:selected.target.id }" :context="{ ownerType:selected.ownerType, ownerId:selected.ownerId, targetType:selected.target.type, targetId:selected.target.id, editable:false }" :output="detail.output.value" :template="detail.template.value" @select-output="detail.selectOutput" /></a-spin>
    </JlDrawerShell>
  </section>
</template>
<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SelectOption from '../../SelectOption/index.vue'
import IconValueView from '../../IconValue/IconValueView.vue'
import JlDrawerShell from '../../JlDrawerShell/index.vue'
import EntityCard from '../../EntityCard/index.vue'
import ResponsiveGrid from '../../ResponsiveGrid/index.vue'
import MetricValueView from '../MetricValue.vue'
import MetricStateDuration from '../MetricStateDuration.vue'
import MetricResult from '../MetricResult.vue'
import { formatMetricValue } from '../extensions/presentationSettings'
import { metricOutputPresentation } from '../outputPresentation'
import { isStateOutput, stateAppearance, stateLabel } from '../stateIntervals'
import { useMetricCollection } from './useMetricCollection'
import { useMetricCollectionDetail } from './useMetricCollectionDetail'
import { collectionMessages } from './messages'
import type { MetricContext } from '../types'
import type { MetricCollectionRow, MetricCollectionSelection, MetricReadScopeOption, ReadOperation } from './types'
const props = defineProps<{ context:MetricContext; scope:MetricReadScopeOption; selection?:MetricCollectionSelection }>()
const emit = defineEmits<{(event:'clearSelection'):void}>()
const { t, locale } = useI18n({ useScope:'local', messages:collectionMessages })
const { result, loading, error, group, operation, page, descendants, view, fallback, activeGroup, selected, refresh, selectGroup, selectOperation, changePage, changeDepth, changeView } = useMetricCollection(toRef(props,'context'), toRef(props,'scope'), undefined, toRef(props,'selection'))
const detail = useMetricCollectionDetail(selected)
const canCompare = computed(() => !!activeGroup.value && !isStateOutput(activeGroup.value.output,activeGroup.value.stateLabels) && activeGroup.value.output.valueType !== 'boolean')
const groupFor = (row:MetricCollectionRow) => result.value?.groups.find(item => item.id === row.group)
const rawState = (key:string) => activeGroup.value?.stateLabels?.find(item => String(item.value) === key)?.value ?? key
const appearance = (key:string) => stateAppearance(rawState(key), activeGroup.value?.stateLabels)
const stateName = (key:string) => stateLabel(rawState(key), activeGroup.value?.stateLabels || [], String(locale.value))
const maxValue = computed(() => Math.max(1, ...(result.value?.data || []).map(row => row.kind !== 'unconfigured' && row.configState !== 'disabled' && typeof row.value?.value === 'number' ? Math.abs(row.value.value) : 0)))
const barWidth = (row:MetricCollectionRow) => typeof row.value?.value === 'number' ? Math.abs(row.value.value) / maxValue.value * 100 : 0
const operationIcon = (value:ReadOperation) => ({ collection:'UnorderedListOutlined', distribution:'PieChartOutlined', average:'CalculatorOutlined', min:'ArrowDownOutlined', max:'ArrowUpOutlined', sum:'PlusOutlined', ratio:'PercentageOutlined' })[value]
</script>
<style scoped>
.metric-collection { min-width:0; padding:var(--space-4,16px) }
.metric-collection__tools { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 20px }
.metric-collection__heading { display:flex; align-items:center; gap:10px; background:none; border:0; padding:0; min-width:0; text-align:left; cursor:pointer; color:var(--ink-1); max-width:100%; font:inherit }
.metric-collection__heading>span:not(.anticon) { display:grid; gap:3px; min-width:0; font-size:15px; font-weight:600; overflow-wrap:anywhere }
.metric-collection__heading small { font-size:11px; font-weight:400; color:var(--ink-3) }
.metric-collection__heading>.anticon { color:var(--ink-3); font-size:12px }
.metric-collection__actions { display:flex; align-items:center; flex-wrap:wrap; gap:4px; margin-left:auto }
.metric-collection__actions :deep(.ant-btn) { color:var(--ink-2) }
.metric-collection__actions :deep(.is-active) { color:var(--accent) }
.metric-collection__heading:focus-visible { outline:2px solid var(--accent); outline-offset:4px; border-radius:4px }
.metric-collection__scope { display:flex; flex-wrap:wrap; gap:6px 12px; color:var(--ink-3); font-size:11px; padding:8px 0 12px; margin-bottom:12px; border-bottom:1px solid var(--line) }
.metric-collection__scope time { margin-left:auto }
.metric-collection__scope strong { font-weight:500; color:var(--ink-2) }
.metric-collection__summary { display:flex; flex-wrap:wrap; gap:16px; align-items:center; padding:0 0 16px; margin-bottom:16px; border-bottom:1px solid var(--line) }
.metric-collection__summary>small { color:var(--ink-3); margin-left:auto }
.metric-collection__state { position:relative; display:flex; align-items:center; gap:8px; min-width:100px; padding-bottom:12px }
.metric-collection__state i { position:absolute; bottom:0; left:0; height:3px; border-radius:2px }
.metric-collection__number { display:flex; align-items:center; gap:20px }
.metric-collection__number strong { font-size:28px; font-variant-numeric:tabular-nums }
.metric-collection__number small { font-size:12px; color:var(--ink-3); margin-left:6px }
.metric-collection__card { min-height:220px }
.metric-collection__card :deep(.ec-subtitle) { display:block; font-size:11px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis }
.metric-collection__card :deep(.ec-body) { border:0; padding:4px 0 12px }
.metric-collection__card :deep(.ec-footer) { color:var(--ink-3); font-size:11px; min-height:34px }
.metric-collection__metric { display:flex; flex-direction:column; gap:4px; font-size:13px; color:var(--ink-2); margin-bottom:8px }
.metric-collection__metric small { color:var(--ink-3); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.metric-collection__placeholder { display:flex; align-items:center; gap:8px; min-height:96px; color:var(--ink-3); font-size:12px }
.metric-collection__bar { height:4px; background:var(--bg-2); border-radius:2px; overflow:hidden; margin-top:12px }
.metric-collection__bar i { display:block; height:100%; background:var(--accent) }
.metric-collection__highlights { display:grid; gap:6px; margin-top:12px; font-size:12px; color:var(--ink-3) }
.metric-collection__highlights>div { display:flex; justify-content:space-between; align-items:center; gap:12px }
.metric-collection__footer { display:flex; align-items:center; justify-content:flex-end; gap:16px; padding-top:16px }
.metric-collection__footer small { color:var(--ink-3); margin-right:auto }
</style>
