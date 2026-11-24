import test from 'node:test'
import assert from 'node:assert/strict'
import { createComponentLoader } from './helpers/componentRuntime.mjs'
import { effectScope, nextTick } from 'vue'
const loader=createComponentLoader()
const {expressionMath,parseMathExpression,createMathParser}=loader('components/Expression/math.ts')
const {expressionDocument}=loader('components/Expression/document.ts')
const {parseExpressionDocument}=loader('components/Expression/parse.ts')
const {explanationFacts}=loader('components/Expression/presentation.ts')
const t=key=>key
const literal=(value,valueType='int')=>({type:'literal',valueType,value})
const read={type:'reference',id:'temperature',path:[]}
const context={references:[{...read,label:'温度'},{id:'params',path:['limit'],label:'温度阈值'}],functions:[{id:'math.max',name:'最大值',minimumArguments:1,maximumArguments:16},{id:'math.sqrt',name:'平方根',minimumArguments:1,maximumArguments:1}],resultLabels:[{value:2,label:'过热'}]}
const binary=(operator,left,right)=>({type:'binary',operator,left,right})
const condition=binary('ge',read,literal('80'))
const branch={type:'conditional',condition,whenTrue:literal('2'),whenFalse:{type:'conditional',condition:binary('ge',read,literal('60')),whenTrue:literal('1'),whenFalse:literal('0')}}

test('当前文档的解析目录可复用，失败输入不污染后续解析；不同目录互不串值',()=>{
  const root=binary('add',read,literal('9007199254740993','long'))
  const parse=createMathParser(root,context,t)
  assert.throws(()=>parse('\\JLa+'),/incomplete|unsupported/)
  assert.deepEqual(parse(expressionMath(root,context,t).latex),root)
  assert.deepEqual(parse('\\JLa'),read)
  assert.throws(()=>parse('\\htmlData{onclick=alert}{\\JLa}'),/unsupported/)
  assert.throws(()=>parse('\\htmlData{expression-inspect=0}{\\href{unsafe}{1}}'),/unsupported/)
  const other={type:'reference',id:'other',path:[]}
  const otherParser=createMathParser(other,{references:[{...other,label:'其他数据'}],functions:[]},t)
  assert.deepEqual(otherParser('\\JLa'),other)
  assert.deepEqual(parse('\\JLa'),read)
})

test('状态枚举以名称显示并无损往返，手输非法值不提交；集合包含沿用同一约束',()=>{
  const state={type:'reference',id:'state',path:[]}
  const ctx={references:[{...state,label:'连接状态',schema:{type:'enum',valueType:{type:'int'},elements:[{value:0,text:'离线'},{value:1,text:'在线'}]}}],functions:[{id:'data.contains',name:'属于集合',minimumArguments:2,maximumArguments:2},{id:'data.of',name:'集合',minimumArguments:0,maximumArguments:16}]}
  const root=binary('eq',state,literal('1'))
  const projection=expressionMath(root,ctx,t)
  assert.match(projection.latex,/\\JLenum/);assert.ok(Object.values(projection.macros).some(m=>m.def.includes('在线')))
  assert.deepEqual(parseMathExpression(projection.latex,root,ctx,t),root)
  assert.throws(()=>parseMathExpression('\\JLa = 3',root,ctx,t),/invalidEnumValue/)
  const membership={type:'call',function:'data.contains',arguments:[{type:'call',function:'data.of',arguments:[literal('0'),literal('1')]},state]}
  assert.deepEqual(parseMathExpression(expressionMath(membership,ctx,t).latex,membership,ctx,t),membership)
  const score={type:'conditional',condition:binary('eq',state,literal('0')),whenTrue:literal('0'),whenFalse:binary('multiply',literal('0'),literal('2'))}
  const scoreMath=expressionMath(score,ctx,t)
  assert.equal((scoreMath.latex.match(/\\JLenum/g)||[]).length,1)
  assert.deepEqual(parseMathExpression(scoreMath.latex,score,ctx,t),score)
  assert.equal(scoreMath.latex.includes('0\\times 2'),true)
})

