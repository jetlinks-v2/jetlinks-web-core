<template>
  <section class="formula-editor">
    <div class="formula-editor__toolbar">
      <a-radio-group :value="mode" size="small" :disabled="disabled" @update:value="changeMode">
        <a-radio-button value="visual" :disabled="!canVisualize">{{ t('formulaMode') }}</a-radio-button>
        <a-radio-button value="source">{{ t('advancedMode') }}</a-radio-button>
      </a-radio-group>
      <a-button v-if="mode === 'visual'" size="small" :disabled="disabled || !ready || !references.length"
        @mousedown.prevent @click="openReferences()">{{ t('insertVariable') }}</a-button>
      <a-select v-if="mode === 'visual'" :value="undefined" :placeholder="t('insertFunction')" :aria-label="t('insertFunction')"
        :options="functionOptions" :disabled="disabled || !ready" @select="insertFunction" />
    </div>
    <div v-if="mode === 'source'" class="formula-editor__references">
      <a-button v-for="(item, index) in references" :key="item.key" size="small" :disabled="disabled"
        @mousedown.prevent @click="insertReference(index)">{{ item.label }}</a-button>
    </div>
    <div v-show="mode === 'visual'" ref="canvas" class="formula-editor__canvas" @pointerdown.capture="chooseAtPoint">
      <div ref="host" class="formula-editor__field" />
      <a-select v-if="referenceSelection" ref="referencePicker" class="formula-editor__picker" :style="pickerStyle"
        :value="undefined" :open="true" show-search :options="referenceOptions" option-filter-prop="label"
        :placeholder="t('chooseVariable')" :aria-label="t('chooseVariable')" :not-found-content="t('noVariable')"
        :get-popup-container="popupContainer" @select="chooseReference"
        @dropdown-visible-change="referenceVisibilityChanged" @keydown.esc.stop.prevent="closeReferences(true)" />
    </div>
    <div v-if="mode === 'visual'" class="formula-editor__operators">
      <a-button v-for="item in operators" :key="item.label" size="small" :disabled="disabled || !ready" @mousedown.prevent @click="insert(item.latex)">{{ item.label }}</a-button>
    </div>
    <a-textarea v-else :value="sourceText" :disabled="disabled" :auto-size="{ minRows: 3, maxRows: 10 }"
      :aria-label="t('advancedExpression')" @update:value="updateSource" @focus="remember" @click="remember" @keyup="remember" @select="remember" />
    <p v-if="mode === 'source' && !canVisualize" class="formula-editor__hint">{{ t('advancedFormulaHint') }}</p>
    <p v-if="invalid" class="formula-editor__error" role="alert">{{ t('incompleteFormula') }}</p>
    <a-alert v-if="loadError" type="error" :message="t('formulaLoadFailed')" show-icon />
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MathfieldElement, Selection } from 'mathlive'
import { expressionToFormula, formulaFunctions, formulaMacros, formulaToExpression, referenceMacro, type FormulaReference } from './formula'
import { metricMessages } from '../messages'

