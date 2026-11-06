<template>
  <section class="formula-editor" :aria-label="t(conditions ? 'conditionExpression' : 'formula')">
    <div class="formula-editor__surface">
      <div class="formula-editor__mode">
        <a-button type="text" size="small" :disabled="disabled || invalid || mode === 'source' && !canVisualize" :aria-label="t(mode === 'visual' ? 'editExpression' : 'backToFormula')" :title="mode === 'source' && !canVisualize ? t('advancedFormulaHint') : undefined" @mousedown.prevent @click="changeMode(mode === 'visual' ? 'source' : 'visual')"><AIcon :type="mode === 'visual' ? 'CodeOutlined' : 'FunctionOutlined'" />{{ t(mode === 'visual' ? 'editExpression' : 'backToFormula') }}</a-button>
      </div>
    <div ref="canvas" class="formula-editor__canvas" @pointerdown.capture="chooseAtPoint" @pointermove="previewAtPoint" @keyup="previewSelection" @pointerleave="referenceContext?.preview()" @focusout="referenceContext?.preview()">
      <div v-show="mode === 'visual'" ref="host" class="formula-editor__field" :style="{ '--formula-font-size': `${fontSize}px` }" @click.self="focusFormula" />
      <a-textarea v-if="mode === 'source'" class="formula-editor__source" :value="sourceText" :disabled="disabled" :bordered="false"
        :aria-label="t('advancedExpression')" @update:value="updateSource" @focus="remember" @click="remember" @keyup="remember" @select="remember" />
      <a-select v-if="referenceSelection || sourcePickerOpen" ref="referencePicker" class="formula-editor__picker" :style="pickerStyle"
        :value="undefined" :open="true" show-search :options="referenceOptions" option-filter-prop="label"
        :placeholder="t('chooseVariable')" :aria-label="t('chooseVariable')" :not-found-content="t('noVariable')"
        :get-popup-container="popupContainer" @select="chooseReference"
        @dropdown-visible-change="referenceVisibilityChanged" @keydown.esc.stop.prevent="closeReferences(true)">
        <template #option="option"><TemplateReference :metric-id="references[option.value]?.metricId"><SelectOption :label="option.label" :icon="option.icon" :description="option.description" /></TemplateReference></template>
      </a-select>
    </div>
    <div class="formula-editor__toolbar">
      <a-button type="text" size="small" :disabled="disabled || mode === 'visual' && !ready || !references.length" :aria-label="t('insertVariable')" @mousedown.prevent @click="openReferences()"><AIcon type="FieldStringOutlined" />{{ t('formulaVariables') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
      <template v-if="mode === 'visual'">
        <a-dropdown :trigger="['click']" :disabled="disabled || !ready">
          <a-button type="text" size="small" :disabled="disabled || !ready" :aria-label="t('insertFunction')" @mousedown.prevent><AIcon type="FunctionOutlined" />{{ t('formulaFunctions') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
          <template #overlay><a-menu @click="chooseFunction"><a-menu-item v-for="name in formulaFunctions" :key="name"><SelectOption icon="FunctionOutlined" :label="t(`formulaFunction_${name}`)" :description="t(`formulaFunctionHint_${name}`)" /></a-menu-item></a-menu></template>
        </a-dropdown>
        <span class="formula-editor__separator" />
        <div class="formula-editor__operators"><a-button v-for="item in operators" :key="item.label" type="text" size="small" :disabled="disabled || !ready" @mousedown.prevent @click="insert(item.latex)">{{ item.label }}</a-button></div>
        <a-dropdown v-if="conditions" :trigger="['click']" :disabled="disabled || !ready">
          <a-button type="text" size="small" :disabled="disabled || !ready" :aria-label="t('conditionOperators')" @mousedown.prevent><AIcon type="BranchesOutlined" /><AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
          <template #overlay><a-menu @click="chooseConditionOperator"><a-menu-item v-for="(item, index) in conditionOperators" :key="index"><SelectOption icon="BranchesOutlined" :label="item.label" :description="t(item.hint)" /></a-menu-item></a-menu></template>
        </a-dropdown>
      </template>
    </div>
    </div>
    <p class="formula-editor__feedback" :class="{ 'formula-editor__error': invalid || loadError }" :role="invalid || loadError ? 'alert' : undefined" :title="feedback">{{ feedback }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MathfieldElement, Selection } from 'mathlive'
import { expressionToFormula, formulaFunctions, formulaMacros, formulaToExpression, referenceMacro, type FormulaReference } from './formula'
import { metricMessages } from '../messages'
import SelectOption from '../../SelectOption/index.vue'
import TemplateReference from './TemplateReference.vue'
import { templateReferenceKey } from './templateReference'
import { useContentFit } from '../../../hooks/useContentFit'

const props = defineProps<{ modelValue: string; references: FormulaReference[]; disabled?: boolean; conditions?: boolean }>()
const emit = defineEmits<{
  (event: 'change', value: { expression: string; metricIds?: string[] }): void
  (event: 'invalid', value: boolean): void
}>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const referenceContext = inject(templateReferenceKey, undefined)
const visualFormula = (source: string) => expressionToFormula(source, props.references, props.conditions)
const initial = visualFormula(props.modelValue)
const mode = ref<'visual' | 'source'>(initial === undefined ? 'source' : 'visual')
const host = ref<HTMLElement>()
const fieldElement = shallowRef<HTMLElement>()
const { fontSize, refresh: fitFormula } = useContentFit({ viewport:host, content:fieldElement, minSize:14, maxSize:20 })
const canvas = ref<HTMLElement>()
const referencePicker = ref<{ focus(): void }>()
const referenceSelection = ref<Selection>()
const sourcePickerOpen = ref(false)
const pickerStyle = ref({ left: '0px', top: '0px' })
const referenceOptions = computed(() => (['data', 'parameter'] as const).map(group => ({
  label: t(group === 'data' ? 'formulaData' : 'formulaParameters'),
  options: props.references.flatMap((item, value) => (item.group || 'data') === group ? [{ value, label:item.label, icon:group === 'parameter' ? 'SlidersOutlined' : 'DatabaseOutlined', description:`${t(group === 'parameter' ? 'parameterReferenceHint' : 'formulaData')} · ${item.key}` }] : []),
})).filter(group => group.options.length))
let replacingReference = false
const sourceText = ref(props.modelValue)
const invalid = ref(false)
const ready = ref(false)
const loadError = ref(false)
const canVisualize = computed(() => visualFormula(sourceText.value) !== undefined)
const feedback = computed(() => invalid.value ? t('incompleteFormula') : loadError.value ? t('formulaLoadFailed') : mode.value === 'source' && !canVisualize.value ? t('advancedFormulaHint') : '')
const operators = [
  { label: '+', latex: '+' }, { label: '−', latex: '-' }, { label: '×', latex: '\\times' }, { label: '÷', latex: '\\frac{#@}{#?}' }, { label: '( )', latex: '\\left(#0\\right)' },
]
const conditionOperators = computed(() => [
  { label:'>', latex:'>', hint:'operatorHint_0' }, { label:'<', latex:'<', hint:'operatorHint_1' }, { label:'≥', latex:'\\ge', hint:'operatorHint_2' }, { label:'≤', latex:'\\le', hint:'operatorHint_3' },
  { label:'=', latex:'=', hint:'operatorHint_4' }, { label:'≠', latex:'\\ne', hint:'operatorHint_5' }, { label:t('conditionAnd'), latex:'\\land', hint:'operatorHint_6' }, { label:t('conditionOr'), latex:'\\lor', hint:'operatorHint_7' }, { label:t('conditionNot'), latex:'\\lnot', hint:'operatorHint_8' },
])
let field: MathfieldElement | undefined
let sourceElement: HTMLTextAreaElement | undefined
let lastEmitted: string | undefined
let disposed = false
let loading = false

function setInvalid(value: boolean) { invalid.value = value; emit('invalid', value) }
function popupContainer(trigger: HTMLElement) { return trigger.parentElement! }
function referenceVisibilityChanged(visible: boolean) {
  if (visible) return
  // MathLive can complete a pending focus after the picker opened. Explicit
  // pointer actions in the formula already discard the saved selection.
  if (referenceSelection.value && document.activeElement === field) referencePicker.value?.focus()
  else closeReferences()
}
function closeReferences(focus = false) {
  referenceSelection.value = undefined
  sourcePickerOpen.value = false
  if (focus) { if (mode.value === 'source') sourceElement?.focus(); else field?.focus() }
}
function focusFormula() {
  if (field && !field.getValue('latex') && props.references.length && !props.disabled) openReferences()
  else field?.focus()
}
/** Keep MathLive's native range while the select temporarily owns keyboard focus. */
async function openReferences(bounds?: DOMRect, selection?: Selection, replace = false) {
  if (disposed || props.disabled || !props.references.length || mode.value === 'visual' && !field) return
  const area = canvas.value!.getBoundingClientRect()
  const anchor = bounds || (mode.value === 'visual' ? field?.getElementInfo(field.position)?.bounds : undefined)
  pickerStyle.value = {
    left: `clamp(0px, ${(anchor?.left ?? area.left) - area.left}px, max(0px, calc(100% - 260px)))`,
    top: `${Math.max(0, (anchor?.bottom ?? area.bottom) - area.top) + 4}px`,
  }
  if (mode.value === 'source') sourcePickerOpen.value = true
  else if (field) {
    const current = selection || field.selection
    referenceSelection.value = { ...current, ranges: current.ranges.map(([start, end]) => [start, end]) }
    replacingReference = replace
    field.blur()
  }
  await nextTick()
  referencePicker.value?.focus()
}
function chooseAtPoint(event: MouseEvent) {
  if (!field || props.disabled || !props.references.length || event.button !== 0 || !event.composedPath().includes(field)) return
  closeReferences()
  // A variable click belongs to the picker. Do not start MathLive's deferred focus.
  const open = (bounds?: DOMRect, selection?: Selection, replace = false) => {
    event.preventDefault(); event.stopPropagation()
    openReferences(bounds, selection, replace)
  }
  if (!field.getValue('latex')) { open(); return }
  // Bias selects the complete native atom, including macros inside fractions/functions.
  const start = field.getOffsetFromPoint(event.clientX, event.clientY, { bias: -1 })
  const end = field.getOffsetFromPoint(event.clientX, event.clientY, { bias: 1 })
  const info = field.getElementInfo(end)
  const bounds = info?.bounds
  if (!bounds || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return
  const reference = /^\\JL[a-z]+$/.test(info.latex || '')
  if (reference || info.latex?.startsWith('\\placeholder')) open(bounds, { ranges: [[start, end]] }, reference)
}
/** 复用MathLive原生原子定位，仅变量指向声明；参数不伪造图节点。 */
function previewAtPoint(event: PointerEvent) {
  if (!referenceContext) return
  if (!field || !event.composedPath().includes(field)) { referenceContext.preview(); return }
  const offset = field.getOffsetFromPoint(event.clientX, event.clientY, { bias:1 })
  const info = field.getElementInfo(offset)
  const bounds = info?.bounds
  const inside = bounds && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
  const index = inside ? props.references.findIndex((_item,index) => info.latex === `\\${referenceMacro(index)}`) : -1
  referenceContext.preview(props.references[index]?.metricId)
}
function previewSelection() {
  if (!referenceContext || !field) return
  const latex = field.getElementInfo(field.position)?.latex
  referenceContext.preview(props.references.find((_item,index) => latex === `\\${referenceMacro(index)}`)?.metricId)
}
function chooseReference(index: number) {
  if (mode.value === 'source') { closeReferences(); insertReference(index); return }
  if (!field || !referenceSelection.value || props.disabled) return
  const selection = referenceSelection.value
  const macro = `\\${referenceMacro(index)}`
  const latex = replacingReference ? macro : `\\mathord{${macro}}`
  closeReferences()
  field.focus(); field.selection = selection
  insert(latex)
}
function onInput() {
  if (!field || props.disabled) return
  fitFormula()
  closeReferences()
  try {
    const result = formulaToExpression(field.getValue('latex'), props.references, props.conditions)
    sourceText.value = result.expression; lastEmitted = result.expression
    setInvalid(false); emit('change', result)
  } catch { setInvalid(true) }
}
async function mountField() {
  if (field || loading || disposed || mode.value !== 'visual' || typeof document === 'undefined') return
  loading = true
  try {
    const [{ MathfieldElement: Mathfield }] = await Promise.all([import('mathlive'), import('mathlive/fonts.css')])
    if (disposed) return
    // Fonts are bundled locally. Editing does not require a CDN or a second calculation engine.
    Mathfield.fontsDirectory = null; Mathfield.soundsDirectory = null; Mathfield.computeEngine = null
    field = new Mathfield()
    field.macros = formulaMacros(props.references)
    field.smartFence = true
    field.mathVirtualKeyboardPolicy = 'manual'
    field.setAttribute('aria-label', t(props.conditions ? 'conditionExpression' : 'formula'))
    field.readOnly = !!props.disabled
    field.value = visualFormula(sourceText.value) || ''
    field.addEventListener('input', onInput)
    host.value?.appendChild(field)
    fieldElement.value = field
    ready.value = true
  } catch { loadError.value = true }
  finally { loading = false }
}
function insert(latex: string) {
  if (!field || props.disabled) return
  field.focus()
  field.insert(latex, { selectionMode: 'placeholder', silenceNotifications: true })
  onInput()
}
function insertFunction(name: string) {
  if (name === 'sqrt') { insert('\\sqrt{#0}'); return }
  const args = name === 'round' || name === 'min' || name === 'max' ? '#0,#?' : '#0'
  insert(`\\operatorname{${name}}\\left(${args}\\right)`)
}
function chooseFunction({ key }: { key: string | number }) { insertFunction(String(key)) }
function chooseConditionOperator({ key }: { key: string | number }) { insert(conditionOperators.value[Number(key)].latex) }
function remember(event: Event) { sourceElement = event.target as HTMLTextAreaElement }
function insertReference(index: number) {
  if (props.disabled) return
  if (mode.value === 'visual') { insert(`\\mathord{\\${referenceMacro(index)}}`); return }
  const start = sourceElement?.selectionStart ?? sourceText.value.length
  const end = sourceElement?.selectionEnd ?? start
  const expression = props.references[index].expression
  updateSource(sourceText.value.slice(0, start) + expression + sourceText.value.slice(end))
  nextTick(() => { sourceElement?.focus(); sourceElement?.setSelectionRange(start + expression.length, start + expression.length) })
}
function updateSource(value: string) {
  if (props.disabled) return
  sourceText.value = value; lastEmitted = value
  setInvalid(false); emit('change', { expression: value })
}
async function changeMode(value: 'visual' | 'source') {
  if (props.disabled || invalid.value || value === mode.value || value === 'visual' && !canVisualize.value) return
  closeReferences(); sourceElement = undefined
  mode.value = value
  await nextTick(); await mountField()
  if (value === 'visual' && field) { field.value = visualFormula(sourceText.value) || ''; field.focus() }
}
// Parent echo after a valid keystroke must not reset the native cursor/undo history.
watch(() => props.modelValue, value => {
  if (value === lastEmitted) return
  closeReferences()
  sourceText.value = value; setInvalid(false)
  const latex = visualFormula(value)
  if (latex === undefined) mode.value = 'source'
  else if (field) field.value = latex
})
watch(() => JSON.stringify(props.references), () => {
  closeReferences()
  if (!field) return
  field.macros = formulaMacros(props.references)
  if (!invalid.value) {
    const latex = visualFormula(sourceText.value)
    if (latex === undefined) mode.value = 'source'
    else field.value = latex
  }
})
watch(() => props.disabled, value => { closeReferences(); if (field) field.readOnly = !!value })
watch([sourceText, mode, () => props.references], () => nextTick(fitFormula), { deep:true })
onMounted(mountField)
onBeforeUnmount(() => { disposed = true; referenceContext?.preview(); closeReferences(); field?.removeEventListener('input', onInput); field?.remove() })
</script>
<style scoped>
.formula-editor { width:100%; min-width:0 }
.formula-editor__surface { border:1px solid var(--line-2,var(--line)); border-radius:var(--r-2,6px); background:var(--panel-background) }
.formula-editor__surface:focus-within { border-color:var(--accent) }
.formula-editor__mode { display:flex; align-items:center; justify-content:flex-end; height:32px; padding:0 4px }
.formula-editor__mode :deep(.ant-btn),.formula-editor__toolbar :deep(.ant-btn) { height:32px; padding:0 6px; font-size:12px; color:var(--ink-3) }
.formula-editor__toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:2px; min-height:32px; padding:0 4px; border-top:1px solid var(--line); box-sizing:border-box }
.formula-editor__toolbar > :not(.formula-editor__operators) { flex:none }
.formula-editor__operators { display:flex; align-items:center; min-width:0; overflow-x:auto; scrollbar-width:thin }
.formula-editor__operators :deep(.ant-btn) { min-width:28px; flex:none }
.formula-editor__caret { font-size:10px }
.formula-editor__separator { height:14px; border-left:1px solid var(--line); margin:0 4px }
.formula-editor__field { display:flex; align-items:center; min-width:0; height:112px; overflow:auto; scrollbar-width:thin }
.formula-editor__canvas { position:relative; min-width:0; height:112px }
.formula-editor__source { height:112px; resize:none; font-size:14px; padding:12px; box-shadow:none }
.formula-editor__picker { position:absolute; width:min(260px,100%); z-index:2 }
.formula-editor__field :deep(math-field) { display:block; flex:none; width:max-content; min-height:64px; box-sizing:border-box; padding:12px; font-size:var(--formula-font-size,20px); border:0; border-radius:0; background:transparent; color:var(--ink-1) }
.formula-editor__field :deep(math-field::part(menu-toggle)), .formula-editor__field :deep(math-field::part(virtual-keyboard-toggle)) { display:none }
.formula-editor__feedback { height:22px; margin:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:var(--ink-3); font-size:var(--fs-12,12px); line-height:22px }
.formula-editor__error { color:var(--danger,#ff4d4f) }
</style>
