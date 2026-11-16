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
      blur() {}
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
    constructor(){field=this;this.tokens=['',...tokens];this.selection={ranges:[range]};this.inserts=[];this.attributes={}}
    get lastOffset(){return this.tokens.length-1}
    getValue(start,end){return typeof start === 'number' ? this.tokens.slice(start+1,end+1).join('') : this.tokens.slice(1).join('')}
    getElementInfo(offset){return {latex:this.tokens[offset],depth:depths?.[offset] ?? 0}}
    setAttribute(name,value){this.attributes[name]=value} addEventListener(){} removeEventListener(){} focus(){} blur(){} remove(){} canUndo(){return false} canRedo(){return false}
    insert(latex) {
      const [start,end]=this.selection.ranges[0],selected=this.getValue(start,end)
      this.inserts.push({latex,range:[start,end]})
      this.tokens.splice(start+1,end-start,latex.replaceAll('#0',selected).replaceAll('#?','\\placeholder{}'))
      this.selection={ranges:[[start,start+1]]}
    }
  }
  const {useMathEditor}=createMetricLoader({'vue-i18n':{useI18n:()=>({t:key=>key})},'@vueuse/core':{onClickOutside(){}},mathlive:{MathfieldElement:Field},'mathlive/fonts.css':{},'./math-semantic.css?inline':{__esModule:true,default:''}})('components/Expression/useMathEditor.ts')
  const changes=[],{renderer,root}=createMetricRenderer()
  const app=renderer.createApp({setup(){editor=useMathEditor({modelValue:{version:1,root:expression},conditions:true,context:{references:[{...reference,label:'value',schema:{type:'number'}}],functions}},(...event)=>changes.push(event));editor.host.value={appendChild(){}};return()=>h('div')}})
  try {app.mount(root);await flush();await run({field,editor,changes})}
  finally {app.unmount();if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument}
}

test('变量切换到函数时关闭旧候选，保留原选区',()=>withSelection({tokens:['\\JLa','+','1','+','2'],root:{type:'binary',operator:'add',left:plus,right:literal(2)},range:[0,3]},async({field,editor})=>{
  editor.canvas.value={clientHeight:40}
  field.blur=()=>{}
  await editor.openReferences()
  assert.deepEqual(editor.referenceSelection.value.ranges,[[0,3]])
  field.selection={ranges:[[5,5]]}
  editor.functionMenuVisibilityChanged(true)
  assert.equal(editor.referenceSelection.value,undefined)
  assert.equal(editor.functionMenuOpen.value,true)
  assert.equal(editor.functionMenuOpen.value,true,'切换后只保留新函数菜单')
  editor.chooseFunction({key:'math.abs'})
  assert.deepEqual(field.inserts[0].range,[0,3])
}))

