import test from 'node:test'
import assert from 'node:assert/strict'
import { h,reactive } from 'vue'
import { createMetricLoader,createMetricRenderer,flush } from './helpers/metricRuntime.mjs'

const load=createMetricLoader()
const {validateExpressionTypes,expressionValidationMessage}=load('components/Expression/validation.ts')
const {createMathParser}=load('components/Expression/math.ts')
const {expressionDocument}=load('components/Expression/document.ts')
const {parseExpressionDocument}=load('components/Expression/parse.ts')
const value=(value,valueType='int')=>({type:'literal',valueType,value})
const reference=(id,path=[])=>({type:'reference',id,path})
const binary=(operator,left,right)=>({type:'binary',operator,left,right})
const conditional=(whenTrue,whenFalse)=>({type:'conditional',condition:value(true,'boolean'),whenTrue,whenFalse})
const call=(id,...args)=>({type:'call',function:id,arguments:args})
const root=reference('value'),yes=value(true,'boolean'),nil=value(null,'null')
const context={references:[{...root,label:'当前值',schema:{type:'double'}},{...reference('state'),label:'状态',schema:{type:'string'}}],functions:[
  {id:'math.floor',name:'向下取整',returnType:'number',minimumArguments:1,maximumArguments:1,parameters:[{id:'value',name:'数值',valueType:'number'}]},
  {id:'math.max',name:'最大值',returnType:'number',minimumArguments:1,maximumArguments:16,parameters:[{id:'value',name:'数值',valueType:'number'}]},
  ...['data.coalesce','data.nullif'].map(id=>({id,name:id,returnType:'any',minimumArguments:2,maximumArguments:16,parameters:[{id:'value',name:'值',valueType:'any'}]})),
],resultTypes:['number','null']}
const t=(key,args)=>args ? `${key}:${JSON.stringify(args)}` : key

test('真实 LaTeX 解析拒绝截图中的布尔分母并保留具体诊断',()=>{
  const parse=createMathParser(root,context,t)
  assert.throws(()=>parse(String.raw`\JLa\times1+\dfrac{\operatorname{向下取整}\left(1\right)}{1\ge2}`),/numericOperand/)
  for(const [latex,key] of [[String.raw`1+\JLtrue`,'numericOperand'],[String.raw`\operatorname{向下取整}\left(\JLtrue\right)`,'functionArgumentType'],[String.raw`1\JLand 2`,'booleanOperand']]) {
    assert.throws(()=>parse(latex),error=>error.key === key)
  }
  assert.equal(validateExpressionTypes(parse('1+2'),context),undefined)
  assert.equal(parse(String.raw`1\ge2`).type,'binary','布尔片段不套用属性整式约束')
  const document=expressionDocument(root,context,t)
  const diagnostic=parseExpressionDocument('1 + (1 >= 2)',document,context,root,t).error
  assert.equal(diagnostic.key,'numericOperand')
  assert.equal('1 + (1 >= 2)'.slice(diagnostic.from,diagnostic.to),'1 >= 2')
})

test('递归检查四则、逻辑、比较、函数变参及异构分支',()=>{
  for(const operator of ['add','subtract','multiply','divide','mod']) {
    for(const wrong of [yes,nil,value('2','string'),conditional(value('1'),yes)])assert.equal(validateExpressionTypes(binary(operator,root,wrong),context)?.key,'numericOperand')
  }
  for(const [node,key] of [
    [{type:'unary',operator:'not',operand:value('1')},'booleanOperand'],
    [{type:'logical',operator:'and',operands:[yes,value('1')]},'booleanOperand'],
    [binary('lt',value('1'),value('2','string')),'comparisonOperands'],
    [call('math.floor',yes),'functionArgumentType'],
    [call('math.max',root,value('2'),yes),'functionArgumentType'],
    [binary('add',reference('state'),value('1')),'numericOperand'],
  ])assert.equal(validateExpressionTypes(node,context)?.key,key)
  const issue=validateExpressionTypes(call('math.max',root,yes),context)
  assert.equal(issue.index,2);assert.equal(issue.name,'最大值')
  assert.match(expressionValidationMessage(issue,t),/最大值/)
})

