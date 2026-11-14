import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { effectScope, reactive } from 'vue'
const require=createRequire(import.meta.url)
const {ChangeSet,EditorState}=require('@codemirror/state')
const {history,invertedEffects,undo,redo}=require('@codemirror/commands')
import { createMetricLoader } from './helpers/metricRuntime.mjs'
const loader=createMetricLoader()
const {expressionDocument,expressionCompletions}=loader('components/Expression/document.ts')
const {parseExpressionDocument}=loader('components/Expression/parse.ts')
const {createFormulaState}=loader('components/Expression/editorState.ts')
const {createEditorUpdates}=loader('components/Expression/editorUpdates.ts')
const {documentParts,explanationFacts}=loader('components/Expression/presentation.ts')
const {expressionBranches,branchGroups}=loader('components/Expression/branches.ts')
const literal=(value,valueType='decimal')=>({type:'literal',valueType,value})
const reference=(id,path=[])=>({type:'reference',id,path})
const t=key=>key
const context={references:[{id:'state',path:[],label:'设备状态',schema:{type:'enum'}},{id:'stats',path:['online'],label:'在线时长'},{id:'backup',path:[],label:'设备状态'}],
  functions:[{id:'math.round',name:'四舍五入',description:'按位数保留',parameters:[],minimumArguments:1,maximumArguments:2}]}
function changed(root,from,to,insert,ctx=context) {
  const source=expressionDocument(root,ctx,t),changes=ChangeSet.of({from,to,insert},source.text.length)
  const text=source.text.slice(0,from)+insert+source.text.slice(to)
  const map=item=>({...item,from:changes.mapPos(item.from,1),to:changes.mapPos(item.to,-1)})
  const document={...source,text,tokens:source.tokens.map(map).filter(item=>text.slice(item.from,item.to)===item.text),spans:source.spans.map(map)}
  return parseExpressionDocument(text,document,ctx,root,t)
}
const condition={type:'binary',operator:'eq',left:reference('state'),right:literal(null,'null')}
const original={type:'conditional',condition,whenTrue:literal('0.12345678901234567890'),whenFalse:{type:'call',function:'math.round',arguments:[literal('9007199254740993','long')]}}

test('连续文档显示业务名称，完整往返保留原树身份及精确数值',()=>{
  const source=expressionDocument(original,context,t)
  assert.ok(source.tokens.some(item=>item.label==='设备状态'))
  assert.ok(source.tokens.some(item=>item.label==='四舍五入'))
  assert.ok(source.tokens.some(item=>item.label==='?'))
  assert.equal(parseExpressionDocument(source.text,source,context,original,t).node,original)
  assert.equal(source.references.get('设备状态 · 2').id,'backup')
  const at=source.text.indexOf('0.12345678901234567890')
  const result=changed(original,at,at+'0.12345678901234567890'.length,'0.23456789012345678901')
  assert.equal(result.error,undefined)
  assert.equal(result.node.whenTrue.value,'0.23456789012345678901')
  assert.equal(result.node.whenTrue.valueType,'decimal')
  assert.equal(result.node.condition,original.condition)
  assert.equal(result.node.whenFalse,original.whenFalse)
})

test('逻辑顺序、显式括号、三项短路与局部类型在编辑后保留',()=>{
  const root={type:'logical',operator:'and',operands:[condition,{type:'logical',operator:'or',operands:[literal(false,'boolean'),literal(true,'boolean')]},literal(true,'boolean')]}
  const source=expressionDocument(root,context,t),at=source.text.lastIndexOf('true')
  const result=changed(root,at,at+4,'false')
  assert.equal(result.error,undefined)
  assert.equal(result.node.operands.length,3)
  assert.equal(result.node.operands[0],condition)
  assert.equal(result.node.operands[1],root.operands[1])
  assert.equal(result.node.operands[2].value,false)
  assert.equal(result.document.tokens.filter(item=>item.label==='&&').length,2)
  const long=literal('1','long')
  assert.equal(changed(long,0,1,'2').node.valueType,'long')
  assert.equal(changed(long,0,1,'9007199254740993').node.value,'9007199254740993')
  assert.equal(changed(literal('1','int'),0,1,'1.5').node.valueType,'decimal')
  assert.equal(changed(long,0,1,'-9223372036854775808').node.valueType,'long')
})

