import { computed, ref } from 'vue'
import type { MathfieldElement, Selection } from 'mathlive'
import type { ExpressionEditorContext } from './editor'
import type { ExpressionNode } from './types'
import type { ExpressionTranslate } from './document'
import { createMathTransfer } from './mathTransfer'
import { expressionMath } from './math'

interface ClipboardOptions {
  field:()=>MathfieldElement|undefined
  root:()=>ExpressionNode
  context:()=>ExpressionEditorContext
  parser:()=>(latex:string)=>ExpressionNode
  disabled:()=>boolean
  commit:()=>void
  t:ExpressionTranslate
}
const copySelection=(selection:Selection):Selection=>({...selection,ranges:selection.ranges.map(([start,end])=>[start,end])})

/** Clipboard is an exchange adapter; MathLive owns selection and undo, the shared parser owns validity. */
export function useMathClipboard(options:ClipboardOptions) {
  const feedback=ref(''),error=ref(false),manualOpen=ref(false),manualText=ref('')
  const transfer=computed(()=>createMathTransfer(options.root(),options.context(),options.t))
  let target:{field:MathfieldElement;latex:string;selection:Selection;context:ExpressionEditorContext;root:ExpressionNode}|undefined
  let disposed=false
  const message=(key:string,failed=false)=>{feedback.value=options.t(key);error.value=failed}
  const clear=()=>{feedback.value='';error.value=false}
  function capture() {
    const field=options.field()
    if(!field || options.disabled() || disposed)return
    return {field,latex:field.getValue('latex'),selection:copySelection(field.selection),context:options.context(),root:options.root()}
  }
  // Clipboard reads may resolve after switching nodes or replacing the reference catalog.
  const current=(saved:NonNullable<typeof target>)=>!disposed && !options.disabled() && saved.field === options.field()
    && saved.context === options.context() && saved.root === options.root() && saved.latex === saved.field.getValue('latex')
  function exported() {
    const field=options.field()
    if(!field)return ''
    const selection=field.selection
    return transfer.value.copy(selection.ranges.some(([start,end])=>start !== end) ? field.getValue(selection,'latex') : field.getValue('latex'))
  }
  /** Validate insertion in a short-lived MathLive field, so a failed paste never changes live history. */
  function apply(text:string,saved=capture()) {
    if(!saved || !current(saved))return false
    if(!text.trim()){message('formulaClipboardEmpty',true);return false}
    let probe:MathfieldElement|undefined
    try {
      let latex=transfer.value.paste(text)
      // Complete fragments reuse business labels (enum values/null/functions). Operators may
      // be valid only at the insertion point, so full-formula validation below is authoritative.
      try {latex=expressionMath(options.parser()(latex),options.context(),options.t,undefined,false).latex} catch { /* Validate partial fragments in their target context. */ }
      probe=document.createElement('math-field') as MathfieldElement
      probe.hidden=true;probe.setAttribute('aria-hidden','true')
      probe.mathVirtualKeyboardPolicy='manual';probe.macros=saved.field.macros
      probe.value=saved.latex
      document.body.appendChild(probe)
      probe.selection=copySelection(saved.selection)
      const insertion={format:'latex' as const,mode:'math' as const,selectionMode:'after' as const,silenceNotifications:true,focus:false}
      if(!probe.insert(latex,insertion))throw new Error('incomplete')
      options.parser()(probe.getValue('latex'))
      saved.field.selection=copySelection(saved.selection)
      if(!saved.field.insert(latex,insertion))throw new Error('incomplete')
      clear();manualOpen.value=false;target=undefined
      options.commit();saved.field.focus()
      return true
    } catch(cause) {
      const key=cause instanceof Error ? cause.message : ''
      message(key === 'unknownReference' ? 'formulaPasteReferenceMissing' : key === 'unknownFunction' ? 'formulaPasteFunctionMissing' : key === 'invalidEnumValue' ? 'formulaPasteEnumInvalid' : key === 'expressionTooLong' ? key : 'formulaPasteInvalid',true)
      return false
    } finally {probe?.remove()}
  }
  async function copy() {
    try {
      const text=exported()
      if(!text.trim()){message('formulaClipboardEmpty',true);return}
      await navigator.clipboard.writeText(text)
      if(!disposed)message('formulaCopied')
    } catch {if(!disposed)message('formulaCopyFailed',true)}
  }
  async function paste() {
    const saved=capture()
    if(!saved)return
    try {
      const text=await navigator.clipboard.readText()
      if(current(saved))apply(text,saved)
    } catch {
      if(!current(saved))return
      target=saved;manualText.value='';manualOpen.value=true;clear()
    }
  }
  function confirmManual() {if(target && current(target))apply(manualText.value,target);else cancelManual()}
  function cancelManual() {manualOpen.value=false;target=undefined;options.field()?.focus()}
  function onCopy(event:ClipboardEvent) {
    if(!event.clipboardData)return
    event.preventDefault();event.stopImmediatePropagation()
    try {
      const text=exported()
      event.clipboardData.setData('text/plain',text)
      event.clipboardData.setData('application/x-latex',text)
      message('formulaCopied')
    } catch {message('formulaCopyFailed',true)}
  }
  function onPaste(event:ClipboardEvent) {
    event.preventDefault();event.stopImmediatePropagation()
    if(options.disabled() || !event.clipboardData)return
    apply(event.clipboardData.getData('text/plain') || event.clipboardData.getData('application/x-latex'))
  }
  function attach(field:MathfieldElement) {
    field.addEventListener('copy',onCopy,true)
    field.addEventListener('paste',onPaste,true)
    // Native cut/export may carry expanded display macros; always read the original range.
    field.onExport=(from,_latex,range)=>transfer.value.copy(from.getValue(range,'latex'))
  }
  function dispose() {
    disposed=true;target=undefined
    options.field()?.removeEventListener('copy',onCopy,true)
    options.field()?.removeEventListener('paste',onPaste,true)
  }
  return {feedback,error,manualOpen,manualText,copy,paste,confirmManual,cancelManual,clear,attach,dispose}
}