test('宿主结果约束保留已知分支；空值和未知动态引用有明确边界',()=>{
  for(const node of [yes,conditional(root,yes),conditional(reference('dynamic'),yes),call('data.coalesce',nil,yes),call('data.nullif',yes,yes)])assert.equal(validateExpressionTypes(node,context)?.key,'resultTypeMismatch')
  for(const node of [nil,conditional(root,nil),reference('dynamic'),call('data.coalesce',nil,call('data.nullif',root,value('0')),value('1'))])assert.equal(validateExpressionTypes(node,context),undefined)
  assert.equal(validateExpressionTypes(yes,context,false),undefined)
  assert.equal(validateExpressionTypes(yes,{...context,resultTypes:undefined}),undefined)
  assert.equal(validateExpressionTypes(conditional(root,binary('divide',value('1'),value('0'))),context),undefined,'类型检查不求值未选分支')
})

test('初始错误树立即反馈且不提交；完成与目录更新共用整式检查，保留无效草稿',async()=>{
  let field,editor
  const oldDocument=globalThis.document;globalThis.document={}
  class Field {
    constructor(){field=this;this.selection={ranges:[[0,0]]}}
    get lastOffset(){return 0} getValue(){return this.value} getElementInfo(){return {latex:'',depth:0}}
    setAttribute(){} addEventListener(){} removeEventListener(){} remove(){} focus(){} executeCommand(){}
  }
  const loadEditor=createMetricLoader({'vue-i18n':{useI18n:()=>({t})},'@vueuse/core':{onClickOutside(){}},'mathlive':{MathfieldElement:Field},'mathlive/fonts.css':{},'./math-semantic.css?inline':{__esModule:true,default:''}})
  const {useMathEditor}=loadEditor('components/Expression/useMathEditor.ts')
  const changes=[],props=reactive({modelValue:{version:1,root:yes},context,conditions:true})
  const {renderer,root:host}=createMetricRenderer()
  const app=renderer.createApp({setup(){editor=useMathEditor(props,(...args)=>changes.push(args));editor.host.value={appendChild(){}};return ()=>h('div')}})
  try {
    app.mount(host);await flush()
    assert.equal(editor.invalid.value,true);assert.match(editor.feedback.value,/resultTypeMismatch/)
    assert.ok(!changes.some(([event])=>event === 'update:modelValue'))
    assert.equal(editor.finish(),false)
    field.value='1+2';assert.equal(editor.finish(),true)
    const count=changes.filter(([event])=>event === 'update:modelValue').length
    field.value='1+';assert.equal(editor.finish(),false)
    props.context={...context,references:[...context.references]};await flush()
    assert.equal(field.value,'1+','目录变化不能覆盖无效编辑稿')
    assert.equal(changes.filter(([event])=>event === 'update:modelValue').length,count)
    field.value=String.raw`\JLb+1`;assert.equal(editor.finish(),false)
    props.context={...context,references:[context.references[0],{...context.references[1],schema:{type:'double'}}]};await flush()
    assert.equal(editor.invalid.value,false,'类型目录恢复后重新校验')
  } finally {app.unmount();globalThis.document=oldDocument}
})

test('粘贴整式违反结果类型时不改变现场、选区或历史',async()=>{
  const {useMathClipboard}=load('components/Expression/useMathClipboard.ts')
  const oldDocument=globalThis.document,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator')
  class Field {
    constructor(latex=''){this.value=latex;this.selection={ranges:[[0,latex.length]]};this.history=[]}
    getValue(){return this.value}setAttribute(){}remove(){}focus(){}
    insert(latex){this.history.push(this.value);this.value=latex;return true}
  }
  const field=new Field('1+2'),saved=structuredClone(field.selection)
  globalThis.document={createElement:()=>new Field(),body:{appendChild(){}}}
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{readText:async()=>String.raw`1\ge2`}}})
  let commits=0
  try {
    const clipboard=useMathClipboard({field:()=>field,root:()=>root,context:()=>context,parser:()=>createMathParser(root,context,t),disabled:()=>false,commit:()=>commits++,t})
    await clipboard.paste()
    assert.equal(clipboard.error.value,true);assert.match(clipboard.feedback.value,/resultTypeMismatch/)
    assert.equal(field.value,'1+2');assert.deepEqual(field.selection,saved);assert.deepEqual(field.history,[]);assert.equal(commits,0)
  } finally {globalThis.document=oldDocument;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator}
})
