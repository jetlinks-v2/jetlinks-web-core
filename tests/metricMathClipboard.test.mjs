import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, reactive } from 'vue'
import { createMetricLoader } from './helpers/metricRuntime.mjs'

const load=createMetricLoader()
const {createMathTransfer}=load('components/Expression/mathTransfer.ts')
const {expressionMath,createMathParser}=load('components/Expression/math.ts')
const {useMathClipboard}=load('components/Expression/useMathClipboard.ts')
const t=key=>key
const ref=(id,path=[])=>({type:'reference',id,path})
const value=(value,valueType='int')=>({type:'literal',valueType,value})
const binary=(operator,left,right)=>({type:'binary',operator,left,right})
const context={references:[{...ref('input'),label:'同名'},{...ref('params',['factor']),label:'同名'},{...ref('group',['nested','value']),label:'字段'}],functions:[{id:'math.max',name:'最大值',minimumArguments:1,maximumArguments:16}]}
const node=binary('multiply',ref('input'),ref('params',['factor']))

test('工业函数及短路空值函数通过宿主声明完成数学反显与LaTeX往返',async()=>{
  const specifications=[['math.mapRange',5,5],['math.clamp',3,3],['math.trunc',1,2],['math.wrap',3,3],['math.bitTest',2,2],['data.coalesce',2,16],['data.nullif',2,2]]
  const ctx={references:[{...ref('value'),label:'当前值',schema:{type:'double'}}],functions:specifications.map(([id,min,max])=>({id,name:id,icon:'text:ƒ',minimumArguments:min,maximumArguments:max}))}
  const {convertLatexToMarkup}=await import('mathlive/ssr')
  for(const [id,count] of specifications) {
    const root={type:'call',function:id,arguments:[ref('value'),...Array.from({length:count-1},(_,i)=>value(String(i+1)))]}
    const projection=expressionMath(root,ctx,t)
    const portable=createMathTransfer(root,ctx,t).copy(projection.latex)
    const restored=createMathTransfer(root,ctx,t).paste(portable)
    assert.deepEqual(createMathParser(root,ctx,t)(restored),root,id)
    assert.doesNotMatch(convertLatexToMarkup(portable),/ML__error/,id)
  }
})

test('剪贴板以稳定输入标识、字段路径和函数标识交换，重排／重名／切换语言不串值',async()=>{
  const root={type:'call',function:'math.max',arguments:[node,ref('group',['nested','value'])]}
  const projection=expressionMath(root,context,t)
  const portable=createMathTransfer(root,context,t).copy(projection.latex)
  assert.doesNotMatch(portable,/JL|最大值|同名/)
  assert.match(portable,/operatorname\{math.max\}/)
  assert.match(portable,/mathrm\{params\}\\left\[\\text\{"factor"\}/)
  const target={references:[...context.references].reverse().map(item=>({...item,label:'renamed'})),functions:context.functions.map(item=>({...item,name:'Highest'}))}
  const pasted=createMathTransfer(root,target,t).paste(`$$ ${portable} $$`)
  assert.deepEqual(createMathParser(root,target,t)(pasted),root)
  const {convertLatexToMarkup}=await import('mathlive/ssr')
  assert.doesNotMatch(convertLatexToMarkup(portable),/ML__error/)
})

test('条件／空值／布尔与文本数字枚举保留原始值，不导出文案或代入值',()=>{
  for(const literal of [value('1','string'),value('1'),value(false,'boolean')]) {
    const ctx={references:[{...ref('state'),label:'状态',schema:{type:'enum',elements:[{value:literal.valueType === 'int' ? 1 : literal.value,text:'状态名称'}]}}],functions:[]}
    const root={type:'conditional',condition:binary('eq',ref('state'),literal),whenTrue:literal,whenFalse:value(null,'null')}
    const portable=createMathTransfer(root,ctx,t).copy(expressionMath(root,ctx,t,undefined,false).latex)
    assert.doesNotMatch(portable,/状态名称|JLenum|JL/)
    assert.deepEqual(createMathParser(root,ctx,t)(createMathTransfer(root,ctx,t).paste(portable)),root)
  }
})

test('标识／路径中的TeX、JSON特殊字符无损；精确长整数和小数不经Number转换',()=>{
  const ctx={references:[{...ref('null'),label:'保留字'},{...ref('x_%{\\}', ['a.b','x"\\_{}']),label:'特殊字段'}],functions:[]}
  const roots=[ref('null'),ctx.references[1],value('9007199254740993','long'),value('0.123456789012345678901','decimal'),value('\\JLa {"x"} %_$','string')]
  for(const candidate of roots) {
    const root=candidate.type === 'reference' ? ref(candidate.id,candidate.path) : candidate
    const transfer=createMathTransfer(root,ctx,t),text=transfer.copy(expressionMath(root,ctx,t,undefined,false).latex)
    assert.deepEqual(createMathParser(root,ctx,t)(transfer.paste(text)),root)
  }
})

test('片段无需独立构成AST；缺来源／函数、旧目录宏和未知TeX不会猜测绑定',()=>{
  const transfer=createMathTransfer(node,context,t)
  assert.equal(transfer.copy('+'),'+');assert.equal(transfer.paste('+'),'+')
  for(const text of ['\\JLa','\\JLenuma','\\mathrm{missing}','\\mathrm{group}\\left[\\text{"missing"}\\right]','\\operatorname{other.max}(1)','\\href{x}{1}','\\placeholder{}','#0'])assert.throws(()=>transfer.paste(text),text)
  assert.throws(()=>transfer.paste('x'.repeat(16001)),/expressionTooLong/)
})

test('只读计算回放复制原定义，不复制本次代入值；失败反馈可恢复',async()=>{
  const {useExpressionWorkspace}=load('components/Expression/useExpressionWorkspace.ts')
  const oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');let copied,denied=false
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>{if(denied)throw new Error('denied');copied=text}}}})
  const props=reactive({node,context,explanation:{kind:'read',state:'available',value:123,path:['input'],children:[]}})
  const scope=effectScope(),model=scope.run(()=>useExpressionWorkspace(props,t))
  try {
    await model.copyFormula();assert.match(copied,/mathrm\{input\}/);assert.doesNotMatch(copied,/123/);assert.equal(model.copyFailed.value,false)
    denied=true;await model.copyFormula();assert.equal(model.copyFailed.value,true)
    denied=false;await model.copyFormula();assert.equal(model.copyFailed.value,false)
  }finally{scope.stop();if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator}
})

