import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onClickOutside } from '@vueuse/core'
import type { MathfieldElement, Selection } from 'mathlive'
import type { ExpressionFunction } from './types'
import { expressionText } from './display'
import { expressionMath,createMathParser,mathEnumChoices,mathReferenceMacro } from './math'
import { editorMessages } from './editorMessages'
import { mathEditorMessages } from './mathEditorMessages'
import type { ExpressionEditorContext } from './editor'
import type {StructuredExpression} from './types'
import semanticStyles from './math-semantic.css?inline'
import { useMathInsertion, type MathInsertion, type FunctionTarget } from './useMathInsertion'
import { useMathClipboard } from './useMathClipboard'
import { unsupportedMathKey } from './mathInput'

/** 旧源码只由宿主适配；可视编辑仅提交结构树。 */
export interface ExpressionSourceAdapter { text:string; parse:(source:string)=>StructuredExpression|undefined; format:(tree:StructuredExpression)=>string }
export interface MathEditorProps { modelValue?:StructuredExpression; context:ExpressionEditorContext; disabled?:boolean; conditions?:boolean; functionsError?:boolean; source?:ExpressionSourceAdapter; forceSource?:boolean; hideMode?:boolean; empty?:boolean;autofocus?:boolean }
export type MathEditorChange={expression?:string;expressionTree?:StructuredExpression}
type MathEditorEmit={ (event:'change',value:MathEditorChange):void; (event:'update:modelValue',value:StructuredExpression):void; (event:'invalid',value:boolean):void; (event:'retryFunctions'):void; (event:'referenceHover',value:ExpressionEditorContext['references'][number]|undefined):void }
/** 统一 MathLive 会话、原生选区、空位选择与声明式反馈。 */
export function useMathEditor(props:MathEditorProps,emit:MathEditorEmit) {
const { t } = useI18n({ useScope: 'local', messages: {zh:{...editorMessages.zh,...mathEditorMessages.zh},en:{...editorMessages.en,...mathEditorMessages.en}} })
const context=computed(()=>props.context)
const references=computed(()=>props.context.references)
const functions=computed(()=>props.context.functions)
const format=(tree:StructuredExpression)=>props.source?.format(tree) ?? expressionText(tree)
const modelSource=computed(()=>props.source?.text ?? (props.modelValue ? format(props.modelValue) : ''))
const refreshFunctions=()=>emit('retryFunctions')
const availableFunctions=computed(()=>functions.value.map(item=>({...item,disabled:!insertion.applicable({kind:'value',latex:'',valueType:item.returnType}) || !!functionSelection.value && functionSelection.value.count>item.maximumArguments})))
const enumValues=computed(()=>mathEnumChoices(context.value))
const sourceTree=(source:string)=>source === modelSource.value && props.modelValue ? props.modelValue : props.source?.parse(source)
const projection=(source:string)=>{
  const root=sourceTree(source)?.root
  try {return root ? expressionMath(root,context.value,t,undefined,false) : undefined}catch {return undefined}
}
const visualFormula=(source:string)=>props.empty ? '' : projection(source)?.latex
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
const referenceOptions=computed(()=>{
  const options=references.value.flatMap((item,value)=>mode.value === 'source' || insertion.applicable({kind:'value',latex:'',valueType:String(item.schema?.type || 'unknown')}) ? [{value,label:item.displayLabel || item.label,icon:item.icon || 'DatabaseOutlined',description:item.description}] : [])
  if(!references.value.some(item=>item.group))return options
  return [...new Set(references.value.map(item=>item.group || ''))].map(group=>({label:group,options:options.filter(option=>(references.value[option.value].group || '') === group)})).filter(group=>group.options.length)
})
let replacingReference = false
const sourceText = ref(modelSource.value)
const invalid = ref(false)
const ready = ref(false)
const loadError = ref(false)
const inputNotice=ref('')
const canVisualize = computed(() => visualFormula(sourceText.value) !== undefined)
const feedback = computed(() => inputNotice.value || clipboard.feedback.value || (invalid.value ? t('incompleteFormula') : loadError.value ? t('formulaLoadFailed') : mode.value === 'source' && !canVisualize.value ? t('advancedFormulaHint') : mode.value === 'visual' && ready.value && !props.disabled ? canAddBranch.value ? t('formulaBranchesHint') : !canInsertValue.value ? t('chooseInsertionTarget') : props.conditions ? t('enterFormulaBranch') : '' : ''))
const operators = computed(() => [
  ...['+','-','\\times','\\dfrac{#@}{#?}'].map((latex,index)=>({label:['+','−','×','÷'][index],latex,kind:'arithmetic' as const})),
  {label:'( )',latex:'\\left(#0\\right)',kind:'group' as const},
  ...(props.conditions ? [{label:'>',latex:'>'},{label:'≥',latex:'\\ge'},{label:'<',latex:'<'},{label:'≤',latex:'\\le'},{label:'=',latex:'='},{label:'≠',latex:'\\ne'}].map(item=>({...item,kind:'comparison' as const})).filter(item=>insertion.applicable(item)) : []),
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
let baseShortcuts: MathfieldElement['inlineShortcuts'] = {}
let sourceElement: HTMLTextAreaElement | undefined
let lastEmitted: string | undefined
const lastRoot=shallowRef<StructuredExpression['root']>()
let disposed = false
let loading = false
const currentRoot=computed(()=>lastRoot.value || props.modelValue?.root || props.source?.parse(sourceText.value)?.root || {type:'literal' as const,valueType:'null' as const,value:null})
const parser=computed(()=>createMathParser(currentRoot.value,context.value,t))
const clipboard=useMathClipboard({field:()=>field,root:()=>currentRoot.value,context:()=>context.value,parser:()=>parser.value,disabled:()=>!!props.disabled,commit:onInput,t})
const insertion=useMathInsertion({field:()=>field,context:()=>context.value,root:()=>currentRoot.value,parser:()=>parser.value,commit:onInput,disabled:()=>!!props.disabled,conditions:()=>!!props.conditions})
const canInsertValue=insertion.canInsertValue
const canAddBranch=insertion.canAddBranch
const addBranch=insertion.addBranch
const refreshInsertion=()=>insertion.refresh(functionSelection.value ? {ranges:[functionSelection.value.range]} : referenceSelection.value)

function setInvalid(value: boolean) { invalid.value = value; emit('invalid', value) }
const popupContainer=(trigger:HTMLElement):HTMLElement=>trigger.closest('dialog') || trigger.parentElement!
function referenceVisibilityChanged(visible: boolean) {
  if (visible) return
  // MathLive can complete a pending focus after the picker opened. Explicit
  // pointer actions in the formula already discard the saved selection.
  if (referenceSelection.value && document.activeElement === field) referencePicker.value?.focus()
  else closeReferences()
}
function closeReferences(focus = false) {
  const selection=referenceSelection.value || (functionSelection.value ? {ranges:[functionSelection.value.range]} : undefined)
  functionSelection.value=undefined
  functionMenuOpen.value=false
  referenceSelection.value = undefined
  referenceFrame.value=undefined
  hoverFrame.value=undefined
  sourcePickerOpen.value = false
  if (focus) { if (mode.value === 'source') sourceElement?.focus(); else if(field){field.focus();if(selection)field.selection=selection} }
}
function focusFormula() {
  field?.focus()
}
/** Keep MathLive's native range while the select temporarily owns keyboard focus. */
async function openReferences(bounds?: DOMRect, selection?: Selection, replace = false) {
  if (disposed || props.disabled || !references.value.length || mode.value === 'visual' && !field) return
  const anchor = localBounds(bounds || (mode.value === 'visual' ? field?.getElementInfo(field.position)?.bounds : undefined))
  // 仅框住本次原生原子，不高亮同名的其他读取；不向 MathLive 插入装饰或历史记录。
  referenceFrame.value=replace && bounds ? frameStyle(bounds) : undefined
  pickerStyle.value = {
    left: `clamp(0px, ${anchor?.left ?? 0}px, max(0px, calc(100% - 260px)))`,
    top: `${Math.max(0, anchor?.bottom ?? canvas.value!.clientHeight ?? 0) + 4}px`,
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
    const anchor=localBounds(fn.bounds)!
    pickerStyle.value={left:`clamp(0px, ${anchor.left}px, max(0px, calc(100% - 360px)))`,top:`${anchor.bottom+4}px`}
    functionSelection.value=fn
    insertion.refresh({ranges:[fn.range]});field.position=fn.range[1];field.blur()
    return
  }
  // A variable click belongs to the picker. Do not start MathLive's deferred focus.
  const open = (bounds?: DOMRect, selection?: Selection, replace = false) => {
    event.preventDefault(); event.stopPropagation()
    openReferences(bounds, selection, replace)
  }
  if (!field.getValue('latex')) return
  // Bias selects the complete native atom, including macros inside fractions/functions.
  const start = field.getOffsetFromPoint(event.clientX, event.clientY, { bias: -1 })
  const end = field.getOffsetFromPoint(event.clientX, event.clientY, { bias: 1 })
  const info = field.getElementInfo(end)
  const referenceTarget=referenceAtPoint(event)
  const bounds = referenceTarget && info?.latex === `\\${mathReferenceMacro(referenceTarget.index)}` ? referenceTarget.bounds : info?.bounds
  if (!info || !bounds || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return
  const reference = references.value.some((_item,index)=>info.latex === `\\${mathReferenceMacro(index)}`)
  if (reference) open(bounds, { ranges: [[start, end]] }, true)
  else if(info.latex?.startsWith('\\placeholder')) {
    // Empty operands belong to native typing; suggestions are explicitly opened from the toolbar/@.
    event.preventDefault();event.stopPropagation();field.focus();field.selection={ranges:[[start,end]]};insertion.refresh()
  }
  else if (['\\JLemptyValue','\\JLemptyResult','\\JLtrue','\\JLfalse'].includes(info.latex || '')) {
    // 常量标签是单个可替换值；阻止原生双击把分段容器当作一组扩选。
    event.preventDefault();event.stopPropagation();field.focus();field.selection={ranges:[[start,end]]}
  }
}
function clearPreview() {hoverFrame.value=undefined;emit('referenceHover',undefined)}
/** 视口边界转换为画布本地坐标，兼容祖先缩放；不缓存布局坐标。 */
function localBounds(bounds?: DOMRect) {
  const element=canvas.value
  if(!element || !bounds)return
  const area=element.getBoundingClientRect()
  const scaleX=element.offsetWidth ? area.width/element.offsetWidth : 1
  const scaleY=element.offsetHeight ? area.height/element.offsetHeight : 1
  return {left:(bounds.left-area.left)/scaleX,top:(bounds.top-area.top)/scaleY,right:(bounds.right-area.left)/scaleX,bottom:(bounds.bottom-area.top)/scaleY}
}
function frameStyle(bounds:DOMRect) {
  const local=localBounds(bounds)
  return local ? {left:`${local.left-1}px`,top:`${local.top}px`,width:`${local.right-local.left+2}px`,height:`${local.bottom-local.top}px`} : undefined
}
/** 只识别投影自身声明的标记，不依赖 MathLive 的私有节点、层级或坐标缓存。 */
function referenceAtPoint(event:MouseEvent) {
  for(const target of event.composedPath()) {
    const element=target as HTMLElement
    const marker=element.dataset?.expressionReferenceIndex
    if(marker === undefined)continue
    const index=Number(marker)
    if(Number.isInteger(index) && references.value[index])return {index,bounds:element.getBoundingClientRect()}
  }
}
function previewAtPoint(event: PointerEvent) {
  if (!field || props.disabled || referenceSelection.value || functionSelection.value || event.buttons || field.selection.ranges.some(([start,end])=>start !== end) || !event.composedPath().includes(field)) {clearPreview();return}
  const reference=referenceAtPoint(event)
  // 说明附在实际命中的语义原子上，不使用可能漂移的透明浮层。
  for(const target of event.composedPath()) {
    const element=target as HTMLElement,index=element.dataset?.expressionInspect
    if(index !== undefined) {element.title=projection(sourceText.value)?.inspections[Number(index)]?.title || '';break}
  }
  if(reference) {
    const item=references.value[reference.index]
    const element=event.composedPath().find(target=>(target as HTMLElement).dataset?.expressionReferenceIndex !== undefined) as HTMLElement
    element.title=[item.label,item.description,item.unit].filter(Boolean).join(' · ')
  } else {
    const fn=insertion.functionAtPoint(event.clientX,event.clientY)
    if(fn) {
      const descriptor=functions.value.find(item=>item.id === fn.id)
      const target=event.composedPath().find(target=>target instanceof HTMLElement && target !== field) as HTMLElement|undefined
      if(target)target.title=[descriptor?.name,descriptor?.description].filter(Boolean).join(' · ')
    }
  }
  // 数字只描边实际命中的文字元素，避免把分式、分支容器当成单个值。
  const number=reference ? undefined : event.composedPath().find(target=>/^\d+(?:\.\d+)?$/.test((target as HTMLElement).textContent || '') && typeof (target as HTMLElement).getBoundingClientRect === 'function') as HTMLElement|undefined
  const bounds=reference?.bounds || number?.getBoundingClientRect()
  const inside=bounds && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
  hoverFrame.value=inside ? frameStyle(bounds) : undefined
  emit('referenceHover',inside && reference ? references.value[reference.index] : undefined)
}
function previewSelection() {
  hoverFrame.value=undefined
  if (!field) return
  const latex=field.getElementInfo(field.position)?.latex
  emit('referenceHover',references.value.find((_item,index) => latex === String.fromCharCode(92)+mathReferenceMacro(index)))
}
function chooseReference(index: number) {
  if (mode.value === 'source') { closeReferences(); insertReference(index); return }
  if (!field || !referenceSelection.value || props.disabled) return
  const selection = referenceSelection.value
  const macro = `\\${mathReferenceMacro(index)}`
  const latex = replacingReference ? macro : `\\mathord{${macro}}`
  closeReferences()
  field.focus(); field.selection = selection
  insert({latex,kind:'value',valueType:String(references.value[index]?.schema?.type || 'unknown')},selection)
}
function onInput() {
  if (!field || props.disabled) return
  inputNotice.value=''
  clipboard.clear()
  closeReferences()
  try {
    const next=parser.value(field.getValue('latex')),tree={version:1 as const,root:next}
    const source=format(tree)
    sourceText.value=source;lastEmitted=source;lastRoot.value=next
    setInvalid(false); emit('update:modelValue',tree); emit('change',{expression:source,expressionTree:tree})
  } catch { setInvalid(true) }
  insertion.refresh()
}
function finish() {if(mode.value === 'visual')onInput();return mode.value === 'source' ? !invalid.value : ready.value && !invalid.value && !loadError.value}
function blurCommit() {if(!referenceSelection.value && !functionSelection.value)finish()}
function onBeforeInput(event:InputEvent) {
  if(!props.disabled && event.data && unsupportedMathKey(event.data,'',field?.mode === 'text')) {
    event.preventDefault();inputNotice.value=t('unsupportedOperator')
  }
}
function onEditorKeydown(event:KeyboardEvent) {
  if(!props.disabled && !event.isComposing && (event.key === '@' || event.key === ' ' && (event.ctrlKey || event.metaKey))) {
    event.preventDefault();event.stopImmediatePropagation();void openReferences();return
  }
  if(field && !props.disabled && !event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey
    && unsupportedMathKey(event.key,field.getValue(Math.max(0,field.position-1),field.position,'latex'),field.mode === 'text')) {
    event.preventDefault();event.stopImmediatePropagation();inputNotice.value=t('unsupportedOperator');return
  }
  insertion.onKeydown(event)
}
/** 引用目录可随宿主和语言变化；重建映射时移除旧声明，避免继续指向旧序号。 */
function refreshShortcuts() {
  if(!field)return
  field.inlineShortcuts={...baseShortcuts,...Object.fromEntries(references.value.flatMap((item,index)=>
    !item.path.length && /^[A-Za-z][A-Za-z0-9_]{1,63}$/.test(item.id) ? [[item.id,'\\'+mathReferenceMacro(index)]] : []))}
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
    field.macros = projection(sourceText.value)?.macros || {}
    field.smartFence = true
    field.mathVirtualKeyboardPolicy = 'manual'
    field.setAttribute('aria-label', t(props.conditions ? 'conditionExpression' : 'formula'))
    field.readOnly = !!props.disabled
    field.value = visualFormula(sourceText.value) || ''
    clipboard.attach(field)
    field.addEventListener('input', onInput)
    field.addEventListener('beforeinput',onBeforeInput)
    field.addEventListener('selection-change',refreshInsertion)
    field.addEventListener('keydown',onEditorKeydown,true)
    host.value?.appendChild(field)
    if(field.shadowRoot) {const style=document.createElement('style');style.textContent=semanticStyles;field.shadowRoot.appendChild(style)}
    // MathLive's general math shortcuts include shifts, sets and calculus that this grammar cannot execute.
    baseShortcuts={'<=':'\\le','>=':'\\ge','!=':'\\ne','==':'=','&&':'\\JLand ','||':'\\JLor ',IF:'\\begin{cases}#?&#0\\\\#?&\\JLotherwise\\end{cases}',IFS:'\\begin{cases}#?&#0\\\\#?&#?\\\\#?&\\JLotherwise\\end{cases}'}
    // 稳定标识可直接键入；中文名仍可通过 @ / Ctrl+Space 的可搜索菜单选择。
    refreshShortcuts()
    ready.value = true
    if(props.autofocus){field.focus();field.executeCommand('moveToMathfieldEnd')}
    insertion.refresh()
  } catch { loadError.value = true }
  finally { loading = false }
}
function insert(item:MathInsertion,selection?:Selection) {insertion.insert(item,selection)}
function insertFunction(name: string) {
  if(name === 'IF') {insert({kind:'value',latex:'\\begin{cases}#?&#?\\\\#?&\\JLotherwise\\end{cases}'});return}
  if(name === 'IFS') {insert({kind:'value',latex:'\\begin{cases}#?&#?\\\\#?&#?\\\\#?&\\JLotherwise\\end{cases}'});return}
  const descriptor=functions.value?.find(item=>item.id === name)
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
  if (mode.value === 'visual') { insert({latex:`\\mathord{\\${mathReferenceMacro(index)}}`,kind:'value',valueType:String(references.value[index]?.schema?.type || 'unknown')}); return }
  const start = sourceElement?.selectionStart ?? sourceText.value.length
  const end = sourceElement?.selectionEnd ?? start
  const expression = format({version:1,root:{type:'reference',id:references.value[index].id,path:references.value[index].path}})
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
  if (value === lastEmitted || props.modelValue && toRaw(props.modelValue.root) === toRaw(lastRoot.value)) return
  closeReferences()
  lastRoot.value=undefined;lastEmitted=undefined
  sourceText.value = value; setInvalid(false)
  const latex = visualFormula(value)
  if (latex === undefined) mode.value = 'source'
  else if (field) {field.macros=projection(value)?.macros || {};field.value = latex}
  insertion.refresh()
})
watch(()=>props.forceSource,async value=>{if (value) {mode.value='source';closeReferences()} else {mode.value=visualFormula(sourceText.value) === undefined ? 'source' : 'visual';await nextTick();await mountField()}})
watch(() => JSON.stringify(props.context), () => {
  closeReferences()
  if (!field) return
  refreshShortcuts()
  field.macros = projection(sourceText.value)?.macros || {}
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
onBeforeUnmount(() => { disposed = true; clipboard.dispose(); emit('referenceHover',undefined); closeReferences(); field?.removeEventListener('input', onInput);field?.removeEventListener('beforeinput',onBeforeInput);field?.removeEventListener('selection-change',refreshInsertion);field?.removeEventListener('keydown',onEditorKeydown,true); field?.remove() })

return {blurCommit,finish,clipboard,inputNotice,t,host,canvas,referencePicker,mode,invalid,ready,canVisualize,sourceText,referenceSelection,functionSelection,functionMenuOpen,referenceFrame,hoverFrame,sourcePickerOpen,pickerStyle,referenceOptions,popupContainer,referenceVisibilityChanged,closeReferences,chooseReference,chooseAtPoint,previewAtPoint,previewSelection,clearPreview,availableFunctions,refreshFunctions,functionsError:computed(()=>props.functionsError),feedback,loadError,operators,conditionOperators,literalValues,chooseLiteral,changeMode,updateSource,remember,focusFormula,insert,openReferences,chooseFunction,chooseConditionOperator,canInsertValue,refreshInsertion,canAddBranch,addBranch}
}
