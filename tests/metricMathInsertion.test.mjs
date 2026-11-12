import assert from 'node:assert/strict'
import test from 'node:test'
import { createMetricLoader } from './helpers/metricRuntime.mjs'

const load=createMetricLoader()
const {useMathInsertion}=load('components/Expression/useMathInsertion.ts')
const {unsupportedMathKey}=load('components/Expression/mathInput.ts')
test('可视输入限制未声明运算，保留比较、快捷键字符与文本常量',()=>{
  for(const key of ['》','《','≫','^','_','\\'])assert.equal(unsupportedMathKey(key,''),true,key)
  assert.equal(unsupportedMathKey('>','>'),true)
  for(const key of ['>','<','=','!','+','-','*','/','a','1'])assert.equal(unsupportedMathKey(key,''),false,key)
  assert.equal(unsupportedMathKey('》','',true),false)
})
const {parseMathExpression,createMathParser}=load('components/Expression/math.ts')
const literal=value=>({type:'literal',valueType:'int',value:String(value)})
const reading={type:'reference',id:'reading',path:[]}
const context={references:[{...reading,label:'测量值',schema:{type:'double'}},{id:'dynamic',path:[],label:'动态值'},{id:'object',path:[],label:'统计对象',schema:{type:'object'}}],functions:[{id:'math.max',name:'最大值',returnType:'number',parameters:[{id:'value',valueType:'number'}],minimumArguments:1,maximumArguments:16}]}
const value=(latex,valueType)=>({kind:'value',latex,valueType})
const plus={kind:'arithmetic',latex:'+'},and={kind:'logical',latex:'\\JLand '}
/** 替身只实现公开原子偏移与原生insert契约；嵌套排版和撤销在真实MathLive浏览器走查。 */
class Field {
  constructor(tokens,depths) {this.tokens=['',...tokens];this.depths=depths;this.selection={ranges:[[tokens.length,tokens.length]]};this.inserts=[]}
  get lastOffset(){return this.tokens.length-1}
  getValue(start,end){return typeof start === 'number' ? this.tokens.slice(start+1,end+1).join('') : this.tokens.slice(1).join('')}
  getElementInfo(offset){return {latex:this.tokens[offset],depth:this.depths?.[offset] ?? 0}}
  focus(){}
  executeCommand(){return true}
  insert(latex,options) {
    const [start,end]=this.selection.ranges[0],selected=this.getValue(start,end)
    this.inserts.push({latex,options,range:[start,end]})
    const next=latex.replaceAll('#0',selected).replaceAll('#?','\\placeholder{}')
    this.tokens.splice(start+1,end-start,next)
    this.selection={ranges:[[start,start+1]]}
  }
}
function setup(field,root=reading,editorContext=context) {
  const changes=[];let disabled=false
  const parser=createMathParser(root,editorContext,key=>key)
  const insertion=useMathInsertion({field:()=>field,context:()=>editorContext,root:()=>root,parser:()=>parser,commit:()=>changes.push(field.getValue()),disabled:()=>disabled})
  insertion.refresh()
  return {field,changes,insertion,disable(){disabled=true}}
}
test('同一选区刷新复用解析，文档/目录变化后重新检查；失败草稿也不重复解析',()=>{
  const field=new Field(['\\JLa','+','2'])
  let root={type:'binary',operator:'add',left:reading,right:literal(2)},ctx=context
  const calls=[]
  let parser=latex=>{calls.push(latex);return parseMathExpression(latex,root,ctx,key=>key)}
  const insertion=useMathInsertion({field:()=>field,context:()=>ctx,root:()=>root,parser:()=>parser,commit(){},disabled:()=>false})
  insertion.refresh()
  const count=calls.length
  assert.ok(count>0)
  assert.equal(new Set(calls).size,count,'一次刷新内也复用相同片段')
  insertion.refresh();insertion.refresh()
  assert.equal(calls.length,count)
  field.tokens=['','+','+'];field.selection={ranges:[[0,2]]}
  insertion.refresh();const invalidCount=calls.length
  insertion.refresh();assert.equal(calls.length,invalidCount)
  assert.equal(insertion.canInsertValue.value,false)
  ctx={...context};insertion.refresh()
  assert.ok(calls.length>invalidCount)
  const previousCount=calls.length
  parser=latex=>{calls.push(latex);return parseMathExpression(latex,root,ctx,key=>key)}
  insertion.refresh();assert.ok(calls.length>previousCount,'解析目录单独变化时也失效')
  field.tokens=['','\\JLa'];field.selection={ranges:[[0,1]]};root=reading
  insertion.refresh();assert.equal(insertion.canInsertValue.value,true)
  ctx={...context,references:[{...reading,label:'测量值',schema:{type:'string'}}]}
  insertion.refresh()
  assert.equal(insertion.applicable(plus),false,'目录更新不能复用旧的数值类型')
})
test('枚举比较的空位只提供声明值，动作执行前复核合法值并保持标量类型',()=>{
  const stateContext={...context,references:[{...reading,label:'状态',schema:{type:'enum',valueType:{type:'int'},elements:[{value:0,text:'离线'},{value:1,text:'在线'}]}}]}
  const state=setup(new Field(['\\JLa','=','\\placeholder{}']),reading,stateContext)
  state.field.selection={ranges:[[2,3]]};state.insertion.refresh()
  assert.deepEqual(state.insertion.valueChoices.value.map(choice=>choice.label),['离线','在线'])
  assert.equal(state.insertion.insert(value('3','int')),false)
  assert.equal(state.insertion.insert(value('\\JLenumb','int')),true)
  assert.equal(state.field.getValue(),'\\JLa=\\JLenumb')
})
test('值候选替换光标旁的完整长整数，连续空值不追加，不经JS数字转换',()=>{
  const original='9007199254740993',state=setup(new Field([...original]),{...literal(original),valueType:'long'})
  assert.equal(state.insertion.insert(value('\\JLemptyResult','null')),true)
  assert.deepEqual(state.field.inserts[0].range,[0,original.length])
  assert.equal(state.field.getValue(),'\\JLemptyResult')
  state.field.selection={ranges:[[0,1]]}
  assert.equal(state.insertion.insert(value('\\JLemptyResult','null')),true)
  assert.equal(state.field.getValue(),'\\JLemptyResult')
  assert.deepEqual(state.field.inserts[0].options,{selectionMode:'placeholder',silenceNotifications:true})
})
test('数字中间也替换整个数；只替换已选片段，不扩选其他操作数',()=>{
  const field=new Field(['\\JLa','+','1','2','3']),state=setup(field,{type:'binary',operator:'add',left:reading,right:literal(123)})
  field.selection={ranges:[[3,3]]};state.insertion.insert(value('7','number'))
  assert.equal(field.getValue(),'\\JLa+7');assert.deepEqual(field.inserts[0].range,[2,5])
  const other=setup(new Field(['1','2','3']),literal(123))
  other.field.selection={ranges:[[1,2]]};other.insertion.insert(value('8','number'))
  assert.equal(other.field.getValue(),'183')
  const negative=setup(new Field(['-','2','0']),literal(-20))
  negative.insertion.insert(value('7','number'));assert.equal(negative.field.getValue(),'7')
  const subtraction=setup(new Field(['\\JLa','-','2','0']),{type:'binary',operator:'subtract',left:reading,right:literal(20)})
  subtraction.insertion.insert(value('7','number'));assert.equal(subtraction.field.getValue(),'\\JLa-7')
})
test('操作数位置禁用运算符并筛选类型；未知类型仍可用，动作复核失效选区',()=>{
  const state=setup(new Field(['\\JLa','+','\\placeholder{}']))
  state.field.selection={ranges:[[2,3]]};state.insertion.refresh()
  assert.equal(state.insertion.applicable(plus),false)
  assert.equal(state.insertion.applicable(value('2','number')),true)
  assert.equal(state.insertion.applicable(value('\\JLtrue','boolean')),false)
  assert.equal(state.insertion.applicable(value('\\JLb','unknown')),true)
  assert.equal(state.insertion.applicable(value('\\JLc','object')),false)
  state.field.tokens=['','+','+'];state.field.selection={ranges:[[0,2]]}
  assert.equal(state.insertion.insert(value('2','number')),false)
  assert.equal(state.changes.length,0)
})
test('数字加法一次插入带右侧占位，不连续追加运算符',()=>{
  const state=setup(new Field(['2']),literal(2))
  assert.equal(state.insertion.insert(plus),true)
  assert.equal(state.field.getValue(),'2+\\placeholder{}')
  assert.equal(state.field.inserts[0].latex,'#0+#?')
  assert.equal(state.insertion.insert(plus),false)
  assert.equal(state.field.inserts.length,1)
})
test('中间插入运算符复用右侧内容，仅在缺少左值时补空位；显式选择仍包裹选区',()=>{
  const state=setup(new Field(['\\JLa','3','2']))
  state.field.selection={ranges:[[1,1]]}
  assert.equal(state.insertion.insert({kind:'comparison',latex:'>'}),true)
  assert.equal(state.field.getValue(),'\\JLa>32')
  assert.deepEqual(state.field.inserts[0],{latex:'>',options:{selectionMode:'after',silenceNotifications:true},range:[1,1]})
  const number=setup(new Field(['3','2']),literal(32))
  number.field.selection={ranges:[[1,1]]};number.insertion.insert(plus)
  assert.equal(number.field.getValue(),'3+2')
  const divide=setup(new Field(['\\JLa','3','2']))
  divide.field.selection={ranges:[[1,1]]};divide.insertion.insert({kind:'arithmetic',latex:'\\dfrac{#@}{#?}'})
  assert.equal(divide.field.getValue(),'\\JLa\\div 32')
  assert.equal(parseMathExpression(divide.field.getValue(),reading,context,key=>key).operator,'divide')
  const start=setup(new Field(['3','2']),literal(32))
  start.field.selection={ranges:[[0,0]]};start.insertion.insert(plus)
  assert.equal(start.field.getValue(),'\\placeholder{}+32')
  const selected=setup(new Field(['3','2']),literal(32))
  selected.field.selection={ranges:[[0,2]]};selected.insertion.insert(plus)
  assert.equal(selected.field.getValue(),'32+\\placeholder{}')
})
test('原有运算符就地切换，不叠加空位或影响相邻内容',()=>{
  const root={type:'binary',operator:'add',left:reading,right:literal(32)}
  for(const cursor of [1,2]) {
    const state=setup(new Field(['\\JLa','+','3','2']),root)
    state.field.selection={ranges:[[cursor,cursor]]};state.insertion.insert({kind:'arithmetic',latex:'\\times '})
    assert.equal(state.field.getValue(),'\\JLa\\times 32')
  }
  const blank=setup(new Field(['\\JLa','\\placeholder{}']))
  blank.field.selection={ranges:[[1,1]]};blank.insertion.insert(plus)
  assert.equal(blank.field.getValue(),'\\JLa+\\placeholder{}')
})
test('逻辑连接覆盖完整比较式；数值参数不能改成布尔值或比较式',()=>{
  const condition={type:'binary',operator:'gt',left:reading,right:literal(20)}
  const state=setup(new Field(['\\JLa','>','2','0']),condition)
  assert.equal(state.insertion.applicable(and),true)
  state.insertion.insert(and)
  assert.deepEqual(state.field.inserts[0].range,[0,4])
  const fn=setup(new Field(['2']),{type:'call',function:'math.max',arguments:[literal(2)]})
  assert.equal(fn.insertion.applicable(value('3','number')),true)
  assert.equal(fn.insertion.applicable(value('\\JLtrue','boolean')),false)
  assert.equal(fn.insertion.applicable({kind:'comparison',latex:'>'}),false)
})
test('条件槽仅提供布尔或未知类型；数值、布尔和对象各自匹配可用操作',()=>{
  const bool={type:'literal',valueType:'boolean',value:true}
  const state=setup(new Field(['\\JLtrue']),{type:'conditional',condition:bool,whenTrue:literal(1),whenFalse:literal(0)})
  assert.equal(state.insertion.applicable(value('2','number')),false)
  assert.equal(state.insertion.applicable(value('\\JLfalse','boolean')),true)
  assert.equal(state.insertion.applicable(plus),false)
  const object=setup(new Field(['\\JLc']),context.references[2])
  assert.equal(object.insertion.applicable(plus),false)
  assert.equal(object.insertion.applicable({kind:'predicate',latex:'\\JLmissing'}),true)
  const empty=setup(new Field(['\\JLemptyResult']),{type:'literal',valueType:'null',value:null})
  assert.equal(empty.insertion.applicable(plus),false)
  assert.equal(empty.insertion.applicable(and),false)
})
test('新函数的后续占位参数仍读取函数目录类型；新分段的条件与结果分开给候选',()=>{
  const field=new Field(['\\operatorname{最大值}','','\\placeholder{}',',','\\placeholder{}','\\left(\\placeholder{},\\placeholder{}\\right)'],[0,0,1,1,1,1,0])
  field.selection={ranges:[[4,5]]}
  const fn=setup(field)
  assert.equal(fn.insertion.applicable(value('2','number')),true)
  assert.equal(fn.insertion.applicable(value('\\JLtrue','boolean')),false)
  const cases=new Field(['','\\placeholder{}','','\\placeholder{}','','\\placeholder{}','','\\JLotherwise','\\begin{cases}\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\JLotherwise\\end{cases}'],[0,1,1,1,1,1,1,1,1,0])
  cases.selection={ranges:[[3,4]]};const branch=setup(cases)
  assert.equal(branch.insertion.applicable(value('2','number')),true,'空条件可从数值操作数开始，再补充比较')
  assert.equal(branch.insertion.applicable(value('\\JLa','double')),true,'数值变量可用来构造条件')
  assert.equal(branch.insertion.applicable(value('\\JLc','object')),false)
  assert.equal(branch.insertion.applicable(value('\\JLtrue','boolean')),true)
  cases.selection={ranges:[[1,2]]};branch.insertion.refresh()
  assert.equal(branch.insertion.applicable(value('2','number')),true)
})
test('对选中的复合公式应用运算符时加括号，保留原运算优先级',()=>{
  const state=setup(new Field(['2','+','3']),{type:'binary',operator:'add',left:literal(2),right:literal(3)})
  state.field.selection={ranges:[[0,3]]}
  assert.equal(state.insertion.insert({kind:'arithmetic',latex:'\\times'}),true)
  assert.equal(state.field.inserts[0].latex,'\\left(#0\\right)\\times#?')
})
test('空条件允许插入比较式骨架；比较两侧的候选恢复为操作数而非布尔结果',()=>{
  const field=new Field(['','\\placeholder{}','','\\placeholder{}','','0','','\\JLotherwise','\\begin{cases}\\placeholder{}&\\placeholder{}\\\\0&\\JLotherwise\\end{cases}'],[0,1,1,1,1,1,1,1,1,0])
  field.selection={ranges:[[3,4]]}
  const state=setup(field)
  assert.equal(state.insertion.applicable({kind:'comparison',latex:'>'}),true)
  assert.equal(state.insertion.applicable(plus),false)
  assert.equal(state.insertion.insert({kind:'comparison',latex:'>'}),true)
  assert.equal(field.inserts[0].latex,'#?>#?')
  const operands=setup(new Field(['\\placeholder{}','>','\\placeholder{}']))
  operands.field.selection={ranges:[[0,1]]};operands.insertion.refresh()
  assert.equal(operands.insertion.applicable(value('2','number')),true)
  assert.equal(operands.insertion.applicable(value('\\JLtrue','boolean')),false)
})
test('新条件中的变量即使也用于结果运算，仍按原生条件槽允许比较与替换',()=>{
  const field=new Field(['','1','','\\JLa','','0','','\\JLotherwise','\\begin{cases}1&\\JLa\\\\0&\\JLotherwise\\end{cases}'],[0,1,1,1,1,1,1,1,1,0])
  field.selection={ranges:[[3,4]]}
  const state=setup(field,{type:'binary',operator:'add',left:reading,right:literal(1)})
  assert.equal(state.insertion.applicable({kind:'comparison',latex:'>'}),true)
  assert.equal(state.insertion.applicable(value('\\JLa','double')),true)
})
test('跨分支选区即使能被序列化成数字也拒绝；完整子表达式保留替换',()=>{
  const field=new Field(['','2','','3'],[0,1,1,1,1]),state=setup(field,literal(23))
  field.selection={ranges:[[1,4]]};state.insertion.refresh()
  assert.equal(field.getValue(1,4),'23')
  assert.equal(state.insertion.applicable(value('5','number')),false)
  assert.equal(state.insertion.insert(value('5','number')),false)
  field.selection={ranges:[[3,4]]};assert.equal(state.insertion.insert(value('5','number')),true)
})
test('菜单恢复原选区；只读、多选区和非法键盘草稿都不产生插入',()=>{
  const state=setup(new Field(['2','+','3']),{type:'binary',operator:'add',left:literal(2),right:literal(3)})
  const saved={ranges:[[0,1]]};state.field.selection={ranges:[[99,99]]}
  assert.equal(state.insertion.insert(value('8','number'),saved),true)
  assert.equal(state.field.getValue(),'8+3')
  state.disable();assert.equal(state.insertion.insert(plus),false)
  const multi=setup(new Field(['2']),literal(2));multi.field.selection={ranges:[[0,1],[0,1]]}
  assert.equal(multi.insertion.insert(value('3','number')),false)
  const draft=setup(new Field(['+','+']),literal(2));draft.field.selection={ranges:[[0,2]]}
  assert.equal(draft.insertion.insert(value('3','number')),false)
  assert.equal(draft.field.getValue(),'++')
})
test('添加分支保留默认行并以单次原生insert提交；重新读取后不使用过期容器',()=>{
  const field=new Field(['','1','','\\JLtrue','','0','','\\JLotherwise','\\begin{cases}1&\\JLtrue\\\\0&\\JLotherwise\\end{cases}'],[0,1,1,1,1,1,1,1,1,0])
  const commands=[];field.executeCommand=name=>{commands.push({name,position:field.position});return true}
  const state=setup(field)
  assert.equal(state.insertion.canAddBranch.value,true)
  assert.equal(state.insertion.addBranch(),true)
  assert.equal(commands[0].name,'moveToGroupStart')
  assert.equal(field.inserts[0].latex,'\\begin{cases}1&\\JLtrue\\\\\\placeholder{}&\\placeholder{}\\\\0&\\JLotherwise\\end{cases}')
  field.tokens=['','2'];field.selection={ranges:[[1,1]]}
  assert.equal(state.insertion.addBranch(),false)
  state.disable();assert.equal(state.insertion.addBranch(),false)
  assert.equal(commands.length,1)
})
const branchField=()=>new Field(['','\\placeholder{}','','\\placeholder{}','','0','','\\JLotherwise','\\begin{cases}\\placeholder{}&\\placeholder{}\\\\0&\\JLotherwise\\end{cases}'],[0,1,1,1,1,1,1,1,1,0])
const key=key=>({key,prevented:false,preventDefault(){this.prevented=true},stopImmediatePropagation(){}})
test('单行回车保留整条算式为首个结果并创建条件草稿；非法草稿、只读和组合键不转换',()=>{
  const root={type:'binary',operator:'add',left:reading,right:literal(2)}
  const state=setup(new Field(['\\JLa','+','2']),root)
  state.field.selection={ranges:[[1,1]]};const event=key('Enter');state.insertion.onKeydown(event)
  assert.equal(event.prevented,true)
  assert.deepEqual(state.field.inserts[0].range,[0,3])
  assert.equal(state.field.inserts[0].latex,'\\begin{cases}\\JLa+2&\\placeholder{}\\\\\\placeholder{}&\\JLotherwise\\end{cases}')
  assert.equal(state.changes.length,1)
  const draft=setup(new Field(['+','+'])),invalid=key('Enter');draft.insertion.onKeydown(invalid)
  assert.equal(invalid.prevented,false);assert.equal(draft.changes.length,0)
  const readonly=setup(new Field(['2']),literal(2));readonly.disable()
  const protectedKey=key('Enter');readonly.insertion.onKeydown(protectedKey);assert.equal(protectedKey.prevented,false)
  for(const option of ['isComposing','ctrlKey','metaKey','altKey','shiftKey']) {
    const other=setup(new Field(['2']),literal(2)),event={...key('Enter'),[option]:true}
    other.insertion.onKeydown(event);assert.equal(event.prevented,false);assert.equal(other.changes.length,0)
  }
})
test('回车续写分支，默认行前插入；组合键和输入法不被拦截',()=>{
  const field=branchField(),commands=[],state=setup(field)
  field.executeCommand=name=>{commands.push({name,position:field.position});return true}
  field.selection={ranges:[[1,2]]};state.insertion.onKeydown(key('Enter'))
  assert.equal(commands[0].name,'moveToGroupStart')
  assert.equal(field.inserts[0].latex,'\\begin{cases}\\placeholder{}&\\placeholder{}\\\\\\placeholder{}&\\placeholder{}\\\\0&\\JLotherwise\\end{cases}')
  const fallbackField=branchField(),fallbackState=setup(fallbackField)
  fallbackField.selection={ranges:[[5,6]]};fallbackState.insertion.onKeydown(key('Enter'))
  assert.equal(fallbackField.inserts[0].latex,field.inserts[0].latex)
  for(const option of ['isComposing','ctrlKey','metaKey','altKey','shiftKey']) {
    const event={...key('Enter'),[option]:true};state.insertion.onKeydown(event);assert.equal(event.prevented,false)
  }
  state.disable();state.insertion.onKeydown(key('Enter'));assert.equal(commands.length,1)
})
test('空分支退格收敛为默认结果；有内容或默认行不能被整行删除',()=>{
  const field=branchField(),state=setup(field)
  field.selection={ranges:[[1,2]]};const event=key('Backspace');state.insertion.onKeydown(event)
  assert.equal(event.prevented,true);assert.deepEqual(field.inserts[0].range,[0,9]);assert.equal(field.inserts[0].latex,'0')
  const protectedField=branchField(),other=setup(protectedField)
  protectedField.selection={ranges:[[5,6]]};const fallback=key('Backspace');other.insertion.onKeydown(fallback);assert.equal(fallback.prevented,false)
  protectedField.tokens[2]='7';protectedField.selection={ranges:[[1,2]]};const filled=key('Backspace');other.insertion.onKeydown(filled);assert.equal(filled.prevented,false)
  assert.equal(other.changes.length,0)
})
test('点击短分支右侧留白定位该行；真实文字和只读不重定向',()=>{
  const field=branchField(),original=field.getElementInfo.bind(field)
  const boxes={2:{left:10,right:80,top:10,bottom:25},4:{left:110,right:150,top:10,bottom:25},6:{left:10,right:20,top:35,bottom:50},8:{left:110,right:180,top:35,bottom:50},9:{left:0,right:200,top:5,bottom:55}}
  field.getElementInfo=offset=>({...original(offset),bounds:boxes[offset]})
  const state=setup(field)
  assert.equal(state.insertion.placeInBlank(70,42),true);assert.equal(field.position,6)
  assert.equal(state.insertion.placeInBlank(15,42),false)
  assert.equal(state.insertion.placeInBlank(70,100),false)
  state.disable();assert.equal(state.insertion.placeInBlank(70,42),false)
  assert.equal(state.changes.length,0)
})
test('点击函数名定位完整调用，保留参数及外围公式；只读不提供替换目标',()=>{
  const field=new Field(['\\operatorname{最大值}','','2',',','3','\\left(2,3\\right)','+','5'],[0,0,1,1,1,1,0,0,0])
  const original=field.getElementInfo.bind(field)
  field.getElementInfo=offset=>({...original(offset),bounds:offset===1 ? {left:10,right:50,top:10,bottom:30} : undefined})
  const state=setup(field,{type:'binary',operator:'add',left:{type:'call',function:'math.max',arguments:[literal(2),literal(3)]},right:literal(5)})
  const target=state.insertion.functionAtPoint(20,20)
  assert.equal(target.id,'math.max');assert.equal(target.count,2);assert.deepEqual(target.range,[0,6]);assert.equal(target.argumentsLatex,'\\left(2,3\\right)')
  assert.equal(state.insertion.functionAtPoint(60,20),undefined)
  state.disable();assert.equal(state.insertion.functionAtPoint(20,20),undefined)
})