test('目录补全仅映射稳定引用和允许函数；拒绝任意JS及未完成输入',()=>{
  const source=expressionDocument(original,context,t)
  const options=expressionCompletions(source,context.functions,t)
  assert.ok(options.some(item=>item.label==='设备状态 · 2'))
  const fn=options.find(item=>item.type==='function')
  const good=parseExpressionDocument(fn.apply.replace('()','(25, 2)'),{...source,spans:[],tokens:[]},context,original,t)
  assert.equal(good.node.function,'math.round')
  for(const text of ['window.alert(1)','设备状态 = 1','({a:1})','[1,2]','(()=>1)()','四舍五入()','1 +','["不存在"]']) {
    assert.ok(parseExpressionDocument(text,{...source,spans:[],tokens:[]},context,original,t).error,text)
  }
})

test('嵌套字段显示业务简称，来源保留在提示和复制别名中；同名字段不混淆',()=>{
  const root=reference('stats',['active'])
  const ctx={...context,references:[{id:'stats',path:['active'],label:'近1小时统计 · 运行时长',displayLabel:'运行时长',unit:'s'}]}
  const doc=expressionDocument(root,ctx,t)
  assert.equal(doc.tokens[0].label,'运行时长')
  assert.equal(doc.tokens[0].title,'近1小时统计 · 运行时长 · s')
  assert.equal(parseExpressionDocument(doc.text,doc,ctx,root,t).node,root)
  assert.equal(expressionCompletions(doc,ctx.functions,t)[0].label,'近1小时统计 · 运行时长')
  ctx.references.push({id:'other',path:['active'],label:'近1天统计 · 运行时长',displayLabel:'运行时长'})
  assert.equal(expressionDocument(root,ctx,t).tokens[0].label,'近1小时统计 · 运行时长')
})

test('空条件保留引用目录，首次输入才形成树；清空及撤销不提交占位值',()=>{
  const root=literal(null,'null')
  const {field,restore,initial}=createFormulaState(()=>root,()=>context,t,()=>true)
  let state=EditorState.create({doc:initial().document.text,extensions:[field,history(),invertedEffects.of(tr=>tr.docChanged ? [restore.of(tr.startState.field(field))] : [])]})
  const target={get state(){return state},dispatch:tr=>{state=tr.state}}
  assert.equal(state.doc.toString(),'');assert.equal(state.field(field).empty,true)
  assert.ok(expressionCompletions(state.field(field).document,context.functions,t).some(item=>item.label==='设备状态'))
  target.dispatch(state.update({changes:{from:0,insert:'["设备状态"] == 1'},userEvent:'input.complete'}))
  assert.equal(state.field(field).error,undefined);assert.equal(state.field(field).empty,false)
  assert.equal(state.field(field).node.left.id,'state')
  undo(target)
  assert.equal(state.doc.toString(),'');assert.equal(state.field(field).empty,true)
  redo(target)
  assert.equal(state.field(field).node.left.id,'state')
  target.dispatch(state.update({changes:{from:0,to:state.doc.length,insert:''}}))
  assert.equal(state.field(field).empty,true);assert.ok(state.field(field).error)
})

test('原生分组撤销和重做同时恢复完整文档、数值及精度；无效草稿可撤回',()=>{
  const root=literal('9007199254740993','long')
  const {field,restore,initial}=createFormulaState(()=>root,()=>context,t)
  let state=EditorState.create({doc:initial().document.text,extensions:[field,history(),invertedEffects.of(tr=>tr.docChanged ? [restore.of(tr.startState.field(field))] : [])]})
  const dispatch=tr=>{state=tr.state}
  const target={get state(){return state},dispatch}
  dispatch(state.update({changes:{from:15,to:16,insert:''},userEvent:'delete.backward'}))
  dispatch(state.update({changes:{from:15,insert:'4'},userEvent:'input.type'}))
  assert.equal(state.field(field).node.value,'9007199254740994')
  while(undo(target)) {
    assert.equal(state.field(field).node.value,state.doc.toString())
    assert.equal(state.field(field).node.valueType,'long')
  }
  assert.equal(state.doc.toString(),'9007199254740993')
  while(redo(target))assert.equal(state.field(field).node.value,state.doc.toString())
  assert.equal(state.doc.toString(),'9007199254740994')
  dispatch(state.update({changes:{from:0,to:state.doc.length,insert:'-'}}))
  assert.ok(state.field(field).error)
  undo(target)
  assert.equal(state.field(field).error,undefined)
  assert.equal(state.field(field).node.value,state.doc.toString())
})

