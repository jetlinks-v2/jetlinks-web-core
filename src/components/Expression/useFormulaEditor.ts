import { onBeforeUnmount,onMounted,ref,shallowRef,watch,h,render,resolveComponent } from 'vue'
import { isEqual } from 'lodash-es'
import type { EditorView as CodeView } from '@codemirror/view'
import type { ExpressionNode } from './types'
import type { ExpressionEditorContext } from './editor'
import { expressionDocument,expressionCompletions,projectExpressionTokens,referenceKey,type ExpressionDocument,type ExpressionToken,type ExpressionTranslate } from './document'
import { referenceIcon } from './presentation'
import type { ExpressionDiagnostic } from './parse'
import type { FormulaModel as Model } from './editorState'
import { createEditorUpdates } from './editorUpdates'

/** 单一活动编辑器持有历史；只读列表不加载编辑器内核。 */
export function useFormulaEditor(node:()=>ExpressionNode,context:()=>ExpressionEditorContext,t:ExpressionTranslate,change:(value:ExpressionNode)=>void,invalid:(value:boolean)=>void,empty:()=>boolean=()=>false) {
  const host=ref<HTMLElement>(),ready=ref(false),loadError=ref(false),error=shallowRef<ExpressionDiagnostic>(),signature=ref('')
  const Icon=resolveComponent('AIcon')
  let view:CodeView|undefined,disposed=false,starting=false,lastEmitted:ExpressionNode|undefined,choice:'reference'|'function'|undefined
  let actions:{undo:()=>void;redo:()=>void;complete:()=>void;reset:()=>void;configure:()=>void;catalog:()=>void;format:()=>void}|undefined
  const updates=createEditorUpdates(kind=>actions?.[kind]())
  async function start() {
    if(starting || disposed || !host.value || context().disabled || view) return
    starting=true;loadError.value=false
    try {
      const [{EditorState,Compartment},{EditorView,WidgetType,Decoration,keymap,drawSelection,placeholder},{history,historyKeymap,defaultKeymap,undo,redo,invertedEffects},{autocompletion,completionKeymap,closeBrackets,closeBracketsKeymap,startCompletion,completionStatus},{foldService,foldGutter,codeFolding,foldKeymap},{createFormulaState}]=await Promise.all([import('@codemirror/state'),import('@codemirror/view'),import('@codemirror/commands'),import('@codemirror/autocomplete'),import('@codemirror/language'),import('./editorState')])
      if(disposed || !host.value) return
      const {field:model,restore:reset,initial}=createFormulaState(node,context,t,empty)
      const permissions=new Compartment()
      class FunctionIcon extends WidgetType {
        eq() {return true}
        toDOM() {
          const dom=window.document.createElement('span')
          dom.className='expression-token__icon is-function';dom.setAttribute('aria-hidden','true')
          render(h(Icon,{type:'FunctionOutlined'}),dom)
          return dom
        }
        destroy(dom:HTMLElement) {render(null,dom)}
      }
      class TokenWidget extends WidgetType {
        constructor(readonly token:ExpressionToken) {super()}
        eq(other:TokenWidget) {return this.token.label === other.token.label && this.token.meaning === other.token.meaning && this.token.title === other.token.title && this.token.kind === other.token.kind && this.token.from === other.token.from && this.token.to === other.token.to}
        toDOM() {
          const dom=window.document.createElement('span')
          dom.className=`expression-token is-${this.token.kind}`;dom.title=this.token.title || '';dom.dataset.expressionFrom=String(this.token.from);dom.dataset.expressionTo=String(this.token.to)
          if(this.token.meaning)dom.classList.add('has-meaning')
          if(this.token.node.type === 'reference') {
            dom.dataset.expressionReference=referenceKey(this.token.node)
            if(this.token.node.id === 'params')dom.classList.add('is-parameter')
          }
          render(h('span',{},[...(['reference','function'].includes(this.token.kind) ? [h(Icon,{type:referenceIcon(this.token,context()),class:'expression-token__icon','aria-hidden':'true'})] : []),this.token.label,...(this.token.meaning ? [h('small',{class:'expression-token__code'},this.token.meaning)] : [])]),dom)
          return dom
        }
        destroy(dom:HTMLElement) {render(null,dom)}
        ignoreEvent() {return false}
      }
      const functionIcon=new FunctionIcon()
      const ranges=(document:ExpressionDocument,atomic=false)=>Decoration.set(document.tokens.filter(token=>token.from <= token.to && token.to <= document.text.length && (token.from < token.to || token.label) && (!atomic || token.from < token.to && (token.label !== token.text || token.meaning))).flatMap(token=>{
        const range=token.from === token.to ? Decoration.widget({widget:new TokenWidget(token),side:-1}).range(token.from) : token.label === token.text && !token.meaning ? Decoration.mark({class:`expression-token is-${token.kind}`}).range(token.from,token.to) : Decoration.replace({widget:new TokenWidget(token)}).range(token.from,token.to)
        return !atomic && token.kind === 'function' && token.label === token.text ? [Decoration.widget({widget:functionIcon,side:-1}).range(token.from),range] : [range]
      }),true)
      // 撤销同时还原精度及引用元数据；外部切换公式才清理本地历史。
      const replace=(value:Model)=>view?.dispatch({changes:{from:0,to:view.state.doc.length,insert:value.document.text},effects:reset.of(value)})
      const configure=()=>view?.dispatch({effects:permissions.reconfigure([EditorState.readOnly.of(!!context().disabled),EditorView.editable.of(!context().disabled)])})
      const createState=()=>EditorState.create({doc:initial().document.text,extensions:[
        model,EditorView.decorations.from(model,value=>ranges(value.document)),history(),invertedEffects.of(tr=>tr.docChanged ? [reset.of(tr.startState.field(model))] : []),drawSelection(),closeBrackets(),keymap.of([...closeBracketsKeymap,...completionKeymap,...historyKeymap,...foldKeymap,...defaultKeymap]),
        foldGutter({openText:'⌄',closedText:'›'}),codeFolding(),
        foldService.of((state,start,end)=>{const span=state.field(model).document.spans.filter(item=>item.from >= start && item.from <= end && item.to > end && state.doc.lineAt(item.to).number > state.doc.lineAt(start).number).sort((a,b)=>(a.to-a.from)-(b.to-b.from))[0];return span ? {from:end,to:span.to} : null}),
        EditorState.phrases.of({'Fold line':t('fold'),'Unfold line':t('unfold'),'Folded code':t('folded'),'Unfold':t('unfold')}),
        EditorView.lineWrapping,placeholder(t('startFormula')),EditorView.contentAttributes.of({'aria-label':t('formula'),'spellcheck':'false'}),
        permissions.of([EditorState.readOnly.of(false),EditorView.editable.of(true)]),EditorView.atomicRanges.of(editor=>ranges(editor.state.field(model).document,true)),
        EditorView.decorations.compute([model],state=>{const value=state.field(model),length=state.doc.length;if(!value.error || !length)return Decoration.none;const from=Math.min(value.error.from,length-1),to=Math.max(from+1,Math.min(value.error.to,length));return Decoration.set([Decoration.mark({class:'expression-invalid'}).range(from,to)])}),
        autocompletion({override:[completion=>{
          const document=completion.state.field(model).document,selection=completion.state.selection.main
          const selected=document.tokens.find(item=>item.kind === 'reference' && item.from === selection.from && item.to === selection.to)
          const word=completion.matchBefore(/[\p{L}\p{N}_$]+/u)
          if(!completion.explicit && !word)return null
          return {from:selected?.from ?? word?.from ?? completion.pos,to:selected?.to ?? completion.pos,filter:!selected,options:expressionCompletions(document,context().functions,t).filter(item=>!choice || item.type === (choice === 'reference' ? 'variable' : 'function')).map(item=>({...item,info:item.detail,apply:(editor:CodeView,_entry:unknown,from:number,to:number)=>{choice=undefined;editor.dispatch({changes:{from,to,insert:item.apply},selection:{anchor:from+item.apply.length-(item.type === 'function' ? 1 : 0)},userEvent:'input.complete'});editor.focus()}}))}
        }]}),
        EditorView.domEventHandlers({mousedown(event,editor){
          const target=(event.target as HTMLElement).closest<HTMLElement>('.expression-token.is-reference')
          if(!target || context().disabled)return false
          event.preventDefault();choice='reference';editor.dispatch({selection:{anchor:Number(target.dataset.expressionFrom),head:Number(target.dataset.expressionTo)}});editor.focus();startCompletion(editor);return true
        }}),
        EditorView.updateListener.of(update=>{
          const value=update.state.field(model)
          if(!completionStatus(update.state) && completionStatus(update.startState))choice=undefined
          if(update.docChanged) {error.value=value.error;invalid(!!value.error || !!value.empty);if(!context().disabled && !value.error && !value.empty) {lastEmitted=value.node;change(value.node)}}
          if(update.selectionSet || update.docChanged || update.focusChanged) {
            const pos=update.state.selection.main.head
            const call=value.document.spans.filter(item=>item.node.type === 'call' && item.from <= pos && item.to >= pos).sort((a,b)=>(a.to-a.from)-(b.to-b.from))[0]
            const id=call?.node.type === 'call' ? call.node.function : undefined,fn=context().functions.find(item=>item.id === id)
            signature.value=update.view.hasFocus && fn ? `${fn.name}(${fn.parameters.map(item=>item.name).join('，')}) · ${fn.description}` : ''
          }
        }),
      ]})
      view=new EditorView({parent:host.value,state:createState()})
      actions={undo:()=>{if(!context().disabled)undo(view!);view!.focus()},redo:()=>{if(!context().disabled)redo(view!);view!.focus()},complete:()=>startCompletion(view!),reset:()=>{view!.setState(createState());choice=undefined;signature.value='';configure()},configure,
        catalog:()=>{
          const current=view!.state.field(model),fresh=expressionDocument(current.node,context(),t)
          const references=new Map(current.document.references),functions=new Map(current.document.functions)
          for(const [alias,value] of fresh.references) {let name=alias;while(references.has(name) && !isEqual(references.get(name),value))name+=' ·';references.set(name,value)}
          for(const [alias,value] of fresh.functions) {let name=alias;while(functions.has(name) && functions.get(name) !== value)name+='_';functions.set(name,value)}
          const tokens=current.document.tokens.map(token=>{
            if(token.node.type === 'reference') {const node=token.node,reference=fresh.tokens.find(item=>item.node.type === 'reference' && referenceKey(item.node) === referenceKey(node));return {...token,label:reference?.label || token.label,title:reference?.title}}
            if(token.node.type === 'call' && token.kind === 'function') {const node=token.node;return {...token,label:context().functions.find(item=>item.id === node.function)?.name || token.label}}
            return token
          })
          view!.dispatch({effects:reset.of({...current,document:{...current.document,tokens:projectExpressionTokens({...current.document,tokens},current.node,context(),t),functions,references}})})
        },
        format:()=>{const current=view!.state.field(model);if(!context().disabled && !current.error && !current.empty)replace({document:expressionDocument(current.node,context(),t),node:current.node})}}
      configure();ready.value=true
    } catch(cause) {loadError.value=true;console.warn('Unable to load formula editor',cause)}
    finally {starting=false}
  }
  watch(()=>({node:node(),empty:empty()}),(value,previous)=>{
    if(!isEqual(value,previous) && (value.empty || !isEqual(value.node,lastEmitted))) {lastEmitted=undefined;error.value=undefined;invalid(false);updates.schedule('reset')}
  })
  watch(()=>context().disabled,()=>{if(view)updates.schedule('configure');else start()})
  watch(()=>context().functions,()=>updates.schedule('catalog'))
  watch(()=>context().references,()=>updates.schedule('catalog'))
  watch(()=>context().resultLabels,()=>updates.schedule('catalog'))
  onMounted(start)
  watch(host,()=>void start(),{flush:'post'})
  onBeforeUnmount(()=>{disposed=true;updates.dispose();view?.destroy();view=undefined;invalid(false)})
  return {host,ready,loadError,error,signature,retry:start,undo:()=>actions?.undo(),redo:()=>actions?.redo(),complete:(kind:'reference'|'function')=>{choice=kind;view?.focus();actions?.complete()},format:()=>actions?.format()}
}
