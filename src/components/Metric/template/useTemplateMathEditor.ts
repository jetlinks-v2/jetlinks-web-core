import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onClickOutside } from '@vueuse/core'
import type { MathfieldElement, Selection } from 'mathlive'
import type { ExpressionFunction } from '../../Expression/types'
import { expressionToFormula, formulaMacros, expressionToTree, formulaReferencePath, referenceMacro, formulaPopupContainer, type FormulaReference } from './formula'
import { expressionText, expressionReferences } from '../../Expression/display'
import { expressionMath,createMathParser,mathEnumChoices } from '../../Expression/math'
import { editorMessages } from '../../Expression/editorMessages'
import { referenceKey } from '../../Expression/document'
import type { ExpressionEditorContext, ExpressionResultLabel } from '../../Expression/editor'
import type {StructuredExpression} from '../../Expression/types'
import { metricMessages } from '../messages'
import { templateReferenceKey } from './templateReference'
import semanticStyles from '../../Expression/math-semantic.css?inline'
import { useMathInsertion, type MathInsertion, type FunctionTarget } from './formula/useMathInsertion'

export interface TemplateMathEditorProps { modelValue:string; tree?:StructuredExpression; references:FormulaReference[]; disabled?:boolean; conditions?:boolean; functions?:ExpressionFunction[]; functionsError?:boolean; forceSource?:boolean; hideMode?:boolean; empty?:boolean; resultLabels?:ExpressionResultLabel[] }
export type FormulaChange={expression:string;expressionTree?:StructuredExpression;metricIds?:string[]}
type MathEditorEmit={ (event:'change',value:FormulaChange):void; (event:'invalid',value:boolean):void; (event:'retryFunctions'):void }
/** 沿用 MathLive 的原生选区与历史；适配共享数学投影，不添加第二套求值过程。 */
export function useTemplateMathEditor(props:TemplateMathEditorProps,emit:MathEditorEmit) {
const { t } = useI18n({ useScope: 'local', messages: {zh:{...metricMessages.zh,...editorMessages.zh},en:{...metricMessages.en,...editorMessages.en}} })
const referenceContext = inject(templateReferenceKey, undefined)
const refreshFunctions=()=>emit('retryFunctions')
const availableFunctions=computed(()=>(props.functions || []).map(item=>({...item,disabled:!insertion.applicable({kind:'value',latex:'',valueType:item.returnType}) || !!functionSelection.value && functionSelection.value.count>item.maximumArguments})))
const modelSource=computed(()=>props.tree ? expressionText(props.tree,node=>props.references.find(item=>{const path=formulaReferencePath(item);return path.id === node.id && JSON.stringify(path.path) === JSON.stringify(node.path)})?.expression) : props.modelValue)
const context=computed<ExpressionEditorContext>(()=>({references:props.references.map(item=>({...formulaReferencePath(item),label:item.label,displayLabel:item.displayLabel,schema:item.schema,unit:item.unit})),functions:props.functions || [],resultLabels:props.resultLabels,disabled:props.disabled}))
const enumValues=computed(()=>mathEnumChoices(context.value))
const projection=(source:string)=>{
  const root=source === modelSource.value && props.tree ? props.tree.root : expressionToTree(source,props.references)?.root
  // 输入区保留可编辑的原值；状态旁注在共享反显中生成，避免原生输入中遗留旧值标签。
  try {return root ? expressionMath(root,context.value,t,undefined,false) : undefined}catch {return undefined}
}
const visualFormula = (source: string) => props.empty ? '' : projection(source)?.latex ?? expressionToFormula(source, props.references, props.conditions)
const initial = visualFormula(modelSource.value)
const mode = ref<'visual' | 'source'>(props.forceSource || initial === undefined ? 'source' : 'visual')
const host = ref<HTMLElement>()
const canvas = ref<HTMLElement>()
onClickOutside(canvas,()=>{if(functionSelection.value)closeReferences()})
const referencePicker = ref<{ focus(): void }>()
const referenceSelection = ref<Selection>()
const functionSelection=shallowRef<FunctionTarget>()
const functionMenuOpen=ref(false)
const referenceFrame=ref<{left:string;top:string;width:string;height:string}>()
const hoverFrame=ref<{left:string;top:string;width:string;height:string}>()
const sourcePickerOpen = ref(false)
const pickerStyle = ref({ left: '0px', top: '0px' })
const referenceOptions = computed(() => (['data', 'parameter'] as const).map(group => ({
  label: t(group === 'data' ? 'formulaData' : 'formulaParameters'),
  options: props.references.flatMap((item, value) => (item.group || 'data') === group && (mode.value === 'source' || insertion.applicable({kind:'value',latex:'',valueType:String(item.schema?.type || 'unknown')})) ? [{ value, label:item.label, icon:group === 'parameter' ? 'SlidersOutlined' : 'DatabaseOutlined' }] : []),
})).filter(group => group.options.length))
let replacingReference = false
const sourceText = ref(modelSource.value)
const invalid = ref(false)
const ready = ref(false)
const loadError = ref(false)
const canVisualize = computed(() => visualFormula(sourceText.value) !== undefined)
const feedback = computed(() => invalid.value ? t('incompleteFormula') : loadError.value ? t('formulaLoadFailed') : mode.value === 'source' && !canVisualize.value ? t('advancedFormulaHint') : mode.value === 'visual' && ready.value && !props.disabled ? canAddBranch.value ? t('formulaBranchesHint') : !canInsertValue.value ? t('chooseInsertionTarget') : props.conditions ? t('enterFormulaBranch') : '' : '')
const operators = computed(() => [
  ...['+','-','\\times','\\dfrac{#@}{#?}'].map((latex,index)=>({label:['+','−','×','÷'][index],latex,kind:'arithmetic' as const})),
  {label:'( )',latex:'\\left(#0\\right)',kind:'group' as const},
  ...(props.conditions ? [{label:t('emptyValue'),latex:'\\JLemptyValue',kind:'value' as const,valueType:'null'},{label:t('conditionAnd'),latex:'\\JLand ',kind:'logical' as const},{label:t('conditionOr'),latex:'\\JLor ',kind:'logical' as const}] : []),
].map(item=>({...item,disabled:!insertion.applicable(item)})))
const conditionOperators = computed(() => [
  { label:'>', latex:'>', hint:'operatorHint_0' }, { label:'<', latex:'<', hint:'operatorHint_1' }, { label:'≥', latex:'\\ge', hint:'operatorHint_2' }, { label:'≤', latex:'\\le', hint:'operatorHint_3' },
  { label:'=', latex:'=', hint:'operatorHint_4' }, { label:'≠', latex:'\\ne', hint:'operatorHint_5' }, { label:t('conditionAnd'), latex:'\\JLand ', hint:'operatorHint_6' }, { label:t('conditionOr'), latex:'\\JLor ', hint:'operatorHint_7' }, { label:t('conditionNot'), latex:'\\JLnot ', hint:'operatorHint_8' },
  { label:t('missing'), latex:'\\JLmissing', hint:'missing' }, { label:t('present'), latex:'\\JLpresent', hint:'present' },
].map((item,index)=>({...item,kind:(index < 6 ? 'comparison' : index < 8 ? 'logical' : index === 8 ? 'not' : 'predicate') as MathInsertion['kind']})).map(item=>({...item,disabled:!insertion.applicable(item)})))
const literalValues=computed(()=>[
  ...(insertion.valueChoices.value?.flatMap((item,index)=>{const choice=enumValues.value.find(candidate=>candidate.label === item.label && JSON.stringify(candidate.node) === JSON.stringify(item.node));return choice ? [{key:`enum:${index}`,icon:'TagOutlined',label:item.label,latex:`\\${choice.macro}`,valueType:item.node.valueType}] : []}) || []),
  ...(insertion.valueChoices.value ? [] : [
  {key:'number',icon:'NumberOutlined',label:t('number'),latex:'\\placeholder{}'},
  {key:'text',icon:'FontSizeOutlined',label:t('text'),latex:'\\class{expression-math-constant is-text}{\\text{"#?"}}'},
  {key:'true',icon:'CheckCircleOutlined',label:t('yes'),description:t('booleanValue'),latex:'\\JLtrue'},
  {key:'false',icon:'MinusCircleOutlined',label:t('no'),description:t('booleanValue'),latex:'\\JLfalse'},
  ]),
  {key:'null',icon:'StopOutlined',label:t('noValue'),description:t('noValueHint'),latex:'\\JLemptyResult'},
].map(item=>({...item,description:'description' in item ? item.description : undefined,kind:'value' as const,valueType:'valueType' in item ? String(item.valueType) : item.key === 'true' || item.key === 'false' ? 'boolean' : item.key === 'text' ? 'string' : item.key,disabled:!insertion.applicable({kind:'value',latex:item.latex,valueType:'valueType' in item ? String(item.valueType) : item.key === 'true' || item.key === 'false' ? 'boolean' : item.key === 'text' ? 'string' : item.key})})))
let field: MathfieldElement | undefined
let sourceElement: HTMLTextAreaElement | undefined
let lastEmitted: string | undefined
const lastRoot=shallowRef<StructuredExpression['root']>()
let disposed = false
let loading = false
let hoveredOffset:number|undefined
const currentRoot=computed(()=>lastRoot.value || props.tree?.root || expressionToTree(sourceText.value,props.references)?.root || {type:'literal' as const,valueType:'null' as const,value:null})
const parser=computed(()=>createMathParser(currentRoot.value,context.value,t))
const insertion=useMathInsertion({field:()=>field,context:()=>context.value,root:()=>currentRoot.value,parser:()=>parser.value,commit:onInput,disabled:()=>!!props.disabled,conditions:()=>!!props.conditions})
const canInsertValue=insertion.canInsertValue
const canAddBranch=insertion.canAddBranch
const addBranch=insertion.addBranch
const refreshInsertion=()=>insertion.refresh(functionSelection.value ? {ranges:[functionSelection.value.range]} : referenceSelection.value)

function setInvalid(value: boolean) { invalid.value = value; emit('invalid', value) }
const popupContainer=formulaPopupContainer
function referenceVisibilityChanged(visible: boolean) {
  if (visible) return
  // MathLive can complete a pending focus after the picker opened. Explicit
  // pointer actions in the formula already discard the saved selection.
  if (referenceSelection.value && document.activeElement === field) referencePicker.value?.focus()
  else closeReferences()
}
function closeReferences(focus = false) {
  functionSelection.value=undefined
  functionMenuOpen.value=false
  referenceSelection.value = undefined
  referenceFrame.value=undefined
  hoverFrame.value=undefined
  hoveredOffset=undefined
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
  // 仅框住本次原生原子，不高亮同名的其他读取；不向 MathLive 插入装饰或历史记录。
  referenceFrame.value=replace && bounds ? {left:`${bounds.left-area.left-1}px`,top:`${bounds.top-area.top}px`,width:`${bounds.right-bounds.left+2}px`,height:`${bounds.bottom-bounds.top}px`} : undefined
  pickerStyle.value = {
    left: `clamp(0px, ${(anchor?.left ?? area.left) - area.left}px, max(0px, calc(100% - 260px)))`,
    top: `${Math.max(0, (anchor?.bottom ?? area.bottom) - area.top) + 4}px`,
  }
  if (mode.value === 'source') sourcePickerOpen.value = true
  else if (field) {
    const current = selection || field.selection
    referenceSelection.value = { ...current, ranges: current.ranges.map(([start, end]) => [start, end]) }
    insertion.refresh(referenceSelection.value)
    replacingReference = replace
    field.position=Math.max(...current.ranges[0])
    field.blur()
  }
  await nextTick()
  referencePicker.value?.focus()
}
function chooseAtPoint(event: MouseEvent) {
  if (!field || props.disabled || event.button !== 0 || event.shiftKey || !event.composedPath().includes(field)) return
  closeReferences()
  if(insertion.placeInBlank(event.clientX,event.clientY)) {event.preventDefault();event.stopPropagation();return}
  const fn=insertion.functionAtPoint(event.clientX,event.clientY)
  if(fn) {
    event.preventDefault();event.stopPropagation()
    const area=canvas.value!.getBoundingClientRect()
    pickerStyle.value={left:`clamp(0px, ${fn.bounds.left-area.left}px, max(0px, calc(100% - 360px)))`,top:`${fn.bounds.bottom-area.top+4}px`}
    functionSelection.value=fn
    insertion.refresh({ranges:[fn.range]});field.position=fn.range[1];field.blur()
    return
  }
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
  const reference = props.references.some((_item,index)=>info.latex === `\\${referenceMacro(index)}`)
  if (reference || info.latex?.startsWith('\\placeholder') && props.references.length) open(bounds, { ranges: [[start, end]] }, reference)
  else if (['\\JLemptyValue','\\JLemptyResult','\\JLtrue','\\JLfalse'].includes(info.latex || '')) {
    // 常量标签是单个可替换值；阻止原生双击把分段容器当作一组扩选。
    event.preventDefault();event.stopPropagation();field.focus();field.selection={ranges:[[start,end]]}
  }
}
function clearPreview() {hoverFrame.value=undefined;hoveredOffset=undefined;referenceContext?.preview()}
/** 复用MathLive原生原子定位，仅变量指向声明；参数不伪造图节点。 */
function previewAtPoint(event: PointerEvent) {
  if (!field || props.disabled || referenceSelection.value || functionSelection.value || event.buttons || field.selection.ranges.some(([start,end])=>start !== end) || !event.composedPath().includes(field)) {clearPreview();return}
  const offset = field.getOffsetFromPoint(event.clientX, event.clientY, { bias:1 })
  const info = field.getElementInfo(offset)
  const bounds = info?.bounds
  const inside = bounds && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
  if(inside && hoveredOffset === offset && hoverFrame.value)return
  const area=canvas.value?.getBoundingClientRect()
  const index = inside ? props.references.findIndex((_item,index) => info.latex === `\\${referenceMacro(index)}`) : -1
  // 原生定位可能返回整列/容器；只为引用及单个数字描边，常量保留自己的角标提示。
  const atomic=index >= 0 || /^\d+(?:\.\d+)?$/.test(info?.latex || '')
  hoverFrame.value=inside && area && atomic ? {left:`${bounds.left-area.left-1}px`,top:`${bounds.top-area.top}px`,width:`${bounds.right-bounds.left+2}px`,height:`${bounds.bottom-bounds.top}px`} : undefined
  hoveredOffset=hoverFrame.value ? offset : undefined
  referenceContext?.preview(props.references[index]?.metricId)
}
function previewSelection() {
  hoverFrame.value=undefined;hoveredOffset=undefined
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
  insert({latex,kind:'value',valueType:String(props.references[index]?.schema?.type || 'unknown')},selection)
}
function onInput() {
  if (!field || props.disabled) return
  closeReferences()
  try {
    const next=parser.value(field.getValue('latex')),tree={version:1 as const,root:next}
    const source=expressionText(tree,node=>props.references.find(item=>referenceKey(formulaReferencePath(item)) === referenceKey(node))?.expression)
    sourceText.value=source;lastEmitted=source;lastRoot.value=next
    const metricIds=[...new Set(expressionReferences(next).flatMap(node=>{const reference=props.references.find(item=>referenceKey(formulaReferencePath(item)) === referenceKey(node));return reference?.metricId ? [reference.metricId] : []}))]
    setInvalid(false); emit('change',{expression:source,expressionTree:tree,metricIds})
  } catch { setInvalid(true) }
  insertion.refresh()
}
async function mountField() {
  if (field || loading || disposed || mode.value !== 'visual' || typeof document === 'undefined' || !host.value) return
  loading = true
  try {
    const [{ MathfieldElement: Mathfield }] = await Promise.all([import('mathlive'), import('mathlive/fonts.css')])
    if (disposed) return
    // Fonts are bundled locally. Editing does not require a CDN or a second calculation engine.
    Mathfield.fontsDirectory = null; Mathfield.soundsDirectory = null; Mathfield.computeEngine = null
    field = new Mathfield()
    field.macros = projection(sourceText.value)?.macros || formulaMacros(props.references)
    field.smartFence = true
    field.mathVirtualKeyboardPolicy = 'manual'
    field.setAttribute('aria-label', t(props.conditions ? 'conditionExpression' : 'formula'))
    field.readOnly = !!props.disabled
    field.value = visualFormula(sourceText.value) || ''
    field.addEventListener('input', onInput)
    field.addEventListener('selection-change',refreshInsertion)
    field.addEventListener('keydown',insertion.onKeydown,true)
    host.value?.appendChild(field)
    if(field.shadowRoot) {const style=document.createElement('style');style.textContent=semanticStyles;field.shadowRoot.appendChild(style)}
    field.inlineShortcuts={...field.inlineShortcuts,IF:'\\begin{cases}#?&#0\\\\#?&\\JLotherwise\\end{cases}',IFS:'\\begin{cases}#?&#0\\\\#?&#?\\\\#?&\\JLotherwise\\end{cases}'}
    ready.value = true
    insertion.refresh()
  } catch { loadError.value = true }
  finally { loading = false }
}
function insert(item:MathInsertion,selection?:Selection) {insertion.insert(item,selection)}
function insertFunction(name: string) {
  if(name === 'IF') {insert({kind:'value',latex:'\\begin{cases}#?&#?\\\\#?&\\JLotherwise\\end{cases}'});return}
  if(name === 'IFS') {insert({kind:'value',latex:'\\begin{cases}#?&#?\\\\#?&#?\\\\#?&\\JLotherwise\\end{cases}'});return}
  const descriptor=props.functions?.find(item=>item.id === name)
  if(!descriptor)return
  const alias=projection(sourceText.value)?.document.functions
  const label=alias ? Array.from(alias).find(([,id])=>id === name)?.[0] : undefined
  const selected=functionSelection.value
  if(selected?.id === name) {closeReferences(true);return}
  if(selected && descriptor && selected.count>descriptor.maximumArguments)return
  const argumentsLatex=selected ? selected.argumentsLatex.replace(/\\right\)$/,(selected.count<descriptor.minimumArguments ? ','+Array.from({length:descriptor.minimumArguments-selected.count},()=>'\\placeholder{}').join(',') : '')+'\\right)') : '\\left('+Array.from({length:descriptor.minimumArguments},()=>'#?').join(',')+'\\right)'
  const latex=name === 'math.sqrt' ? `\\sqrt{${argumentsLatex.slice(6,-7)}}` : '\\operatorname{'+label+'}'+argumentsLatex
  if(label)insert({kind:'value',valueType:descriptor.returnType,latex},selected ? {ranges:[selected.range]} : undefined)
}
function chooseFunction({ key }: { key: string | number }) { functionMenuOpen.value=false;if (key === 'retry') refreshFunctions(); else insertFunction(String(key)) }
function chooseConditionOperator({ key }: { key: string | number }) {
  if(key === 'branch') {if(canAddBranch.value)addBranch();else insertion.startBranch();return}
  const item=conditionOperators.value[Number(key)];if(item)insert(item)
}
function chooseLiteral({key}:{key:string|number}) {
  const item=literalValues.value.find(item=>item.key === key)
  if(item)insert(item)
}
function remember(event: Event) { sourceElement = event.target as HTMLTextAreaElement }
function insertReference(index: number) {
  if (props.disabled) return
  if (mode.value === 'visual') { insert({latex:`\\mathord{\\${referenceMacro(index)}}`,kind:'value',valueType:String(props.references[index]?.schema?.type || 'unknown')}); return }
  const start = sourceElement?.selectionStart ?? sourceText.value.length
  const end = sourceElement?.selectionEnd ?? start
  const expression = props.references[index].expression
  updateSource(sourceText.value.slice(0, start) + expression + sourceText.value.slice(end))
  nextTick(() => { sourceElement?.focus(); sourceElement?.setSelectionRange(start + expression.length, start + expression.length) })
}
function updateSource(value: string) {
  if (props.disabled) return
  sourceText.value = value; lastEmitted = value; lastRoot.value=undefined
  setInvalid(false); emit('change', { expression: value })
}
async function changeMode(value: 'visual' | 'source') {
  if (props.disabled || invalid.value || value === mode.value || value === 'visual' && (!canVisualize.value || props.forceSource)) return
  closeReferences(); sourceElement = undefined
  mode.value = value
  await nextTick(); await mountField()
  if (value === 'visual' && field) { field.value = visualFormula(sourceText.value) || ''; field.focus() }
}
// Parent echo after a valid keystroke must not reset the native cursor/undo history.
watch(modelSource, value => {
  if (value === lastEmitted || props.tree && toRaw(props.tree.root) === toRaw(lastRoot.value)) return
  closeReferences()
  lastRoot.value=undefined;lastEmitted=undefined
  sourceText.value = value; setInvalid(false)
  const latex = visualFormula(value)
  if (latex === undefined) mode.value = 'source'
  else if (field) {field.macros=projection(value)?.macros || formulaMacros(props.references);field.value = latex}
  insertion.refresh()
})
watch(()=>props.forceSource,async value=>{if (value) {mode.value='source';closeReferences()} else {mode.value=visualFormula(sourceText.value) === undefined ? 'source' : 'visual';await nextTick();await mountField()}})
watch(() => JSON.stringify([props.references,props.functions,props.resultLabels]), () => {
  closeReferences()
  if (!field) return
  field.macros = projection(sourceText.value)?.macros || formulaMacros(props.references)
  if (!invalid.value) {
    const latex = visualFormula(sourceText.value)
    if (latex === undefined) mode.value = 'source'
    else field.value = latex
  }
  insertion.refresh()
})
watch(() => props.disabled, value => { closeReferences(); if (field) field.readOnly = !!value;insertion.refresh() })
// 插槽或按需面板可能晚于组件mounted才提供宿主；同一字段由mountField的守卫保证只初始化一次。
watch(host,()=>mountField(),{flush:'post'})
onMounted(mountField)
onBeforeUnmount(() => { disposed = true; referenceContext?.preview(); closeReferences(); field?.removeEventListener('input', onInput);field?.removeEventListener('selection-change',refreshInsertion);field?.removeEventListener('keydown',insertion.onKeydown,true); field?.remove() })

return {t,host,canvas,referencePicker,mode,invalid,ready,canVisualize,sourceText,referenceSelection,functionSelection,functionMenuOpen,referenceFrame,hoverFrame,sourcePickerOpen,pickerStyle,referenceOptions,popupContainer,referenceVisibilityChanged,closeReferences,chooseReference,chooseAtPoint,previewAtPoint,previewSelection,clearPreview,referenceContext,availableFunctions,refreshFunctions,functionsError:computed(()=>props.functionsError),feedback,loadError,operators,conditionOperators,literalValues,chooseLiteral,changeMode,updateSource,remember,focusFormula,insert,openReferences,chooseFunction,chooseConditionOperator,canInsertValue,refreshInsertion,canAddBranch,addBranch}
}