test('简单数学运算保留分数、括号、引用、函数与精确数值类型',()=>{
  const roots=[binary('divide',binary('add',read,literal('9007199254740993','long')),literal('0.12345678901234567890','decimal')),
    {type:'call',function:'math.sqrt',arguments:[read]},
    {type:'logical',operator:'and',operands:[condition,binary('ne',read,literal(null,'null'))]},
    {type:'unary',operator:'not',operand:condition},literal(true,'boolean'),literal('离线','string')]
  for(const root of roots) {
    const projection=expressionMath(root,context,t)
    assert.deepEqual(parseMathExpression(projection.latex,root,context,t),root,projection.latex)
  }
  assert.match(expressionMath(roots[0],context,t).latex,/\\dfrac/)
})

test('取模与变量宏共存且可编辑，旧取模命令仍可还原',async()=>{
  const {convertLatexToMarkup}=await import('mathlive/ssr')
  const root=binary('mod',binary('add',read,literal('7')),literal('3'))
  const projection=expressionMath(root,context,t)
  assert.doesNotMatch(convertLatexToMarkup(projection.latex,{macros:projection.macros}),/ML__error|\\bmod/)
  assert.deepEqual(parseMathExpression(projection.latex,root,context,t),root)
  assert.deepEqual(parseMathExpression(projection.latex.replace('\\mod','\\bmod'),root,context,t),root)
})

test('分段数学公式保留先后顺序、默认结果、真分支嵌套及原类型',()=>{
  for(const root of [branch,{...branch,whenTrue:{...branch,whenFalse:literal('9007199254740993','long')}}]) {
    const {latex}=expressionMath(root,context,t)
    assert.match(latex,/\\begin\{cases\}/)
    assert.match(latex,/\\JLotherwise/)
    assert.deepEqual(parseMathExpression(latex,root,context,t),root)
  }
  const latex=expressionMath(branch,context,t).latex
  assert.throws(()=>parseMathExpression(latex.replace('\\JLotherwise','\\mathrm{true}'),branch,context,t),/conditionalDefault/)
  assert.throws(()=>parseMathExpression(latex.replace('\\end{cases}',''),branch,context,t))
})

test('空值判断和空返回用业务名称显示，无损往返且不扩大空值语义',async()=>{
  const {editorMessages}=loader('components/Expression/editorMessages.ts')
  const {convertLatexToMarkup}=await import('mathlive/ssr')
  for(const locale of ['zh','en']) {
    const translate=key=>editorMessages[locale][key]
    const roots=[
      {type:'conditional',condition:binary('eq',read,literal(null,'null')),whenTrue:literal(null,'null'),whenFalse:read},
      binary('ne',binary('add',read,literal('1')),literal(null,'null')),
      binary('eq',literal(null,'null'),read),
      {type:'logical',operator:'or',operands:[binary('eq',read,literal(null,'null')),binary('ne',read,literal(null,'null'))]},
      literal(null,'null'),literal('null','string'),literal('','string'),literal(false,'boolean'),literal('0'),
    ]
    for(const root of roots) {
      const projection=expressionMath(root,context,translate)
      assert.deepEqual(parseMathExpression(projection.latex,root,context,translate),root)
      assert.doesNotMatch(convertLatexToMarkup(projection.latex,{macros:projection.macros}),/ML__error/)
    }
    const shown=expressionMath(roots[0],context,translate)
    assert.match(shown.latex,/JLmissing/);assert.match(shown.latex,/JLemptyResult/)
    assert.doesNotMatch(shown.latex,/mathrm\{null\}/)
    assert.match(shown.macros.JLmissing.def,new RegExp(translate('missing')))
    const edited=shown.latex.replace('JLmissing','JLpresent')
    assert.equal(parseMathExpression(edited,roots[0],context,translate).condition.operator,'ne')
    // 等于零、false 和空字符串仍是原比较，不转换为空值判断。
    for(const right of [literal('0'),literal(false,'boolean'),literal('','string')])assert.doesNotMatch(expressionMath(binary('eq',read,right),context,translate).latex,/JLmissing|JLpresent/)
  }
})

