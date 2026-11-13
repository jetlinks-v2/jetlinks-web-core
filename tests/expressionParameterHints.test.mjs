import assert from 'node:assert/strict'
import test from 'node:test'
import { createMetricLoader } from './helpers/metricRuntime.mjs'

const load=createMetricLoader()
const {useMathInsertion}=load('components/Expression/useMathInsertion.ts')
const {createMathParser}=load('components/Expression/math.ts')
const number=value=>({type:'literal',valueType:'int',value:String(value)})
const parameters=names=>names.map((name,index)=>({id:`arg${index}`,name,valueType:'number'}))
const functions=[
  {id:'math.mapRange',name:'量程换算',returnType:'number',minimumArguments:5,maximumArguments:5,parameters:parameters(['数值','输入下界','输入上界','输出下界','输出上界'])},
  {id:'math.min',name:'最小值',returnType:'number',minimumArguments:2,maximumArguments:16,parameters:parameters(['数值'])},
  {id:'math.max',name:'最大值',returnType:'number',minimumArguments:2,maximumArguments:16,parameters:parameters(['数值'])},
  {id:'math.sqrt',name:'平方根',returnType:'number',minimumArguments:1,maximumArguments:1,parameters:parameters(['数值'])},
]
function setup(tokens,depths,boxes) {
  let disabled=false
  const context={references:[],functions},root=number(0)
  const field={lastOffset:tokens.length-1,selection:{ranges:[[0,0]]},
    getValue(start,end){return typeof start === 'number' ? tokens.slice(start+1,end+1).join('') : tokens.slice(1).join('')},
    getOffsetFromPoint(x,y) {
      return Number(Object.entries(boxes).filter(([,box])=>x>=box.left && x<=box.right && y>=box.top && y<=box.bottom).sort(([a],[b])=>depths[b]-depths[a])[0]?.[0] ?? -1)
    },
    getElementInfo(offset){return {latex:tokens[offset],depth:depths[offset],bounds:boxes[offset]}},
  }
  const parser=createMathParser(root,context,key=>key)
  const insertion=useMathInsertion({field:()=>field,context:()=>context,root:()=>root,parser:()=>parser,commit(){assert.fail('悬浮提示不提交草稿')},disabled:()=>disabled})
  return {insertion,disable(){disabled=true}}
}
const box=left=>({left,right:left+10,top:10,bottom:30})
test('未填完的量程换算逐个定位五个参数，函数名仍能识别完整调用',()=>{
  const tokens=['','\\operatorname{量程换算}','','\\placeholder{}',',','\\placeholder{}',',','\\placeholder{}',',','\\placeholder{}',',','\\placeholder{}','\\left(\\placeholder{},\\placeholder{},\\placeholder{},\\placeholder{},\\placeholder{}\\right)']
  const boxes={1:box(0),...Object.fromEntries([3,5,7,9,11].map((offset,index)=>[offset,box(30+index*20)]))}
  const state=setup(tokens,[0,0,1,1,1,1,1,1,1,1,1,1,0],boxes)
  for(let index=0;index<5;index++) {
    const hint=state.insertion.parameterAtPoint(35+index*20,20)
    assert.equal(hint.descriptor.id,'math.mapRange')
    assert.equal(hint.index,index)
    assert.equal(hint.parameter.name,functions[0].parameters[index].name)
  }
  assert.equal(state.insertion.functionAtPoint(5,20).count,5)
  assert.equal(state.insertion.parameterAtPoint(300,20),undefined)
  state.disable();assert.equal(state.insertion.parameterAtPoint(35,20),undefined)
})
test('嵌套函数按内层逗号计数；变参名称复用声明且位置保持真实序号',()=>{
  const tokens=['','\\operatorname{最大值}','','1',',','\\operatorname{最小值}','','\\placeholder{}',',','\\placeholder{}','\\left(\\placeholder{},\\placeholder{}\\right)','\\left(1,\\operatorname{最小值}\\left(\\placeholder{},\\placeholder{}\\right)\\right)']
  const state=setup(tokens,[0,0,1,1,1,1,2,2,2,2,1,0],{3:box(0),7:box(30),9:box(50),10:{left:25,right:65,top:5,bottom:35},11:{left:0,right:80,top:0,bottom:40}})
  const outer=state.insertion.parameterAtPoint(5,20),inner=state.insertion.parameterAtPoint(55,20)
  assert.equal(outer.descriptor.id,'math.max');assert.equal(outer.index,0)
  assert.equal(inner.descriptor.id,'math.min');assert.equal(inner.index,1)
  assert.equal(inner.parameter.name,'数值')
})
test('根式参数复用目录声明',()=>{
  const state=setup(['','','\\placeholder{}','\\sqrt{\\placeholder{}}'],[0,1,1,0],{2:box(20),3:{left:0,right:40,top:0,bottom:40}})
  const hint=state.insertion.parameterAtPoint(25,20)
  assert.equal(hint.descriptor.id,'math.sqrt');assert.equal(hint.index,0)
  assert.equal(hint.parameter.valueType,'number')
})

