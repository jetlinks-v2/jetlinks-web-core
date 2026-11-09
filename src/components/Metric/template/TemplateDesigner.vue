<template>
  <div ref="root" class="template-designer" :style="{ '--properties-width': `${panelWidth}px` }" :class="{ 'is-collapsed': collapsed, 'is-narrow': narrow, 'show-properties': propertiesVisible }">
    <div class="template-designer__flow">
      <nav class="template-designer__create" :aria-label="t('templateProperties')">
        <a-button v-for="kind in addKinds" :key="kind" size="small" @click="addNode(kind)"><AIcon type="PlusOutlined" />{{ t(kind === 'input' ? 'inputs' : kind === 'rule' ? 'calculation' : 'outputs') }}</a-button>
        <a-button v-if="pickSource && addKinds.includes('input')" size="small" :loading="importing" @click="importInput"><AIcon type="ImportOutlined" />{{ t('inputImport') }}</a-button>
        <span class="template-designer__counts"><button v-for="kind in ['input','rule','output'] as const" :key="kind" type="button" @click="locateKind(kind)">{{ t(kind === 'input' ? 'inputs' : kind === 'rule' ? 'calculation' : 'outputs') }} {{ nodes.filter(node=>node.kind===kind).length }}</button></span>
      </nav>
      <a-alert v-if="importError" type="error" show-icon :message="t('inputImportFailed')" closable @close="importError = false" />
      <TemplateGraph ref="graph" :template="displayView" :selected="selection" :preview="referenceNode" :calculators="calculators" :add-kinds="addKinds" :simulation-preview="trial?.preview" @select="selectNode" @add="addNode" @background="selectTemplate" @request-remove="requestRemove">
        <template v-if="trial" #clock><TemplateSimulationClock :trial="trial" /></template>
        <template v-if="trial" #input-sample="{ node }"><TemplateSimulationInput :template="displayView" :input="displayView.inputDefinitions[node.index]" :snapshot="trial.preview.nodes[nodeKey(node)]" :trial="trial" :disabled="disabled || invalid" @details="showSamples(node, $event)" /></template>
        <template v-if="trial" #node-action="{node}"><TemplateSimulationInspect :template="displayView" :node="node" :entry="trial.preview.nodes[nodeKey(node)]?.entry" /></template>
      </TemplateGraph>
    </div>
    <PanelResizeHandle v-if="propertiesVisible && !narrow" v-model="panelWidth" :container="root" :aria-label="t('resizeProperties')" />
    <aside class="template-designer__panel" :aria-label="t('properties')">
      <header class="template-designer__panel-head">
        <a-button v-if="propertiesVisible" type="text" size="small" :disabled="invalid" :aria-label="t('templateProperties')" :title="t('templateProperties')" @click="showTemplate"><AIcon type="AppstoreOutlined" /></a-button>
        <span v-if="propertiesVisible">{{ selection ? t(selection.kind === 'input' ? 'inputs' : selection.kind === 'rule' ? 'calculation' : 'outputs') : t('templateProperties') }}</span>
        <a-button class="template-designer__toggle" type="text" size="small" :aria-label="t(propertiesVisible ? 'collapseProperties' : 'expandProperties')" :title="t(propertiesVisible ? 'collapseProperties' : 'expandProperties')" :aria-expanded="propertiesVisible" :aria-controls="panelId" @click="togglePanel"><AIcon :type="propertiesVisible ? 'MenuFoldOutlined' : 'MenuUnfoldOutlined'" /></a-button>
      </header>
      <div v-show="propertiesVisible" :id="panelId" class="template-designer__panel-content">
        <div v-if="selection" class="template-designer__navigation">
          <a-button type="text" size="small" :disabled="position <= 0 || invalid" :aria-label="t('previousNode')" :title="t('previousNode')" @click="move(-1)"><AIcon type="LeftOutlined" /></a-button>
          <span>{{ position + 1 }} / {{ nodes.length }}</span>
          <a-button type="text" size="small" :disabled="position >= nodes.length - 1 || invalid" :aria-label="t('nextNode')" :title="t('nextNode')" @click="move(1)"><AIcon type="RightOutlined" /></a-button>
        </div>
        <TemplateNodeEditor v-if="selection" :key="`${nodeKey(selection)}-${editorVersion}`" :template="view" :node="selection" :disabled="disabled" :published="published" :calculators="calculators" @patch="patch" @invalid="invalid = $event" @messages="setMessages" />
        <section v-if="selection?.kind === 'input' && pickSource?.sourceOptions?.length" class="template-designer__setting">
          <h4>{{ t('inputSourceHints') }}</h4>
          <a-select mode="multiple" :value="view.options?.inputHints?.[view.inputDefinitions[selection.index].id]?.sources || []" :options="pickSource.sourceOptions" :disabled="disabled || published" :placeholder="t('inputSourceHints')" style="width:100%" @change="setHint($event as string[])" />
          <small class="template-designer__category-hint">{{ t('inputSourceHintsHelp') }}</small>
        </section>
        <div v-if="!selection" class="template-designer__settings">
          <section class="template-designer__setting">
            <h4><AIcon type="AppstoreOutlined" />{{ t('templateCategory') }}</h4>
            <Editable class="template-designer__category" type="select" :value="view.options?.category || ''" :component-props="{ disabled:disabled || categoriesLoading || !!categoryError, bordered:false, defaultOpen:true, 'aria-label':t('templateCategory'), options:categoryOptions }" @change="setCategory($event as string)" />
            <small class="template-designer__category-hint">{{ t('categoryDictionaryHint') }}</small>
            <div v-if="categoryError" class="template-designer__category-error" role="status">{{ t('categoryLoadFailed') }}<a-button type="link" size="small" :loading="categoriesLoading" @click="emit('reload-categories')">{{ t('retry') }}</a-button></div>
          </section>
          <section class="template-designer__setting">
            <h4><AIcon type="FileTextOutlined" />{{ t('templateDescription') }}</h4>
            <I18nTextEditable :value="String(view.options?.description || '')" field="description" :label="t('describePurpose')" :i18n-messages="templateMessages(view)" :disabled="disabled" @change="setText('description', $event)" />
          </section>
          <section class="template-designer__setting">
            <h4><AIcon type="GlobalOutlined" />{{ t('scopeAndReference') }}</h4>
            <I18nTextEditable :value="String(view.options?.notes || '')" field="notes" :label="t('scopeAndReference')" :i18n-messages="templateMessages(view)" :i18n-max-length="2000" :disabled="disabled" @change="setText('notes', $event)" />
          </section>
          <details class="template-designer__setting"><summary><AIcon type="SlidersOutlined" />{{ t('parameterSettings') }}</summary><TemplateParameters :template="view" :disabled="disabled" :published="published" @update:template="update" /></details>
          <details class="template-designer__setting"><summary><AIcon type="AppstoreOutlined" />{{ t('displaySettings') }}</summary><TemplatePresentation :template="view" :disabled="disabled" @update:template="update" /></details>
        </div>
        <footer v-if="selection && !disabled" class="template-designer__node-actions">
          <a-button type="text" size="small" :title="t('revertNode')" @click="revert"><AIcon type="UndoOutlined" />{{ t('revertNode') }}</a-button>
          <a-dropdown v-if="!published || selection.kind === 'rule'" :trigger="['click']" :disabled="invalid">
            <a-button type="text" size="small" :disabled="invalid" :aria-label="t('moreSettings')"><AIcon type="EllipsisOutlined" /></a-button>
            <template #overlay><a-menu><a-menu-item @click="requestRemove"><AIcon type="DeleteOutlined" /> {{ t('remove') }}</a-menu-item></a-menu></template>
          </a-dropdown>
        </footer>
        <TemplateSimulation v-if="trial" ref="simulationPanel" :template="displayView" :trial="trial" :selected="selection" :error="simulationError" :disabled="disabled || invalid" @clear-selection="selectTemplate"><template #advancedTools><slot name="advancedTools" /></template></TemplateSimulation>
      </div>
    </aside>
    <a-button class="template-designer__mobile-back" type="text" size="small" :aria-label="t('backToGraph')" @click="hidePanel"><AIcon type="ArrowLeftOutlined" />{{ t('backToGraph') }}</a-button>
  </div>