test('整段复制粘贴同一公式仍保留业务引用装饰，替换后原位补全可继续使用',()=>{
  const {field,initial}=createFormulaState(()=>original,()=>context,t)
  let state=EditorState.create({doc:initial().document.text,extensions:[field]})
  const before=state.field(field)
  state=state.update({changes:{from:0,to:state.doc.length,insert:state.doc.toString()},userEvent:'input.paste'}).state
  const after=state.field(field)
  assert.equal(after.error,undefined)
  assert.deepEqual(after.node,original)
  assert.equal(after.document.tokens.filter(item=>item.kind==='reference').length,before.document.tokens.filter(item=>item.kind==='reference').length)
  assert.ok(after.document.tokens.some(item=>item.label==='?'))
  assert.ok(after.document.tokens.some(item=>item.label==='四舍五入'))
})

test('连续编辑分支只复用子树所属装饰，嵌套条件与撤销重做不累积如果',()=>{
  const root={type:'conditional',condition,whenTrue:{type:'conditional',condition:reference('state'),whenTrue:literal('9007199254740993','long'),whenFalse:literal('2','int')},whenFalse:original.whenFalse}
  const {field,restore,initial}=createFormulaState(()=>root,()=>context,t)
  let state=EditorState.create({doc:initial().document.text,extensions:[field,history(),invertedEffects.of(tr=>tr.docChanged ? [restore.of(tr.startState.field(field))] : [])]})
  const target={get state(){return state},dispatch:tr=>{state=tr.state}}
  const check=()=>{
    const model=state.field(field)
    assert.equal(model.error,undefined)
    const branches=[model.node,model.node.whenTrue]
    assert.equal(model.document.tokens.filter(item=>item.label==='?').length,2)
    for(const branch of branches) {
      assert.equal(model.document.tokens.filter(item=>item.node===branch && item.kind==='keyword').length,2)
    }
    assert.equal(model.node.whenTrue.whenTrue.valueType,'long')
  }
  const replace=(find,insert)=>{
    const token=state.field(field).document.tokens.find(find)
    assert.ok(token)
    target.dispatch(state.update({changes:{from:token.from,to:token.to,insert},userEvent:'input.complete'}))
    check()
  }
  check()
  for(let index=0;index<5;index++) {
    replace(item=>item.node===state.field(field).node.whenTrue.whenTrue,String(9007199254740994n+BigInt(index)))
    replace(item=>item.node===state.field(field).node.whenTrue.whenFalse,String(index+3))
  }
  assert.equal(state.field(field).node.condition,condition)
  replace(item=>item.kind==='reference' && item.node===state.field(field).node.condition.left,'["设备状态 · 2"]')
  assert.equal(state.field(field).node.condition.left.id,'backup')
  while(undo(target))check()
  assert.deepEqual(state.field(field).node,root)
  while(redo(target))check()
  assert.equal(state.field(field).node.condition.left.id,'backup')
})

test('连续分支使用标准三元语法且同级对齐，业务旁注仅附返回常量且不改编码',()=>{
  const root={type:'conditional',condition,whenTrue:literal('5','int'),whenFalse:{type:'conditional',condition:{type:'binary',operator:'eq',left:reference('state'),right:literal('1','int')},whenTrue:literal('1','int'),whenFalse:literal('0','int')}}
  const ctx={...context,resultLabels:[{value:5,label:'未知'},{value:1,label:'离线'},{value:0,label:'正常'}]}
  const source=expressionDocument(root,ctx,t)
  assert.equal(source.text.split('\n').length,3)
  assert.ok(source.text.split('\n').slice(1).every(line=>line.startsWith(': ')))
  assert.equal(source.tokens.filter(item=>item.label==='if ').length,0)
  assert.equal(source.tokens.filter(item=>item.label==='?').length,2)
  assert.equal(source.tokens.filter(item=>item.label===':').length,2)
  assert.ok(source.tokens.every(item=>item.label===item.text || ['reference','function'].includes(item.kind)))
  assert.deepEqual(source.tokens.filter(item=>item.meaning).map(item=>[item.text,item.meaning]),[['5','未知'],['1','离线'],['0','正常']])
  assert.equal(source.tokens.find(item=>item.node===root.whenFalse.condition.right).meaning,undefined)
  const parsed=parseExpressionDocument(source.text,{...source,tokens:[],spans:[]},ctx,root,t)
  assert.deepEqual(parsed.node,root)
  assert.deepEqual(parsed.document.tokens.filter(item=>item.meaning).map(item=>item.meaning),['未知','离线','正常'])
  const rows=expressionBranches(root,ctx,t,new Map())
  assert.deepEqual(rows.map(item=>item.depth),[0,0,0])
  assert.ok(rows.every(item=>item.outcome===undefined && !item.selected))
  assert.equal(rows[1].result.find(item=>item.token?.meaning).token.meaning,'离线')
  assert.equal(rows[1].condition.some(item=>item.token?.meaning),false)
})