test('公式右键菜单接管原生菜单，执行原生命令前恢复选区；搜索输入不被接管',()=>withSelection({tokens:['\\JLa','+','1'],root:plus,range:[0,3]},({field,editor})=>{
  editor.canvas.value={clientHeight:40}
  field.canUndo=()=>true;field.canRedo=()=>false
  const commands=[]
  field.executeCommand=command=>{commands.push({command,selection:structuredClone(field.selection)});return true}
  let prevented=false,stopped=false
  const event={clientX:0,clientY:0,composedPath:()=>[],preventDefault:()=>prevented=true,stopPropagation:()=>stopped=true}
  editor.openContextMenu(event)
  assert.equal(prevented,false)
  editor.openContextMenu({...event,composedPath:()=>[field]})
  assert.equal(prevented,true);assert.equal(stopped,true)
  assert.equal(editor.contextMenuOpen.value,true)
  assert.equal(editor.contextCanUndo.value,true);assert.equal(editor.contextCanRedo.value,false)
  field.selection={ranges:[[1,1]]}
  editor.contextAction({key:'selectAll'})
  assert.equal(editor.contextMenuOpen.value,false)
  assert.deepEqual(commands,[{command:'selectAll',selection:{ranges:[[0,3]]}}])
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

for(const kind of ['function','literal','condition']) {
  test(`${kind} 候选显示实际替换目标，获得焦点不提交；取消恢复原光标`,()=>withSelection({tokens:['1','2','3'],root:literal(123),range:[2,2]},({field,editor,changes})=>{
    editor.openInsertionMenu(kind)
    assert.deepEqual(field.selection.ranges,[[0,3]])
    assert.equal(field.attributes['data-insertion-target'],'true')
    editor.blurCommit()
    assert.deepEqual(changes,[])
    assert.equal(editor.functionMenuOpen.value || !!editor.insertionMenu.value,true)
    editor.closeReferences(true)
    assert.deepEqual(field.selection.ranges,[[2,2]])
    assert.equal(field.attributes['data-insertion-target'],'false')
    assert.equal(field.inserts.length,0,'打开或取消候选不产生编辑历史')
  }))
  test(`${kind} 在空公式显示插入光标`,()=>withSelection({tokens:[],root:literal(0),range:[0,0]},({field,editor})=>{
    editor.openInsertionMenu(kind)
    assert.deepEqual(field.selection.ranges,[[0,0]])
    assert.equal(field.attributes['data-insertion-target'],'true')
    assert.equal(field.inserts.length,0)
  }))
}
test('变量候选选中实际隐式替换范围；变量切换到值时保留同一目标',()=>withSelection({tokens:['\\JLa','+','1','2','3'],root:{type:'binary',operator:'add',left:reference,right:literal(123)},range:[3,3]},async({field,editor})=>{
  await editor.openReferences()
  assert.deepEqual(field.selection.ranges,[[2,5]])
  assert.deepEqual(editor.referenceSelection.value.ranges,[[3,3]],'保留原光标语义，不将预览选区当作用户选区')
  editor.openInsertionMenu('literal')
  assert.equal(editor.insertionMenu.value,'literal')
  field.selection={ranges:[[0,1]]}
  editor.chooseLiteral({key:'null'})
  assert.deepEqual(field.inserts[0].range,[2,5])
  assert.equal(field.getValue(),'\\JLa+\\JLemptyResult')
}))
test('函数的隐式替换预览不冒充显式选区参数',()=>withSelection({tokens:['1','2','3'],root:literal(123),range:[2,2]},({field,editor})=>{
  editor.openInsertionMenu('function')
  assert.deepEqual(field.selection.ranges,[[0,3]])
  editor.chooseFunction({key:'math.abs'})
  assert.deepEqual(field.inserts[0].range,[0,3])
  assert.ok(field.inserts[0].latex.includes('#?'))
  assert.ok(!field.inserts[0].latex.includes('#0'))
}))
test('条件候选复用实际分支范围和完整比较式，预览不改变最终操作范围',()=>withSelection({tokens:['\\JLa','>','1'],root:{type:'binary',operator:'gt',left:reference,right:literal(1)},range:[3,3]},({field,editor})=>{
  editor.openInsertionMenu('condition')
  assert.deepEqual(field.selection.ranges,[[0,3]],'新分支包装当前完整算式')
  editor.previewConditionTarget(0)
  assert.deepEqual(field.selection.ranges,[[0,3]],'逻辑非作用于完整比较式')
  field.selection={ranges:[[0,0]]}
  editor.chooseConditionOperator({key:'0'})
  assert.deepEqual(field.inserts[0].range,[0,3])
  assert.ok(field.getValue().startsWith('\\JLnot'))
}))
test('右键快捷入口保留原选区，复用函数参数限制与就地候选',()=>withSelection({tokens:['\\JLa','+','1','+','2'],root:{type:'binary',operator:'add',left:plus,right:literal(2)},range:[0,3]},({field,editor})=>{
  editor.openContextMenu({clientX:0,clientY:0,composedPath:()=>[field],preventDefault(){},stopPropagation(){}})
  assert.equal(editor.availableFunctions.value.find(item=>item.id === 'math.constant').disabled,true,'无参函数不能吞掉选中算式')
  field.selection={ranges:[[5,5]]}
  editor.contextAction({key:'function'})
  assert.equal(editor.contextMenuOpen.value,false)
  assert.equal(editor.functionMenuOpen.value,true)
  assert.deepEqual(field.selection.ranges,[[0,3]])
  editor.chooseFunction({key:'math.abs'})
  assert.deepEqual(field.inserts[0].range,[0,3])
  assert.ok(field.inserts[0].latex.includes('#0'))
  assert.ok(field.getValue().endsWith('+2'))
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