</template>
<script setup lang="ts">
import { computed, inject, nextTick, onScopeDispose, provide, ref, toRef, useId, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import I18nTextEditable from '../../I18n/I18nTextEditable.vue'
import Editable from '../../Editable/index.vue'
import PanelResizeHandle from '../../PanelResizeHandle/index.vue'
import type { TemplateCategory } from './templateCatalog'
import { localizedTemplate, templateMessages } from './text'
import TemplateGraph from './TemplateGraph.vue'
import TemplateSimulationInspect from './TemplateSimulationInspect.vue'
import TemplateNodeEditor from './TemplateNodeEditor.vue'
import TemplateParameters from './TemplateParameters.vue'
import TemplatePresentation from './TemplatePresentation.vue'
import { nodeKey, type TemplateNode } from './designer'
import { useTemplateDesigner } from './useTemplateDesigner'
import { useTemplateNodeRemoval } from './useTemplateNodeRemoval'
import { templateReferenceKey } from './templateReference'
import TemplateSimulation from './TemplateSimulation.vue'
import TemplateSimulationInput from './TemplateSimulationInput.vue'
import TemplateSimulationClock from './TemplateSimulationClock.vue'
import type { TemplateSimulationState } from './useTemplateSimulation'
import { metricMessages } from '../messages'
import { metricCalculatorsKey } from '../calculatorContext'
import type { MetricCalculatorDescriptor, MetricContext, MetricSourcePicker, MetricTemplate } from '../types'
const props = defineProps<{ template: MetricTemplate; disabled: boolean; published?: boolean; calculators?: MetricCalculatorDescriptor[]; categories?: TemplateCategory[]; categoriesLoading?: boolean; categoryError?: string; trial?:TemplateSimulationState; simulationError?:string; pickSource?:MetricSourcePicker; sourceContext?:MetricContext }>()
const emit = defineEmits<{ (event: 'update:template', value: MetricTemplate): void; (event: 'editing', value: boolean): void; (event:'reload-categories'):void }>()
const { t, locale } = useI18n({ useScope: 'local', messages: metricMessages })
const inheritedCalculators = inject(metricCalculatorsKey, undefined)
// 编辑、图节点和试算解释共享同一语言目录，不在浮层重复请求或猜测字段名。
provide(metricCalculatorsKey, computed(() => props.calculators || inheritedCalculators?.value || []))
const { view, selection, nodes, position, invalid, editorVersion, select, move, patch, add, remove, revert, setMessages, update } = useTemplateDesigner(toRef(props, 'template'), toRef(props, 'disabled'), value => emit('update:template', value), (previous,next) => {
  props.trial?.renameInput(previous,next)
})
const { requestRemove } = useTemplateNodeRemoval(() => {
  const node = selection.value
  const item = node && (node.kind === 'input' ? view.value.inputDefinitions : node.kind === 'rule' ? view.value.definitions : view.value.outputs)[node.index]
  return { node:item ? node : undefined,identity:node && item ? JSON.stringify([node.kind,node.kind === 'output' ? item.metricId : item.id,node.kind === 'output' ? item.property : undefined]) : undefined,disabled:props.disabled,invalid:invalid.value,published:props.published }
},remove,t)
const displayView = computed(() => localizedTemplate(view.value, String(locale.value)))
const categoryOptions = computed(() => {
  const options = [{ value:'', label:t('otherCategory') }, ...props.categories || []]
  const current = view.value.options?.category
  // 字典项被删除或临时不可用时保留原分类，只有用户主动选择才改写。
  if (current && !options.some(item => item.value === current)) options.push({ value:current, label:`${current} · ${t('categoryUnavailable')}` })
  return options.map(item => ({ ...item, icon:'FolderOutlined', description:item.value || t('otherCategory') }))
})
const addKinds = computed<TemplateNode['kind'][]>(() => props.disabled || invalid.value ? [] : props.published ? ['rule'] : view.value.definitions.length ? ['input', 'rule', 'output'] : ['input', 'rule'])
const root = ref<HTMLElement>()
const panelWidth = ref(360)
const graph = ref<InstanceType<typeof TemplateGraph>>()
const referenceId = ref<string>()
function findReference(id?: string): TemplateNode | undefined {
  if (!id) return
  const input = view.value.inputDefinitions.findIndex(item => item.id === id)
  if (input >= 0) return { kind:'input', index:input }
  const rule = view.value.definitions.findIndex(item => item.id === id)
  if (rule >= 0) return { kind:'rule', index:rule }
}
const referenceNode = computed(() => findReference(referenceId.value))
provide(templateReferenceKey, {
  preview: id => { referenceId.value = id },
  locate: async id => {
    const node = findReference(id)
    if (!node || !select(node)) return
    referenceId.value = undefined
    if (narrow.value) hidePanel()
    await nextTick()
    graph.value?.locate(node)
  },
})
const { width } = useElementSize(root)
const narrow = computed(() => width.value > 0 && width.value < 680)
const collapsed = ref(false)
const mobileProperties = ref(false)
const propertiesVisible = computed(() => !collapsed.value && (!narrow.value || mobileProperties.value))
const panelId = `metric-properties-${useId()}`
const sourceSession = useId()
const simulationPanel = ref<InstanceType<typeof TemplateSimulation>>()
// 选中节点不是阻塞状态；只有未提交的错误文本阻止保存和离开设计器。
watch(invalid, value => emit('editing', value), { immediate: true, flush: 'sync' })
function revealPanel() { collapsed.value = false; mobileProperties.value = true }
function hidePanel() { collapsed.value = true; mobileProperties.value = false }
function togglePanel() { if (propertiesVisible.value) hidePanel(); else revealPanel() }
function selectNode(node: TemplateNode) { if (select(node)) revealPanel() }
async function showSamples(node:TemplateNode, editValue = false) { if (select(node)) { revealPanel(); await nextTick(); simulationPanel.value?.focusSamples(editValue) } }
function selectTemplate() { select() }
function showTemplate() { if (select()) revealPanel() }
function addNode(kind: TemplateNode['kind'], _element?: HTMLButtonElement, source?: TemplateNode) {
  if (addKinds.value.includes(kind) && add(kind, source)) revealPanel()
}
function locateKind(kind:TemplateNode['kind']) { const node = nodes.value.find(item=>item.kind === kind); if (node) selectNode(node); else addNode(kind) }
function setHint(sources:string[]) {
  if (props.disabled || props.published || selection.value?.kind !== 'input') return
  const id = view.value.inputDefinitions[selection.value.index].id
  const inputHints = { ...view.value.options?.inputHints }
  if (sources.length) inputHints[id] = { sources }
  else delete inputHints[id]
  update({ ...view.value,options:{ ...view.value.options,inputHints } })
}
const importing = ref(false), importError = ref(false)
let importVersion = 0
watch([() => props.template.id,() => props.template.version],() => { importVersion++; importing.value = false; props.pickSource?.cancel?.() })
onScopeDispose(() => { importVersion++; props.pickSource?.cancel?.() })
/** 导入只复制类型声明，不把样例对象身份或运行映射写入模板。 */
async function importInput() {
  if (!props.pickSource || importing.value || !addKinds.value.includes('input')) return
  const version = ++importVersion
  importing.value = true; importError.value = false
  try {
    const context = props.sourceContext || { ownerType:'device',ownerId:'',targetType:'device' }
    const result = await props.pickSource({ context,input:{id:'input'},purpose:'declaration',session:`${sourceSession}:${props.template.version}` })
    if (!result || version !== importVersion || !addKinds.value.includes('input')) return
    const declaration = result.declaration || (await props.pickSource.describe?.(context,{ input:result.mapping }))?.input
    if (!declaration?.valueType || 'error' in declaration && declaration.error) throw new Error('Missing source schema')
    if (version !== importVersion || !addKinds.value.includes('input')) return
    if (add('input')) { patch({ name:result.declaration?.name || result.label,valueType:declaration.valueType,...(declaration.unit ? { unit:declaration.unit } : {}) }); revealPanel() }
  } catch { if (version === importVersion) importError.value = true }
  finally { if (version === importVersion) importing.value = false }
}
function setText(field: 'description' | 'notes', value: { value: string; i18nMessages: Record<string, Record<string, string>> }) {
  update({ ...view.value, options: { ...view.value.options, [field]: value.value, i18nMessages: value.i18nMessages } })
}
function setCategory(value: string) { if (!props.categoriesLoading && !props.categoryError) update({ ...view.value, options: { ...view.value.options, category:value } }) }
</script>
<style scoped>
.template-designer { display:grid; grid-template-columns:minmax(0,1fr) var(--properties-width,360px); flex:1; min-width:0; min-height:0; width:100%; overflow:hidden; border:1px solid var(--line); border-radius:var(--r-3,8px); box-sizing:border-box }
.template-designer.is-collapsed { grid-template-columns:minmax(0,1fr) 40px }
.template-designer__flow { display:flex; flex-direction:column; gap:8px; min-width:0; min-height:0; overflow:hidden; padding:12px 16px; background:var(--bg-sunken,#f7f8fa) }
.template-designer__create { display:flex; align-items:center; flex-wrap:wrap; gap:6px; flex:none }
.template-designer__counts { display:flex; flex-wrap:wrap; margin-left:auto; gap:8px }
.template-designer__counts button { border:0; background:transparent; padding:2px 0; color:var(--ink-3); font-size:11px; cursor:pointer }
.template-designer__panel { grid-column:2; grid-row:1; display:flex; flex-direction:column; min-width:0; min-height:0; border-left:1px solid var(--line); background:var(--panel-background) }
.template-designer__panel-head { display:flex; align-items:center; flex:none; gap:6px; height:44px; padding:0 8px; border-bottom:1px solid var(--line); color:var(--ink-3); font-size:12px }
.template-designer__panel-head > span { flex:1 }
.template-designer__panel-head :deep(.ant-btn) { padding:0 4px; color:var(--ink-3) }
.template-designer__toggle { margin-left:auto }
.template-designer__panel-content { min-height:0; overflow:auto; padding:12px 16px; overflow-wrap:anywhere }
.template-designer__navigation { display:flex; justify-content:space-between; align-items:center; gap:8px; height:28px; margin-bottom:8px; color:var(--ink-3); font-size:12px }
.template-designer__setting { padding-bottom:16px; margin:0 0 16px; border-bottom:1px solid var(--line) }
.template-designer__setting h4,.template-designer__setting summary { display:flex; align-items:center; gap:8px; margin:0 0 8px; color:var(--ink-3); font-size:12px; font-weight:400; line-height:24px }
.template-designer__setting summary { cursor:pointer }
.template-designer__category { min-width:120px; color:var(--ink-2) }
.template-designer__category-hint { display:block; margin-top:4px; color:var(--ink-3); font-size:12px }
.template-designer__category-error { color:var(--ink-3); font-size:12px }
.template-designer__setting summary::after { content:'›'; margin-left:auto; transform:rotate(0) }
.template-designer__setting[open] > summary::after { transform:rotate(90deg) }
.template-designer__node-actions { display:flex; justify-content:space-between; gap:8px; margin-top:16px; padding-top:8px; border-top:1px solid var(--line) }
.template-designer__node-actions :deep(.ant-btn:not(.ant-btn-dangerous)) { color:var(--ink-3) }
.template-designer__mobile-back { display:none }
.template-designer.is-narrow { grid-template-columns:minmax(0,1fr) 40px }
.template-designer.is-narrow.show-properties { grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(0,1fr) 36px }
.template-designer.is-narrow.show-properties .template-designer__flow { display:none }
.template-designer.is-narrow.show-properties .template-designer__panel { grid-column:1; border-left:0 }
.template-designer.is-narrow.show-properties .template-designer__mobile-back { display:inline-flex; align-items:center; justify-content:center; border-top:1px solid var(--line); border-radius:0; color:var(--ink-3) }
</style>