test('选中的空参数立即提供气泡，离开后清除；首次挂载使用画布弹层宿主',async()=>{
  const {h}=await import('vue')
  const {createMetricRenderer,flush}=await import('./helpers/metricRuntime.mjs')
  const previousDocument=globalThis.document,previousElement=globalThis.HTMLElement
  class Element {dataset={};textContent='▢';removeAttribute() {}}
  globalThis.document={};globalThis.HTMLElement=Element
  const tokens=['','\\operatorname{绝对值}','','\\placeholder{}','\\left(\\placeholder{}\\right)']
  let field,editor
  class Field extends Element {
    constructor(){super();field=this;this.selection={ranges:[[2,3]]}}
    get lastOffset(){return 4}
    getValue(start,end){return typeof start === 'number' ? tokens.slice(start+1,end+1).join('') : tokens.slice(1).join('')}
    getElementInfo(offset){return {latex:tokens[offset],depth:[0,0,1,1,0][offset],bounds:offset===3 ? {left:20,right:30,top:20,bottom:40} : undefined}}
    getOffsetFromPoint(){return 3}
    setAttribute(){} addEventListener(){} removeEventListener(){} remove(){}
  }
  const loadEditor=createMetricLoader({
    'vue-i18n':{useI18n:()=>({t:key=>key})},'@vueuse/core':{onClickOutside(){}},
    mathlive:{MathfieldElement:Field},'mathlive/fonts.css':{},'./math-semantic.css?inline':{__esModule:true,default:''},
  })
  const {useMathEditor}=loadEditor('components/Expression/useMathEditor.ts')
  const {renderer,root}=createMetricRenderer(),body={}
  const app=renderer.createApp({setup(){
    editor=useMathEditor({modelValue:{version:1,root:number(0)},context:{references:[],functions:[{id:'math.abs',name:'绝对值',description:'返回绝对值',returnType:'number',minimumArguments:1,maximumArguments:1,parameters:parameters(['待处理数值'])}]}},()=>{})
    editor.host.value={appendChild(){}}
    editor.canvas.value={offsetWidth:100,offsetHeight:100,getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),closest:()=>undefined,ownerDocument:{body}}
    return()=>h('div')
  }})
  try {
    app.mount(root);await flush()
    assert.deepEqual(editor.popupContainer(),body)
    editor.previewAtPoint({buttons:0,clientX:25,clientY:30,composedPath:()=>[new Element(),field]})
    assert.equal(editor.hoverHint.value.name,'待处理数值')
    assert.equal(editor.hoverHint.value.context,'绝对值 · parameter 1')
    assert.equal(editor.hoverFrame.value,undefined,'已选中参数仍可提示，不覆盖原生选区')
    editor.clearPreview();assert.equal(editor.hoverHint.value,undefined)
  } finally {
    app.unmount()
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument
    if(previousElement===undefined)delete globalThis.HTMLElement;else globalThis.HTMLElement=previousElement
  }
})