test('复用共享边界的子表达式不能复制父级零宽装饰',()=>{
  const source=expressionDocument(original,context,t)
  source.tokens.unshift({from:0,to:0,text:'',label:'parent',kind:'keyword',node:original,path:[]})
  const from=source.text.indexOf('0.12345678901234567890'),to=from+22,insert='0.23456789012345678901'
  const changes=ChangeSet.of({from,to,insert},source.text.length),text=changes.apply(EditorState.create({doc:source.text}).doc).toString()
  const map=item=>({...item,from:changes.mapPos(item.from,1),to:changes.mapPos(item.to,-1)})
  const result=parseExpressionDocument(text,{...source,text,tokens:source.tokens.map(map),spans:source.spans.filter(item=>!changes.touchesRange(item.from,item.to)).map(map)},context,original,t)
  assert.equal(result.error,undefined)
  assert.equal(result.node.condition,original.condition)
  assert.equal(result.document.tokens.some(item=>item.node===original),false)
})

test('编辑器目录、重建及权限更新合并到当前写入结束后，销毁后不再写入',async()=>{
  const seen=[]
  const updates=createEditorUpdates(kind=>{seen.push(kind);if(kind==='reset')updates.schedule('catalog')})
  updates.schedule('catalog');updates.schedule('configure');updates.schedule('reset')
  assert.deepEqual(seen,[],'Vue widget callbacks must not reenter the current CodeMirror update')
  await Promise.resolve();assert.deepEqual(seen,['reset'])
  await Promise.resolve();assert.deepEqual(seen,['reset','catalog'])
  updates.schedule('catalog');updates.schedule('configure');updates.schedule('catalog')
  await Promise.resolve();assert.deepEqual(seen,['reset','catalog','catalog','configure'])
  updates.schedule('reset');updates.dispose()
  await Promise.resolve();assert.equal(seen.length,4)
  updates.schedule('catalog');await Promise.resolve();assert.equal(seen.length,4)
})

test('历史事实只按同一引用和运算匹配，未执行分支弱化，不推断当前值',()=>{
  const root={type:'conditional',condition,whenTrue:reference('stats',['online']),whenFalse:reference('state')}
  const read=(path,value)=>({kind:'read',state:'available',path,value,children:[]})
  const record={kind:'condition',state:'available',path:[],children:[
    {kind:'operator',operation:'==',state:'available',children:[read(['state'],0),{kind:'literal',state:'available',children:[],value:null}]},
    {kind:'unsupported',state:'skipped',path:[],children:[]},
    read(['state'],0),
  ]}
  const format=node=>({text:String(node.value)})
  const facts=explanationFacts(root,record,format)
  const parts=documentParts(expressionDocument(root,context,t),facts)
  assert.ok(parts.some(item=>item.token?.label==='在线时长' && item.fact?.state==='skipped'))
  assert.ok(parts.some(item=>item.token?.label==='设备状态' && item.fact?.text==='0'))
  assert.equal(explanationFacts(reference('state'),read(['another'],1),format).size,0)
  const mismatch={kind:'operator',operation:'!=',state:'available',children:record.children[0].children}
  assert.equal(explanationFacts(condition,mismatch,format).size,0)
})

test('展开对照按稳定引用合并重复读取，区分参数与未参与项，不为无记录项补值',()=>{
  const {useExpressionWorkspace}=loader('components/Expression/useExpressionWorkspace.ts')
  const read=(path,value)=>({kind:'read',state:'available',path,value,children:[]})
  const root={type:'conditional',condition:{type:'binary',operator:'gt',left:reference('state'),right:literal('0')},whenTrue:{type:'binary',operator:'multiply',left:reference('state'),right:reference('params',['weight'])},whenFalse:reference('stats',['online'])}
  const props=reactive({node:root,context:{...context,references:[...context.references,{id:'params',path:['weight'],label:'权重',schema:{type:'decimal'}}]},explanation:{kind:'condition',state:'available',value:5,children:[
    {kind:'operator',operation:'>',state:'available',value:true,children:[read(['state'],1),{kind:'literal',state:'available',value:0,children:[]}]},
    {kind:'operator',operation:'*',state:'available',value:5,children:[read(['state'],1),read(['params','weight'],'5.0000000000000001')]},
    {kind:'unsupported',state:'skipped',children:[]},
  ]},format:node=>({text:String(node.value)})})
  const scope=effectScope(),workspace=scope.run(()=>useExpressionWorkspace(props,t))
  try {
    assert.equal(workspace.rows.value.length,3)
    const [state,weight,skipped]=workspace.rows.value
    assert.deepEqual(state.values,['1']);assert.equal(state.skipped,false)
    assert.equal(weight.parameter,true);assert.deepEqual(weight.values,['5.0000000000000001'])
    assert.equal(skipped.skipped,true);assert.deepEqual(skipped.values,[])
    const parts=documentParts(expressionDocument(root,props.context,t),explanationFacts(root,props.explanation,props.format))
    assert.equal(parts.find(part=>part.token?.branch==='whenTrue').fact.selected,true)
    assert.equal(parts.find(part=>part.token?.branch==='whenFalse').fact.state,'skipped')
    props.explanation=undefined
    assert.ok(workspace.rows.value.every(row=>!row.recorded && row.values.length===0))
  } finally {scope.stop()}
})

