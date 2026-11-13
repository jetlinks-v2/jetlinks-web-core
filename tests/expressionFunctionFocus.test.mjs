import assert from 'node:assert/strict'
import test from 'node:test'
import { h } from 'vue'
import { createMetricLoader, createMetricRenderer, flush } from './helpers/metricRuntime.mjs'

for (const [id, count] of [['math.abs', 1], ['math.min', 2]]) {
  test(`函数菜单接管焦点后仍在原选区插入 ${id}`, async () => {
    let field, editor
    const previousDocument = globalThis.document
    globalThis.document = {}
    class Field {
      constructor() { field = this; this.value = '0'; this.selection = { ranges: [[1, 1]] }; this.inserts = [] }
      get lastOffset() { return 1 }
      getValue(start, end) { return typeof start === 'number' ? start === end ? '' : this.value : this.value }
      getElementInfo(offset) { return { latex: offset ? this.value : '', depth: 0 } }
      setAttribute() {}
      addEventListener() {}
      removeEventListener() {}
      focus() {}
      remove() {}
      executeCommand() { return true }
      insert(latex) { this.inserts.push({ latex, selection: structuredClone(this.selection) }); this.value = latex; return true }
    }
    const changes = []
    const load = createMetricLoader({
      'vue-i18n': { useI18n: () => ({ t: key => key }) },
      '@vueuse/core': { onClickOutside() {} },
      'mathlive': { MathfieldElement: Field },
      'mathlive/fonts.css': {},
      './math-semantic.css?inline': { __esModule: true, default: '' },
    })
    const { useMathEditor } = load('components/Expression/useMathEditor.ts')
    const { renderer, root } = createMetricRenderer()
    const app = renderer.createApp({ setup() {
      editor = useMathEditor({
        modelValue: { version: 1, root: { type: 'literal', valueType: 'int', value: '0' } },
        context: { references: [], functions: [{ id, name: id, returnType: 'number', minimumArguments: count, maximumArguments: count, parameters: [] }] },
      }, (...args) => changes.push(args))
      editor.host.value = { appendChild() {} }
      return () => h('div')
    } })
    try {
      app.mount(root)
      await flush()
      assert.equal(editor.ready.value, true)
      editor.functionMenuVisibilityChanged(true)
      editor.blurCommit() // Native focusout runs before the menu item's click.
      assert.equal(editor.functionMenuOpen.value, true, '菜单获得焦点不能被失焦提交关闭')
      assert.deepEqual(changes, [], '内部焦点转移不提交或清空草稿')
      field.selection = { ranges: [[0, 0]] }
      editor.chooseFunction({ key: id })
      assert.equal(field.inserts.length, 1)
      assert.deepEqual(field.inserts[0].selection.ranges, [[0, 1]], '使用打开菜单时保存的选区')
      assert.equal(field.inserts[0].latex.match(/#\?/g)?.length, count)
      assert.equal(editor.functionMenuOpen.value, false)
      field.value = '0'
      editor.blurCommit()
      assert.ok(changes.some(([event]) => event === 'update:modelValue'), '普通失焦仍提交有效公式')
    } finally {
      app.unmount()
      if (previousDocument === undefined) delete globalThis.document
      else globalThis.document = previousDocument
    }
  })
}

const literal=value=>({type:'literal',valueType:'int',value:String(value)})
const reference={type:'reference',id:'value',path:[]}
const plus={type:'binary',operator:'add',left:reference,right:literal(1)}
const functions=[
  {id:'math.abs',name:'abs',returnType:'number',minimumArguments:1,maximumArguments:1},
  {id:'math.sqrt',name:'sqrt',returnType:'number',minimumArguments:1,maximumArguments:1},
  {id:'math.min',name:'min',returnType:'number',minimumArguments:2,maximumArguments:16},
  {id:'math.mapRange',name:'mapRange',returnType:'number',minimumArguments:5,maximumArguments:5},
  {id:'math.optional',name:'optional',returnType:'number',minimumArguments:0,maximumArguments:1},
  {id:'math.constant',name:'constant',returnType:'number',minimumArguments:0,maximumArguments:0},
].map(fn=>({...fn,parameters:[{id:'value',name:'value',valueType:'number'}]}))
async function withSelection({tokens,root:expression,range,depths},run) {
  const previousDocument=globalThis.document
  globalThis.document={}
  let field,editor
  class Field {
    constructor(){field=this;this.tokens=['',...tokens];this.selection={ranges:[range]};this.inserts=[]}
    get lastOffset(){return this.tokens.length-1}
    getValue(start,end){return typeof start === 'number' ? this.tokens.slice(start+1,end+1).join('') : this.tokens.slice(1).join('')}
    getElementInfo(offset){return {latex:this.tokens[offset],depth:depths?.[offset] ?? 0}}
    setAttribute(){} addEventListener(){} removeEventListener(){} focus(){} remove(){}
    insert(latex) {
      const [start,end]=this.selection.ranges[0],selected=this.getValue(start,end)
      this.inserts.push({latex,range:[start,end]})
      this.tokens.splice(start+1,end-start,latex.replaceAll('#0',selected).replaceAll('#?','\\placeholder{}'))
      this.selection={ranges:[[start,start+1]]}
    }
  }
  const {useMathEditor}=createMetricLoader({'vue-i18n':{useI18n:()=>({t:key=>key})},'@vueuse/core':{onClickOutside(){}},mathlive:{MathfieldElement:Field},'mathlive/fonts.css':{},'./math-semantic.css?inline':{__esModule:true,default:''}})('components/Expression/useMathEditor.ts')
  const changes=[],{renderer,root}=createMetricRenderer()
  const app=renderer.createApp({setup(){editor=useMathEditor({modelValue:{version:1,root:expression},context:{references:[{...reference,label:'value',schema:{type:'number'}}],functions}},(...event)=>changes.push(event));editor.host.value={appendChild(){}};return()=>h('div')}})
  try {app.mount(root);await flush();await run({field,editor,changes})}
  finally {app.unmount();if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument}
}

test('变量切换到函数时关闭旧候选，保留原选区并忽略旧菜单关闭事件',()=>withSelection({tokens:['\\JLa','+','1','+','2'],root:{type:'binary',operator:'add',left:plus,right:literal(2)},range:[0,3]},async({field,editor})=>{
  editor.canvas.value={clientHeight:40}
  field.blur=()=>{}
  await editor.openReferences()
  assert.deepEqual(editor.referenceSelection.value.ranges,[[0,3]])
  field.selection={ranges:[[5,5]]}
  editor.functionMenuVisibilityChanged(true)
  assert.equal(editor.referenceSelection.value,undefined)
  assert.equal(editor.functionMenuOpen.value,true)
  editor.referenceVisibilityChanged(false)
  assert.equal(editor.functionMenuOpen.value,true,'旧变量菜单的关闭不能关闭新函数菜单')
  editor.chooseFunction({key:'math.abs'})
  assert.deepEqual(field.inserts[0].range,[0,3])
}))

test('函数切换到变量时使用原选区，变量切换到其他菜单时恢复同一选区',()=>withSelection({tokens:['\\JLa','+','1'],root:plus,range:[0,3]},async({field,editor})=>{
  editor.canvas.value={clientHeight:40}
  field.blur=()=>{}
  editor.functionMenuVisibilityChanged(true)
  field.selection={ranges:[[3,3]]}
  await editor.openReferences()
  assert.equal(editor.functionMenuOpen.value,false)
  assert.deepEqual(editor.referenceSelection.value.ranges,[[0,3]])
  field.selection={ranges:[[1,1]]}
  editor.prepareToolbarMenu(true)
  assert.equal(editor.referenceSelection.value,undefined)
  assert.deepEqual(field.selection.ranges,[[0,3]])
}))

for(const id of ['math.abs','math.sqrt','math.min','math.mapRange','math.optional']) {
  test(`选中子表达式后作为 ${id} 的首个参数，其余必填参数留空`,()=>withSelection({tokens:['\\JLa','+','1','+','2'],root:{type:'binary',operator:'add',left:plus,right:literal(2)},range:[0,3]},({field,editor,changes})=>{
    editor.functionMenuVisibilityChanged(true)
    field.selection={ranges:[[5,5]]} // 菜单焦点转移不能改变保存的选区。
    editor.chooseFunction({key:id})
    assert.equal(field.inserts.length,1)
    assert.deepEqual(field.inserts[0].range,[0,3])
    assert.equal((field.inserts[0].latex.match(/#0/g)||[]).length,1)
    assert.equal((field.inserts[0].latex.match(/#\?/g)||[]).length,Math.max(1,functions.find(fn=>fn.id===id).minimumArguments)-1)
    assert.ok(field.getValue().endsWith('+2'),'外围表达式保留')
    if(['math.abs','math.sqrt','math.optional'].includes(id)) {
      const tree=changes.find(([event])=>event==='update:modelValue')?.[1]
      assert.equal(tree.root.left.function,id)
      assert.deepEqual(tree.root.left.arguments,[plus])
    }
  }))
}
test('显式选中的零作为实参保留；参数类型不匹配或无参函数不能吞掉选区',async()=>{
  await withSelection({tokens:['0'],root:literal(0),range:[0,1]},({editor,changes})=>{
    editor.functionMenuVisibilityChanged(true)
    assert.equal(editor.availableFunctions.value.find(fn=>fn.id==='math.constant').disabled,true)
    editor.chooseFunction({key:'math.abs'})
    assert.deepEqual(changes.find(([event])=>event==='update:modelValue')[1].root.arguments,[literal(0)])
  })
  await withSelection({tokens:['\\JLtrue'],root:{type:'literal',valueType:'boolean',value:true},range:[0,1]},({editor,field})=>{
    editor.functionMenuVisibilityChanged(true)
    assert.equal(editor.availableFunctions.value.find(fn=>fn.id==='math.abs').disabled,true)
    editor.chooseFunction({key:'math.abs'})
    assert.equal(field.inserts.length,0)
    assert.equal(field.getValue(),'\\JLtrue')
  })
})
test('点击已有函数名称替换函数时保留原参数，不额外嵌套旧函数',()=>withSelection({tokens:['\\operatorname{abs}\\left(\\JLa\\right)'],root:{type:'call',function:'math.abs',arguments:[reference]},range:[0,1]},({editor,field})=>{
  editor.functionSelection.value={range:[0,1],id:'math.abs',count:1,argumentsLatex:'\\left(\\JLa\\right)'}
  editor.chooseFunction({key:'math.min'})
  assert.equal(field.inserts.length,1)
  assert.equal(field.inserts[0].latex,'\\operatorname{min}\\left(\\JLa,\\placeholder{}\\right)')
}))
