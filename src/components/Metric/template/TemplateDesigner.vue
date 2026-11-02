<template>
  <div ref="root" class="template-designer" :class="{ editing: selection }">
    <TemplateGraph :template="view" :selected="selection" @select="selectNode" />
    <div class="template-designer__add">
      <a-button v-for="kind in ['input', 'rule', 'output'] as const" :key="kind" size="small" type="text" :disabled="disabled || invalid" @click="addNode(kind, $event)">
        <AIcon type="PlusOutlined" />{{ t(kind === 'input' ? 'addInput' : kind === 'rule' ? 'addCalculation' : 'addOutput') }}
      </a-button>
    </div>
    <article v-for="(rule, index) in rules" :key="index" class="template-designer__calculation">
      <div class="template-designer__heading">
        <AIcon :type="rule.temporalCondition ? 'ClockCircleOutlined' : rule.aggregation ? 'BarChartOutlined' : 'FunctionOutlined'" />
        <b>{{ nodeLabel(view, { kind: 'rule', index }) }}</b>
        <a-tag>{{ t(calculationKind(rule)) }}</a-tag>
        <a-button type="link" size="small" :disabled="invalid" @click="selectNode({ kind: 'rule', index }, $event.currentTarget as HTMLButtonElement)">{{ t(disabled ? 'review' : 'edit') }}</a-button>
      </div>
      <p v-if="rule.expression"><TemplateFormulaDisplay :template="view" :rule="rule" :expression="rule.expression" /></p>
      <p v-else-if="rule.temporalCondition"><TemplateFormulaDisplay :template="view" :rule="rule" :expression="rule.temporalCondition.enterExpression || ''" /> · {{ rule.temporalCondition.dwell }}</p>
      <p v-else>{{ summary(rule as TemplateRule) }}</p>
      <small v-if="rule.applicabilityExpression">{{ t('applicability') }}：<TemplateFormulaDisplay :template="view" :rule="rule" :expression="rule.applicabilityExpression" /></small>
    </article>
    <a-form v-if="view.parameterDefinitions.length" layout="inline" :disabled="disabled || !!selection" class="template-designer__parameters">
      <a-form-item v-for="parameter in view.parameterDefinitions" :key="parameter.id" :label="parameter.name || parameter.id">
        <MetricParameterValue :parameter="parameter" :model-value="templateParameterDefault(view, parameter)" @update:model-value="setParameter(parameter.id, $event)" />
      </a-form-item>
    </a-form>
    <a-collapse :bordered="false" :disabled="!!selection">
      <a-collapse-panel key="parameters" :header="t('parameterSettings')"><TemplateParameters :template="template" :disabled="disabled || !!selection" @update:template="emit('update:template', $event)" /></a-collapse-panel>
      <a-collapse-panel key="presentation" :header="t('displaySettings')"><TemplatePresentation :template="template" :disabled="disabled || !!selection" @update:template="emit('update:template', $event)" /></a-collapse-panel>
    </a-collapse>
    <JlDrawerShell :open="!!selection" :width="480" :mask="false" :keyboard="true" :title="selection ? nodeLabel(view, selection) || t('unnamedOutput') : ''"
      :sub="selection ? t(selection.kind === 'input' ? 'inputs' : selection.kind === 'rule' ? 'calculation' : 'outputs') : ''" icon="EditOutlined"
      @update:open="close" @after-open-change="afterDrawerChange">
      <template v-if="selection">
        <div class="template-designer__navigation">
          <a-button size="small" :disabled="position <= 0 || invalid" @click="move(-1)">{{ t('previousNode') }}</a-button>
          <span>{{ position + 1 }} / {{ nodes.length }}</span>
          <a-button size="small" :disabled="position >= nodes.length - 1 || invalid" @click="move(1)">{{ t('nextNode') }}</a-button>
        </div>
        <TemplateNodeEditor :key="nodeKey(selection)" :template="view" :node="selection" :disabled="disabled" @patch="patch" @invalid="invalid = $event" />
      </template>
      <template #foot>
        <a-popconfirm v-if="!disabled" :title="t('removeNodeConfirm')" :ok-text="t('remove')" :cancel-text="t('cancel')" @confirm="remove">
          <a-button type="text" danger :disabled="invalid">{{ t('remove') }}</a-button>
        </a-popconfirm>
        <a-button @click="close(false)">{{ t(disabled ? 'close' : 'cancel') }}</a-button>
        <a-button v-if="!disabled" type="primary" :disabled="invalid" @click="finish">{{ t('finishEditing') }}</a-button>
      </template>
    </JlDrawerShell>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import JlDrawerShell from '../../JlDrawerShell/index.vue'