const props = defineProps<{ modelValue: string; references: FormulaReference[]; disabled?: boolean }>()
const emit = defineEmits<{
  (event: 'change', value: { expression: string; metricIds?: string[] }): void
  (event: 'invalid', value: boolean): void
}>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const initial = expressionToFormula(props.modelValue, props.references)
const mode = ref<'visual' | 'source'>(initial === undefined ? 'source' : 'visual')
const host = ref<HTMLElement>()
const canvas = ref<HTMLElement>()
const referencePicker = ref<{ focus(): void }>()
const referenceSelection = ref<Selection>()
const pickerStyle = ref({ left: '0px', top: '0px' })
const referenceOptions = computed(() => (['data', 'parameter'] as const).map(group => ({
  label: t(group === 'data' ? 'formulaData' : 'formulaParameters'),
  options: props.references.flatMap((item, value) => (item.group || 'data') === group ? [{ value, label: item.label }] : []),
})).filter(group => group.options.length))
let replacingReference = false
const sourceText = ref(props.modelValue)
const invalid = ref(false)
const ready = ref(false)
const loadError = ref(false)
const canVisualize = computed(() => expressionToFormula(sourceText.value, props.references) !== undefined)
const functionOptions = computed(() => formulaFunctions.map(value => ({ value, label: t(`formulaFunction_${value}`) })))
const operators = [{ label: '+', latex: '+' }, { label: '−', latex: '-' }, { label: '×', latex: '\\times' }, { label: '÷', latex: '\\frac{#@}{#?}' }, { label: '( )', latex: '\\left(#0\\right)' }]
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
  if (focus) field?.focus()
}
/** Keep MathLive's native range while the select temporarily owns keyboard focus. */
async function openReferences(bounds?: DOMRect, selection?: Selection, replace = false) {
  if (!field || disposed || mode.value !== 'visual' || props.disabled || !props.references.length) return
  const area = canvas.value!.getBoundingClientRect()
  const anchor = bounds || field.getElementInfo(field.position)?.bounds
  pickerStyle.value = {
    left: `clamp(0px, ${(anchor?.left ?? area.left) - area.left}px, max(0px, calc(100% - 260px)))`,
    top: `${Math.max(0, (anchor?.bottom ?? area.bottom) - area.top) + 4}px`,
  }
  const current = selection || field.selection
  referenceSelection.value = { ...current, ranges: current.ranges.map(([start, end]) => [start, end]) }
  replacingReference = replace
  field.blur()
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
function chooseReference(index: number) {
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
  closeReferences()
  try {
    const result = formulaToExpression(field.getValue('latex'), props.references)
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
    field.setAttribute('aria-label', t('formula'))
    field.readOnly = !!props.disabled
    field.value = expressionToFormula(sourceText.value, props.references) || ''
    field.addEventListener('input', onInput)
    host.value?.appendChild(field)
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
  if (value === 'visual' && field) { field.value = expressionToFormula(sourceText.value, props.references) || ''; field.focus() }
}
// Parent echo after a valid keystroke must not reset the native cursor/undo history.
watch(() => props.modelValue, value => {
  if (value === lastEmitted) return
  closeReferences()
  sourceText.value = value; setInvalid(false)
  const latex = expressionToFormula(value, props.references)
  if (latex === undefined) mode.value = 'source'
  else if (field) field.value = latex
})
watch(() => JSON.stringify(props.references), () => {
  closeReferences()
  if (!field) return
  field.macros = formulaMacros(props.references)
  if (!invalid.value) {
    const latex = expressionToFormula(sourceText.value, props.references)
    if (latex === undefined) mode.value = 'source'
    else field.value = latex
  }
})
watch(() => props.disabled, value => { closeReferences(); if (field) field.readOnly = !!value })
onMounted(mountField)
onBeforeUnmount(() => { disposed = true; closeReferences(); field?.removeEventListener('input', onInput); field?.remove() })
</script>
<style scoped>
.formula-editor__toolbar, .formula-editor__references, .formula-editor__operators { display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-2,8px); margin-bottom:var(--space-3,12px) }
.formula-editor__toolbar :deep(.ant-select) { width:180px; max-width:100% }
.formula-editor__field { min-width:0; margin-bottom:var(--space-3,12px) }
.formula-editor__canvas { position:relative; min-width:0 }
.formula-editor__picker { position:absolute; width:min(260px,100%); z-index:2 }
.formula-editor__field :deep(math-field) { display:block; width:100%; min-height:64px; padding:12px; font-size:20px; border:1px solid var(--line-2,#d9d9d9); border-radius:6px; background:var(--surface-1,#fff); color:var(--ink-1,#222) }
.formula-editor__field :deep(math-field::part(menu-toggle)), .formula-editor__field :deep(math-field::part(virtual-keyboard-toggle)) { display:none }
.formula-editor__hint { color:var(--ink-2); margin-top:var(--space-2,8px) }
.formula-editor__error { color:var(--danger,#ff4d4f) }
</style>