test('IF 和 IFS 输入降为原条件树；未选分支保持结构，不执行函数',()=>{
  const doc=expressionDocument(branch,context,t),parse=source=>parseExpressionDocument(source,{...doc,spans:[],tokens:[]},context,branch,t)
  const single=parse('IF(["温度"] >= 80, 2, 0)')
  assert.equal(single.error,undefined);assert.equal(single.node.type,'conditional')
  const multiple=parse('IFS(["温度"] >= 80, 2, ["温度"] >= 60, 1, true, 0)')
  assert.deepEqual(multiple.node,branch)
  assert.equal(parse('IFS(true, 1, false, 0)').error.key,'conditionalDefault')
  assert.equal(parse('IF(true, 1)').error.key,'functionArguments')
  const viaMath=parseMathExpression('\\operatorname{IF}\\left(\\JLa\\ge80,2,0\\right)',branch,context,t)
  assert.deepEqual(viaMath,single.node)
})

test('中英文逻辑文字和类型标记共用数学投影，旧符号与新入口均无损还原',async()=>{
  const {editorMessages}=loader('components/Expression/editorMessages.ts')
  const {convertLatexToMarkup}=await import('mathlive/ssr')
  const roots=[{type:'logical',operator:'and',operands:[{type:'logical',operator:'or',operands:[literal(true,'boolean'),literal(false,'boolean')]},{type:'unary',operator:'not',operand:literal(false,'boolean')}]},literal(null,'null'),literal('hello','string')]
  for(const locale of ['zh','en'])for(const root of roots) {
    const translate=key=>editorMessages[locale][key]
    const shown=expressionMath(root,context,translate)
    assert.deepEqual(parseMathExpression(shown.latex,root,context,translate),root)
    const markup=convertLatexToMarkup(shown.latex,{macros:shown.macros})
    assert.doesNotMatch(markup,/ML__error|background-color/)
    if(root.type === 'logical') {
      for(const key of ['and','or','not'])assert.ok(markup.includes(translate(key)))
      const old=shown.latex.replaceAll('JLand','land').replaceAll('JLor','lor').replaceAll('JLnot','lnot')
      assert.deepEqual(parseMathExpression(old,root,context,translate),root)
    }
  }
  assert.throws(()=>parseMathExpression('\\class{arbitrary}{1}',roots[0],context,t),/unsupportedExpression/)
})

test('数学输入只接受白名单，未知命令、来源或未完成占位不能覆盖有效树',()=>{
  for(const latex of ['\\href{javascript:alert(1)}{x}','\\unknown','\\JLz','\\placeholder{}','\\frac{1}','1 +'])assert.throws(()=>parseMathExpression(latex,branch,context,t),latex)
})

test('回放保留条件中的引用名，就近展示冻结取值和分支事实，未记录时不标记命中',async()=>{
  const explanation={kind:'condition',state:'available',value:2,path:[],children:[
    {kind:'operator',operation:'>=',state:'available',value:true,path:[],children:[{kind:'read',state:'available',value:90,path:['temperature'],children:[]},{kind:'literal',state:'available',value:80,path:[],children:[]}]},
    {kind:'literal',state:'available',value:2,path:[],children:[]},{kind:'unsupported',state:'skipped',value:null,path:[],children:[]}]}
  const facts=explanationFacts(branch,explanation,item=>({text:String(item.value)}))
  const shown=expressionMath(branch,context,t,facts).latex
  assert.doesNotMatch(shown,/underset|checkmark|boxed|usedBranch|is-recorded/);assert.match(shown,/thisReading: 温度: 90/);assert.match(shown,/text\{outcomeMet\}/);assert.match(shown,/\\underline\{/)
  assert.match(shown,/\\JLa/)
  const {convertLatexToMarkup}=await import('mathlive/ssr')
  const projection=expressionMath(branch,context,t,facts)
  const markup=convertLatexToMarkup(projection.latex,{macros:projection.macros})
  assert.doesNotMatch(markup,/ML__error/);assert.match(markup,/温度/);assert.match(markup,/90/)
  assert.doesNotMatch(shown,/is-recorded[^}]*\}\{80\}/,'literal thresholds are not presented as source readings')
  const collapsed=expressionMath(branch,context,t,facts)
  assert.equal(collapsed.skipped,2);assert.equal(collapsed.result,'2')
  assert.match(collapsed.latex,/expression-math-fold/)
  const expanded=expressionMath(branch,context,t,facts,true,{showSkipped:true})
  assert.match(expanded.latex,/is-skipped/);assert.doesNotMatch(expanded.latex,/expression-math-fold/)
  assert.equal(expanded.result,collapsed.result)
  assert.equal(collapsed.inspections.find(item=>item.reference)?.title,'温度\n90')
  const plain=expressionMath(branch,context,t).latex
  assert.doesNotMatch(plain,/checkmark|is-selected|text\{90\}/)
  const parameter={type:'reference',id:'params',path:['limit']}
  const parameterMath=expressionMath(parameter,context,t,new Map([['[]',{state:'available',text:'80'}]]))
  assert.match(parameterMath.latex,/\\JLb/)
  assert.deepEqual(parameterMath.readings.map(item=>[item.label,item.text]),[['温度阈值','80']])
})