import TemplateGraph from './TemplateGraph.vue'
import TemplateNodeEditor from './TemplateNodeEditor.vue'
import TemplateParameters from './TemplateParameters.vue'
import TemplatePresentation from './TemplatePresentation.vue'
import MetricParameterValue from '../MetricParameterValue.vue'
import TemplateFormulaDisplay from './formula/TemplateFormulaDisplay.vue'
import { nodeKey, nodeLabel, type TemplateNode, type TemplateRule } from './designer'
import { useTemplateDesigner } from './useTemplateDesigner'
import { templateParameterDefault } from './parameters'
import { calculationKind, durationParts } from './window'
import { metricMessages } from '../messages'
import type { MetricTemplate } from '../types'
const props = defineProps<{ template: MetricTemplate; disabled: boolean }>()
const emit = defineEmits<{ (event: 'update:template', value: MetricTemplate): void; (event: 'editing', value: boolean): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const { view, selection, nodes, position, invalid, select, move, cancel, finish, patch, add, remove } = useTemplateDesigner(toRef(props, 'template'), toRef(props, 'disabled'), value => emit('update:template', value))
const rules = computed(() => view.value.definitions as TemplateRule[])
const root = ref<HTMLElement>()
let trigger: HTMLButtonElement | undefined
let returnKey: string | undefined
watch(selection, value => { if (value) returnKey = nodeKey(value); emit('editing', !!value) }, { flush: 'sync' })
function selectNode(node: TemplateNode, element: HTMLButtonElement) { if (!invalid.value) { trigger = element; select(node) } }
function addNode(kind: TemplateNode['kind'], event: Event) { trigger = event.currentTarget as HTMLButtonElement; add(kind) }
function close(open: boolean) { if (!open) cancel() }
function afterDrawerChange(open: boolean) {
  if (open || selection.value) return
  const target = returnKey ? root.value?.querySelector<HTMLButtonElement>(`[data-node="${returnKey}"]`) : undefined
  if (target?.isConnected) target.focus({ preventScroll: true })
  else if (trigger?.isConnected) trigger.focus({ preventScroll: true })
  trigger = undefined; returnKey = undefined
}
function setParameter(id: string, value: unknown) {
  if (!props.disabled && !selection.value) emit('update:template', { ...props.template, parameters: { ...props.template.parameters, [id]: value } })
}
function summary(rule: TemplateRule): string {
  if (calculationKind(rule) === 'statistics') {
    const id = rule.sourceMetric || rule.dependsOn?.[0] || ''
    const label = view.value.inputDefinitions.find(item => item.id === id)?.name || view.value.outputs.find(item => item.metricId === id)?.label || id
    const window = rule.window
    const duration = durationParts(window?.size)
    const durationText = duration ? `${duration.amount} ${t(duration.unit)}` : window?.size || ''
    const range = window?.mode === 'time' ? `${t('recentDuration')} ${durationText}` : window?.mode === 'latestN' ? `${t('window_latestN')} ${window.size || ''} ${t('readings')}` : t('latestReading')
    return `${label} · ${range}${window?.mode === 'none' ? '' : ` · ${t(`statistic_${rule.aggregation || 'avg'}`)}`} · ${t('onEvent')}`
  }
  return rule.calculator?.provider || t('chooseFormulaData')
}
</script>
<style scoped>
.template-designer { min-width:0; width:100%; box-sizing:border-box }
.template-designer__add,.template-designer__heading { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-2,8px) }
.template-designer__add { margin:var(--space-2,8px) 0 var(--space-4,16px) }
.template-designer__calculation { padding:var(--space-3,12px) 0; border-bottom:1px solid var(--line) }
.template-designer__calculation p { margin:var(--space-2,8px) 0; overflow-wrap:anywhere; color:var(--ink-2) }
.template-designer__calculation small { color:var(--ink-3) }
.template-designer__heading .ant-btn { margin-left:auto }
.template-designer__parameters { gap:var(--space-2,8px); padding:var(--space-4,16px) 0 }
.template-designer__parameters :deep(.ant-form-item-control) { max-width:160px }
.template-designer__navigation { display:flex; justify-content:space-between; align-items:center; gap:var(--space-2,8px) }
@media(min-width:1200px) { .template-designer.editing { padding-right:480px } }
</style>