test('条件图标保留真假与短路区别，连续未参与分支可折叠，默认分支只凭明确判断命中',()=>{
  const skipped={kind:'unsupported',state:'skipped',value:null,children:[]}
  const lit=value=>({kind:'literal',state:'available',value,children:[]})
  const decision=(condition,yes,no)=>({kind:'condition',state:'available',children:[condition,yes,no]})
  const check=(outcome)=>({kind:'operator',operation:'==',state:'available',value:outcome,children:[{kind:'read',state:'available',path:['state'],value:1,children:[]},lit(null)]})
  const tail={type:'conditional',condition,whenTrue:literal('20'),whenFalse:literal('30')}
  const root={type:'conditional',condition,whenTrue:literal('10'),whenFalse:tail}
  const format=node=>({text:String(node.value)})
  const project=record=>expressionBranches(root,context,t,explanationFacts(root,record,format))
  let rows=project(decision(check(false),skipped,decision(check(true),lit(20),skipped)))
  assert.deepEqual(rows.map(row=>row.outcome),['false','true','skipped'])
  assert.deepEqual(rows.map(row=>row.selected),[false,true,false])
  assert.equal(rows[1].depth,0,'else-if stays at the original reading level')
  assert.ok(rows[0].condition.some(part=>part.fact?.text==='1'))
  rows=project(decision(check(true),lit(10),skipped))
  const groups=branchGroups(rows)
  assert.equal(groups.length,2);assert.equal(groups[1].rows.length,2);assert.equal(groups[1].skipped,true)
  rows=project(decision(check(false),skipped,decision(check(false),skipped,lit(30))))
  assert.equal(rows.at(-1).selected,true)
  const unknown={...check(false),state:'unknown'}
  rows=project(decision(unknown,skipped,skipped))
  assert.equal(rows[0].outcome,'unknown');assert.ok(rows.every(row=>!row.selected))
  const mismatch=decision({...check(true),operation:'!='},lit(10),skipped)
  assert.equal(explanationFacts(root,mismatch,format).size,0,'mismatched operators cannot mark branches')
})

test('复合条件按记录展示每项判断；跳过项不显示为否或补入当前取值',()=>{
  const node={type:'logical',operator:'and',operands:[condition,{type:'binary',operator:'gt',left:reference('stats',['online']),right:literal('0')}]}
  const record={kind:'operator',operation:'&&',state:'available',value:false,children:[
    {kind:'operator',operation:'==',state:'available',value:false,children:[{kind:'read',state:'available',path:['state'],value:1,children:[]},{kind:'literal',state:'available',value:null,children:[]}]},
    {kind:'unsupported',state:'skipped',value:null,children:[]},
  ]}
  const facts=explanationFacts(node,record,item=>({text:String(item.value)}))
  assert.equal(facts.get('["operands",0]').outcome,'false')
  assert.equal(facts.get('["operands",1]').outcome,'skipped')
  assert.equal(facts.get('[]').outcome,'false')
  const parts=documentParts(expressionDocument(node,context,t),facts)
  assert.equal(parts.find(part=>part.token?.label==='在线时长').fact.state,'skipped')
  assert.ok(!parts.some(part=>part.token?.label==='在线时长' && part.fact.text))
  const marked=documentParts(expressionDocument(node,context,t),facts,true)
  const first=marked.findIndex(part=>part.outcome==='false')
  assert.equal(marked[first-1].token.node.value,null,'judgment comes after the complete condition, not beside its operator')
  assert.ok(marked.some(part=>part.outcome==='skipped'))
  assert.equal(marked.filter(part=>!part.outcome).map(part=>part.text).join(''),parts.map(part=>part.text).join(''),'markers do not change formula order or grouping')
})