test('静态排版复用真实 MathLive，业务名称中的 HTML 和 LaTeX 只作为文本',async()=>{
  const {convertLatexToMarkup}=await import('mathlive/ssr')
  const ctx={...context,references:[{...read,label:'<img src=x onerror=alert(1)> \\class{x}{y} & 100%'}]}
  const projection=expressionMath(read,ctx,t),markup=convertLatexToMarkup(projection.latex,{macros:projection.macros})
  assert.doesNotMatch(markup,/<img|onerror="|class="x"/)
  assert.match(markup,/&lt;/)
  const branchProjection=expressionMath(branch,context,t)
  assert.doesNotMatch(convertLatexToMarkup(branchProjection.latex,{macros:branchProjection.macros}),/ML__error/)
})

test('函数回放保留完整算式，只突出最终记录值；中间值悬浮，零值保留，缺失或不匹配不补算',async()=>{
  const {convertLatexToMarkup}=await import('mathlive/ssr')
  const node={type:'call',function:'math.max',arguments:[read,literal('3')]}
  const record={kind:'call',operation:'math.max',state:'available',value:105,path:[],children:[{kind:'read',state:'available',value:25,path:['temperature'],children:[]},{kind:'literal',state:'available',value:3,path:[],children:[]}]}
  const project=explanation=>expressionMath(node,context,t,explanationFacts(node,explanation,item=>({text:String(item.value)})))
  const shown=project(record)
  // 故意不同于当前输入可推算的值，证明渲染只用冻结记录。
  assert.equal(shown.result,'105')
  assert.match(shown.latex,/operatorname/)
  assert.doesNotMatch(shown.latex,/underset|expression-math-calculation|105/)
  assert.ok(shown.inspections.some(item=>item.title === '最大值\nresult: 105'))
  assert.doesNotMatch(convertLatexToMarkup(shown.latex,{macros:shown.macros}),/ML__error/)
  assert.equal(project({...record,value:0}).result,'0')
  for(const explanation of [{...record,state:'missing'},{...record,state:'skipped',children:[]},{...record,operation:'math.min'}])assert.equal(project(explanation).result,undefined)
  assert.equal(expressionMath(node,context,t).result,undefined)
  const nested={type:'call',function:'math.sqrt',arguments:[node]}
  const nestedRecord={kind:'call',operation:'math.sqrt',state:'available',value:7,path:[],children:[record]}
  const nestedShown=expressionMath(nested,context,t,explanationFacts(nested,nestedRecord,item=>({text:String(item.value)})))
  assert.equal(nestedShown.result,'7');assert.ok(nestedShown.inspections.some(item=>item.title.endsWith('105')))
  assert.doesNotMatch(nestedShown.latex,/105/)
})

test('悬浮锚点保留完整来源，并在刷新后以本次说明覆盖旧值',async()=>{
  const {defineComponent,h,shallowRef}=await import('vue')
  const {createComponentRenderer,flush}=await import('./helpers/componentRuntime.mjs')
  const {convertLatexToMarkup}=await import('mathlive/ssr')
  const previousDocument=globalThis.document;globalThis.document={}
  const local=createComponentLoader({mathlive:{convertLatexToMarkup},'mathlive/fonts.css':{},'mathlive/static.css':{}})
  const {useMathMarkup}=local('components/Expression/useMathMarkup.ts')
  const make=value=>expressionMath(read,context,t,new Map([['[]',{state:'available',text:String(value),resultText:String(value)}]]))
  const projection=shallowRef(make(25)),attrs={}
  const target={title:'旧的原生提示',dataset:{expressionInspect:'0'},removeAttribute(key){delete this[key]},setAttribute(key,value){attrs[key]=value},closest(){return this},getBoundingClientRect(){return {left:30,top:50,width:80,height:24}}}
  const element=shallowRef({querySelectorAll(){return [target]},contains:anchor=>anchor === target,getBoundingClientRect(){return {left:10,top:20}}})
  let model
  const Component=defineComponent({setup(){model=useMathMarkup(projection,element);return()=>h('span')}})
  const {renderer,root}=createComponentRenderer(),app=renderer.createApp(Component)
  try {
    app.mount(root);await flush();await flush()
    assert.match(model.markup.value,/data-expression-inspect/)
    assert.equal(target.title,undefined);assert.equal(target.tabIndex,0)
    assert.equal(attrs['aria-label'],'温度\n25')
    assert.equal(attrs['data-expression-reference'],JSON.stringify(['temperature']))
    model.inspect({target},true)
    assert.equal(model.hint.value.title,'温度\n25')
    assert.deepEqual(model.hint.value.style,{left:'20px',top:'30px',width:'80px',height:'24px'})
    model.hideHint();assert.equal(model.hint.value,undefined)
    model.inspect({target});assert.equal(model.hint.value,undefined,'悬浮短暂经过时不立即创建气泡')
    await new Promise(resolve=>setTimeout(resolve,120))
    assert.equal(model.hint.value.title,'温度\n25')
    projection.value=make(0);await flush()
    assert.equal(target.title,undefined);assert.equal(attrs['aria-label'],'温度\n0')
    assert.equal(model.hint.value,undefined,'刷新销毁旧气泡，避免显示上一轮取值')
    model.inspect({target},true);assert.equal(model.hint.value.title,'温度\n0')
    model.inspect({target:{closest:()=>null}},true);assert.equal(model.hint.value,undefined)
    model.inspect({target});app.unmount()
    await new Promise(resolve=>setTimeout(resolve,120))
    assert.equal(model.hint.value,undefined,'卸载清理待展示气泡，不留下定时器')
  }finally{app.unmount();globalThis.document=previousDocument}
})

test('真实反显默认只显示一个最终值，零值不丢；宿主已有结果时可以隐藏，折叠可展开',async()=>{
  const {defineComponent,h,shallowRef,reactive}=await import('vue')
  const {createComponentRenderer,flush,sourceRoot,walk,textContent}=await import('./helpers/componentRuntime.mjs')
  const {resolve}=await import('node:path')
  let projection
  const local=createComponentLoader({'vue-i18n':{useI18n:()=>({t})},[resolve(sourceRoot,'components/Expression/useMathMarkup.ts')]:{useMathMarkup(value){projection=value;return {markup:shallowRef('<span>rendered math</span>')}}}})
  const View=local('components/Expression/ExpressionView.vue').default
  const node={type:'conditional',condition:{type:'literal',valueType:'boolean',value:true},whenTrue:literal('0'),whenFalse:literal('7')}
  const explanation={kind:'condition',state:'available',value:0,path:[],children:[{kind:'literal',state:'available',value:true,path:[],children:[]},{kind:'literal',state:'available',value:0,path:[],children:[]},{kind:'unsupported',state:'skipped',value:null,path:[],children:[]}]}
  const props=reactive({node,context,explanation,format:item=>({text:String(item.value)})})
  const {renderer,root}=createComponentRenderer(),app=renderer.createApp(defineComponent({setup:()=>()=>h(View,props)}))
  app.config.warnHandler=()=>{};app.mount(root)
  const results=()=>walk(root,item=>item.props.class === 'expression-math-result')
  try {
    await flush();assert.equal(results().length,1);assert.equal(textContent(results()[0]),'=0')
    assert.match(projection.value.latex,/expression-math-fold/)
    walk(root,item=>item.props.class === 'expression-math-toggle')[0].props.onClick();await flush()
    assert.doesNotMatch(projection.value.latex,/expression-math-fold/)
    props.showResult=false;await flush();assert.equal(results().length,0)
  }finally{app.unmount()}
})

test('原公式模式保留冻结的命中分支和最终值，往返不重新计算或替换定义',async()=>{
  const {defineComponent,h,shallowRef,reactive}=await import('vue')
  const {createComponentRenderer,flush,sourceRoot}=await import('./helpers/componentRuntime.mjs')
  const {resolve}=await import('node:path')
  let projection
  const local=createComponentLoader({'vue-i18n':{useI18n:()=>({t})},[resolve(sourceRoot,'components/Expression/useMathMarkup.ts')]:{useMathMarkup(value){projection=value;return {markup:shallowRef('<span>math</span>')}}}})
  const View=local('components/Expression/ExpressionView.vue').default
  const explanation={kind:'condition',state:'available',value:2,path:[],children:[
    {kind:'operator',operation:'>=',state:'available',value:true,path:[],children:[{kind:'read',state:'available',value:90,path:['temperature'],children:[]},{kind:'literal',state:'available',value:80,path:[],children:[]}]},
    {kind:'literal',state:'available',value:2,path:[],children:[]},{kind:'unsupported',state:'skipped',value:null,path:[],children:[]}]}
  const original=JSON.stringify(branch),props=reactive({node:branch,context,explanation,format:item=>({text:String(item.value)}),substitute:true})
  const {renderer,root}=createComponentRenderer(),app=renderer.createApp(defineComponent({setup:()=>()=>h(View,props)}))
  app.config.warnHandler=()=>{};app.mount(root)
  try{
    const recorded=projection.value.latex
    assert.doesNotMatch(recorded,/is-recorded/)
    assert.match(recorded,/thisReading: 温度: 90/)
    props.substitute=false;await flush()
    assert.doesNotMatch(projection.value.latex,/is-recorded/)
    assert.match(projection.value.latex,/JLa/);assert.match(projection.value.latex,/text\{outcomeMet\}/);assert.doesNotMatch(projection.value.latex,/checkmark/)
    assert.ok(projection.value.inspections.some(item=>item.title==='温度\n90'),'切换视图保留悬浮冻结值')
    assert.equal(projection.value.result,'过热','最终值使用结果声明的状态名，保留原始记录编码')
    props.substitute=true;await flush()
    assert.equal(projection.value.latex,recorded)
    assert.equal(JSON.stringify(props.node),original,'the projection never writes a replacement expression')
  }finally{app.unmount()}
})

test('原位放大切换浏览器 top layer，不移动内容；收起恢复焦点',async()=>{
  const {useExpressionWorkspace}=loader('components/Expression/useExpressionWorkspace.ts')
  const scope=effectScope(),model=scope.run(()=>useExpressionWorkspace({node:branch,context,stationary:true},t)),events=[]
  const dialog={open:false,close(){events.push('close');this.open=false},showModal(){events.push('modal');this.open=true}}
  model.stableDialog.value=dialog
  await nextTick();assert.equal(dialog.open,true);assert.deepEqual(events,[])
  model.expanded.value=true;await nextTick();assert.deepEqual(events,['close','modal'])
  model.expanded.value=false;await nextTick();assert.equal(dialog.open,true);assert.deepEqual(events,['close','modal','close'])
  scope.stop()
})

test('状态条件保留主语与枚举含义，本次取值和最终状态分别展示',async()=>{
  const state={type:'reference',id:'state',path:[]}
  const ctx={references:[{...state,label:'当前连接状态',schema:{type:'enum',valueType:{type:'int'},elements:[{value:0,text:'离线'},{value:1,text:'在线'}]}}],functions:[],resultLabels:[{value:4,label:'待观察'}]}
  const node={type:'conditional',condition:binary('eq',state,literal('0')),whenTrue:literal('1'),whenFalse:literal('4')}
  const skipped={kind:'unsupported',state:'skipped',children:[]}
  const record={kind:'condition',state:'available',value:4,children:[{kind:'operator',operation:'==',state:'available',value:false,children:[{kind:'read',state:'available',path:['state'],value:1,children:[]},{kind:'literal',state:'available',value:0,children:[]}]},skipped,{kind:'literal',state:'available',value:4,children:[]}]}
  const facts=explanationFacts(node,record,item=>({text:item === record ? '待观察' : item.kind === 'read' ? '在线' : String(item.value)}))
  const shown=expressionMath(node,ctx,t,facts,true,{substitute:true})
  assert.match(shown.latex,/\\JLa.*=\\JLenum/)
  assert.match(shown.latex,/thisReading: 当前连接状态: 在线/)
  assert.match(shown.latex,/outcomeNotMet/)
  assert.doesNotMatch(shown.latex,/is-recorded/)
  assert.equal(shown.result,'待观察');assert.deepEqual(shown.readings,[])
  const {convertLatexToMarkup}=await import('mathlive/ssr')
  const markup=convertLatexToMarkup(shown.latex,{macros:shown.macros})
  for(const label of ['当前连接状态','离线','在线'])assert.ok(markup.includes(label))
  assert.doesNotMatch(markup,/ML__error/)
})

test('只有纯数值算式支持显式代入，精确小数不经Number转换；默认名称和取值分开',()=>{
  const {canSubstituteNumbers}=loader('components/Expression/presentation.ts')
  const ctx={...context,references:[{...read,label:'温度',schema:{type:'decimal'}}]}
  const node=binary('add',read,read),value='9007199254740993.00000000000000001'
  const facts=new Map([['["left"]',{state:'available',text:value}],['["right"]',{state:'available',text:value}],['[]',{state:'available',text:'',resultText:'999'}]])
  assert.equal(canSubstituteNumbers(node,ctx),true)
  const original=expressionMath(node,ctx,t,facts)
  assert.doesNotMatch(original.latex,/is-recorded/);assert.equal(original.readings.length,1)
  assert.equal(original.readings[0].text,value)
  const numeric=expressionMath(node,ctx,t,facts,true,{substitute:true})
  assert.match(numeric.latex,/is-recorded/);assert.ok(numeric.latex.includes(value));assert.deepEqual(numeric.readings,[])
  assert.equal(numeric.result,'999','最终结果仅取记录，前端不根据两个输入补算')
  for(const type of ['enum','boolean','date','timestamp','datetime','object','array','string',undefined]) {
    const typed={...ctx,references:[{...read,label:'业务数据',schema:{type}}]}
    assert.equal(canSubstituteNumbers(read,typed),false,type)
    assert.doesNotMatch(expressionMath(read,typed,t,new Map([['[]',{state:'available',text:'0'}]]),true,{substitute:true}).latex,/is-recorded/,type)
  }
  for(const expression of [condition,branch,{type:'logical',operator:'and',operands:[condition]},binary('add',read,literal(null,'null'))])assert.equal(canSubstituteNumbers(expression,ctx),false)
  assert.equal(canSubstituteNumbers({type:'call',function:'math.sqrt',arguments:[read]},{...ctx,functions:[{id:'math.sqrt',returnType:'double'}]}),true)
})

test('空值、日期等冻结值不变成裸操作数；缺失、短路和解释不匹配不伪造本次取值',()=>{
  for(const [type,value,text] of [['boolean',false,'否'],['date',1794896479000,'2026-11-17 14:21:19'],['object',{state:1},'{"state":1}'],['array',[1,2],'[1,2]'],['string',null,'空值']]) {
    const ctx={references:[{...read,label:'业务数据',schema:{type}}],functions:[]}
    const node=binary('eq',read,literal(null,'null'))
    const record={kind:'operator',operation:'==',state:'available',value:false,children:[{kind:'read',state:'available',path:['temperature'],value,children:[]},{kind:'literal',state:'available',value:null,children:[]}]}
    const format=item=>({text:item.kind === 'read' ? text : String(item.value)})
    const shown=expressionMath(node,ctx,t,explanationFacts(node,record,format),true,{substitute:true})
    assert.match(shown.latex,/\\JLa/);assert.doesNotMatch(shown.latex,/is-recorded/)
    assert.equal(shown.readings[0].text,text)
    const missing={...record,children:[{...record.children[0],state:'missing'},record.children[1]]}
    assert.deepEqual(expressionMath(node,ctx,t,explanationFacts(node,missing,format)).readings,[])
    assert.deepEqual(expressionMath(node,ctx,t,explanationFacts(node,{...record,operation:'!='},format)).readings,[])
    assert.deepEqual(expressionMath(node,ctx,t,new Map([['[]',{state:'skipped',text:''}]])).readings,[])
  }
})