/** Only the native insertion/clipboard DOM boundary is replaced; the real expression parser runs. */
class Field {
  constructor(latex='') {this.value=latex;this.selection={ranges:[[0,latex.length]]};this.macros={};this.listeners=new Map();this.history=[]}
  getValue(range) {if(range?.ranges){const [a,b]=range.ranges[0];return this.value.slice(Math.min(a,b),Math.max(a,b))}return this.value}
  insert(latex) {const [a,b]=this.selection.ranges[0];this.history.push(this.value);this.value=this.value.slice(0,Math.min(a,b))+latex+this.value.slice(Math.max(a,b));this.selection={ranges:[[this.value.length,this.value.length]]};return true}
  setAttribute(){} remove(){this.removed=true} focus(){this.focused=true}
  addEventListener(key,fn){this.listeners.set(key,fn)} removeEventListener(key){this.listeners.delete(key)}
}
test('工具栏和原生粘贴共用先验证再提交；失败不触碰公式、选区或撤销历史',async()=>{
  const oldDocument=globalThis.document,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator')
  const state=reactive({disabled:false}),field=new Field('\\JLa+1'),commits=[],probes=[]
  let activeContext=context
  let clipboard='\\mathrm{input}+2',copied,denied=false,resolveRead
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>{copied=text},readText:async()=>{if(denied)throw new Error('denied');if(resolveRead)return new Promise(resolve=>{resolveRead=resolve});return clipboard}}}})
  globalThis.document={createElement:()=>{const probe=new Field();probes.push(probe);return probe},body:{appendChild(){}}}
  const scope=effectScope(),parser=createMathParser(binary('add',ref('input'),value('1')),context,t)
  const model=scope.run(()=>useMathClipboard({field:()=>field,root:()=>node,context:()=>activeContext,parser:()=>parser,disabled:()=>state.disabled,commit:()=>commits.push(parser(field.getValue())),t}))
  try {
    model.attach(field);await model.copy();assert.equal(copied,'\\mathrm{input}+1')
    await model.paste();assert.equal(commits.length,1);assert.equal(field.history.length,1)
    assert.equal(commits[0].right.value,'2');assert.ok(probes.every(item=>item.removed))
    field.selection={ranges:[[0,field.value.length]]}
    const before=field.getValue(),selection=structuredClone(field.selection),history=[...field.history]
    for(const text of ['\\mathrm{missing}', '1+', '\\href{x}{1}']){clipboard=text;await model.paste();assert.ok(model.error.value)}
    assert.equal(field.getValue(),before);assert.deepEqual(field.selection,selection);assert.deepEqual(field.history,history)
    state.disabled=true;await model.copy();assert.equal(copied.replaceAll(' ',''),'\\mathrm{input}+2')
    clipboard='3';await model.paste();assert.equal(commits.length,1)
    state.disabled=false;denied=true;await model.paste();assert.equal(model.manualOpen.value,true)
    model.manualText.value='\\mathrm{input}+3';model.confirmManual();assert.equal(commits.length,2);assert.equal(model.manualOpen.value,false)
    field.selection={ranges:[[0,field.value.length]]}
    const event={clipboardData:{getData:type=>type === 'text/plain' ? '\\mathrm{input}+4' : ''},preventDefault(){},stopImmediatePropagation(){}}
    field.listeners.get('paste')(event);assert.equal(commits.length,3)
    denied=false;resolveRead=true;const pending=model.paste();await Promise.resolve();state.disabled=true;resolveRead('42');await pending;assert.equal(commits.length,3)
    state.disabled=false;resolveRead=true;const switched=model.paste();await Promise.resolve();activeContext={...context};resolveRead('42');await switched;assert.equal(commits.length,3)
    model.dispose();assert.equal(field.listeners.size,0)
  }finally{scope.stop();globalThis.document=oldDocument;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator}
})
