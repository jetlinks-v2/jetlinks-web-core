import { computed, shallowRef } from 'vue'
import type { MathfieldElement, Selection } from 'mathlive'
import type { ExpressionEditorContext, ExpressionValueChoice } from './editor'
import { enumChoices, expressionValueChoices } from './editor'
import type { ExpressionNode } from './types'
import { expressionText } from './display'
import { referenceKey } from './document'

type ValueType='number'|'boolean'|'string'|'object'|'array'|'null'|'unknown'
type Range=[number,number]
type Atom={offset:number;depth:number;latex:string}
export type MathInsertion={latex:string;kind:'value'|'arithmetic'|'comparison'|'logical'|'predicate'|'not'|'group';valueType?:string}
type Target={range:Range;node?:ExpressionNode;expected:ValueType;choices?:ExpressionValueChoice[];segment?:{range:Range;node:ExpressionNode;expected:ValueType}}
export type FunctionTarget={range:Range;id:string;count:number;argumentsLatex:string;bounds:DOMRect}
const comparison=(operator:string)=>['eq','ne','gt','ge','lt','le'].includes(operator)
const normalize=(value:unknown):ValueType=>typeof value !== 'string' ? 'unknown' : ['int','long','float','double','decimal','bigint','number','date'].includes(value) ? 'number' : ['boolean','string','object','array','null'].includes(value) ? value as ValueType : 'unknown'
const schemaType=(schema?:Record<string,unknown>):ValueType=>schema?.type === 'enum' ? normalize(typeof schema.valueType === 'object' ? (schema.valueType as Record<string,unknown>)?.type : schema.valueType) : normalize(schema?.type)
const compatible=(expected:ValueType,actual:ValueType)=>expected === 'unknown' || actual === 'unknown' || actual === 'null' || expected === actual
const text=(node:ExpressionNode)=>expressionText({version:1,root:node})

/** 工具栏只使用MathLive公开选区和序列化；语法及子表达式仍交给已有解析器。 */
export function useMathInsertion(options:{field:()=>MathfieldElement|undefined;context:()=>ExpressionEditorContext;root:()=>ExpressionNode;parser:()=>((latex:string)=>ExpressionNode);commit:()=>void;disabled:()=>boolean;conditions?:()=>boolean}) {
  const target=shallowRef<Target>()
  const valueChoices=computed(()=>target.value?.choices ?? expressionValueChoices(options.root(),target.value?.node,options.context()))
  const branch=shallowRef<{otherwise:number}>()
  let snapshot:string|undefined
  let nativeSize=-1
  let atoms:Atom[]=[]
  let pending:{latex:string;range:Range;expected:ValueType}|undefined
  // 只保留当前选区涉及的片段（含失败草稿），不累计拖选产生的所有子串。
  let root:ExpressionNode|undefined,context:ExpressionEditorContext|undefined
  let parser:ReturnType<typeof options.parser>|undefined
  let selectionSnapshot=''
  const parsed=new Map<string,ExpressionNode|undefined>(),expectedTypes=new Map<string,ValueType>()
  const parse=(latex:string)=>{
    if(!parsed.has(latex)) {try{parsed.set(latex,parser!(latex))}catch{parsed.set(latex,undefined)}}
    return parsed.get(latex)
  }
  const infer=(node:ExpressionNode):ValueType=>{
    const context=options.context()
    if(node.type === 'literal')return normalize(node.valueType)
    if(node.type === 'reference')return schemaType(context.references.find(item=>referenceKey(item) === referenceKey(node))?.schema)
    if(node.type === 'logical' || node.type === 'unary' && node.operator === 'not' || node.type === 'binary' && comparison(node.operator))return 'boolean'
    if(node.type === 'binary' || node.type === 'unary')return 'number'
    if(node.type === 'call')return normalize(context.functions.find(item=>item.id === node.function)?.returnType)
    const a=infer(node.whenTrue),b=infer(node.whenFalse)
    return a === 'null' ? b : b === 'null' || a === b ? a : 'unknown'
  }
  function expected(node:ExpressionNode):ValueType {
    const wanted=text(node),types:ValueType[]=[],context=options.context()
    if(expectedTypes.has(wanted))return expectedTypes.get(wanted)!
    const visit=(item:ExpressionNode,type:ValueType='unknown')=>{
      if(text(item) === wanted)types.push(type)
      if(item.type === 'binary') {
        visit(item.left,comparison(item.operator) ? infer(item.right) === 'null' ? 'unknown' : infer(item.right) : 'number')
        visit(item.right,comparison(item.operator) ? infer(item.left) === 'null' ? 'unknown' : infer(item.left) : 'number')
      } else if(item.type === 'unary')visit(item.operand,item.operator === 'not' ? 'boolean' : 'number')
      else if(item.type === 'logical')item.operands.forEach(child=>visit(child,'boolean'))
      else if(item.type === 'conditional') {visit(item.condition,'boolean');visit(item.whenTrue,type);visit(item.whenFalse,type)}
      else if(item.type === 'call') {
        const parameters=context.functions.find(fn=>fn.id === item.function)?.parameters || []
        item.arguments.forEach((child,index)=>visit(child,normalize(parameters[Math.min(index,parameters.length-1)]?.valueType)))
      }
    }
    visit(options.root())
    const type=types.length && types.every(type=>type === types[0]) ? types[0] : 'unknown'
    expectedTypes.set(wanted,type)
    return type
  }
  /** 原生空起点分隔分段单元格；拒绝跨单元格截取，避免序列化后意外合成另一个数字。 */
  function sameBranch(range:Range) {
    const selected=atoms.filter(item=>item.offset > range[0] && item.offset <= range[1])
    const depth=Math.min(...selected.map(item=>item.depth))
    return !selected.some(item=>item.depth === depth && !item.latex && item.offset > range[0]+1)
  }
  function siblings(offset:number) {
    const at=atoms[offset],depth=at?.depth
    if(depth === undefined)return []
    let start=offset,end=offset
    while(start>0 && atoms[start-1].depth >= depth && !(atoms[start].depth === depth && !atoms[start].latex))start--
    while(end+1<atoms.length && atoms[end+1].depth >= depth && !(atoms[end+1].depth === depth && !atoms[end+1].latex))end++
    return atoms.slice(start,end+1).filter(item=>item.depth === depth)
  }
  /** 新函数/分支仍含占位时，按公开容器及同层分隔定位槽位；未知草稿不强猜类型。 */
  function enclosingType(range:Range,condition:boolean):ValueType {
    let depth=Math.min(...atoms.slice(range[0]+1,range[1]+1).map(item=>item.depth),atoms[range[1]]?.depth ?? 0)
    for(let offset=range[1]+1;offset<atoms.length;offset++) {
      const group=atoms[offset]
      if(group.depth >= depth)continue
      depth=group.depth
      let previous:Atom|undefined
      for(let index=offset-1;index>=0;index--)if(atoms[index].depth === depth) {previous=atoms[index];break}
      if(group.latex.startsWith('\\left(') && previous?.latex.startsWith('\\operatorname')) {
        const node=parse((previous.latex+group.latex).replace(/\\placeholder\{[^{}]*\}/g,'0'))
        const descriptor=node?.type === 'call' ? options.context().functions.find(item=>item.id === node.function) : undefined
        const index=atoms.slice(previous.offset+1,range[0]+1).filter(item=>item.depth === depth+1 && item.latex === ',').length
        if(descriptor)return normalize(descriptor.parameters[Math.min(index,descriptor.parameters.length-1)]?.valueType)
      }
      if(condition && group.latex.startsWith('\\begin{cases}')) {
        const cells=atoms.slice(previous?.offset ?? 0,range[0]+1).filter(item=>item.depth === depth+1 && !item.latex)
        if(cells.length%2 === 0)return 'boolean'
      }
    }
    return 'unknown'
  }
  function current(selection?:Selection):Target|undefined {
    const field=options.field()
    if(!field || options.disabled())return
    const latex=field.getValue('latex')
    const ranges=(selection || field.selection).ranges,selectionKey=JSON.stringify(ranges)
    const nextRoot=options.root(),nextContext=options.context(),nextParser=options.parser()
    if(snapshot !== latex || nativeSize !== field.lastOffset || root !== nextRoot || context !== nextContext || parser !== nextParser || selectionSnapshot !== selectionKey) {
      parsed.clear();expectedTypes.clear()
      root=nextRoot;context=nextContext;parser=nextParser;selectionSnapshot=selectionKey
    }
    if(snapshot !== latex || nativeSize !== field.lastOffset) {
      snapshot=latex
      nativeSize=field.lastOffset
      atoms=Array.from({length:field.lastOffset+1},(_,offset)=>{const info=field.getElementInfo(offset);return {offset,depth:info?.depth ?? 0,latex:info?.latex || ''}})
    }
    if(ranges.length !== 1)return
    let [start,end]=ranges[0].slice().sort((a,b)=>a-b)
    const selected=field.getValue(start,end,'latex')
    let node=start !== end ? parse(selected) : undefined
    let segment:Target['segment']
    if(start !== end) {
      if(!sameBranch([start,end]))return
      if(!node && !/^\\placeholder\{[^{}]*\}$/.test(selected))return
    } else if(latex) {
      // 光标左侧完整值优先；在操作数开头则替换右侧值，禁止隐式相乘/重复空值。
      let at=atoms[end]
      const usable=(item?:Atom)=>item && (parse(item.latex) || /^[\d.]$/.test(item.latex) || /^\\placeholder/.test(item.latex))
      if(!usable(at) && usable(atoms[end+1]) && atoms[end+1].depth === at?.depth)at=atoms[end+1]
      const peers=at ? siblings(at.offset) : []
      const index=peers.findIndex(item=>item.offset === at?.offset)
      if(at && index >= 0 && usable(at) && !at.latex.startsWith('\\begin{cases}')) {
        let first=index,last=index
        if(/^[\d.]$/.test(at.latex)) {
          while(first>0 && /^[\d.]$/.test(peers[first-1].latex))first--
          while(last+1<peers.length && /^[\d.]$/.test(peers[last+1].latex))last++
          if(first>0 && /^[+-]$/.test(peers[first-1].latex) && (first<2 || !peers[first-2].latex || /^(?:[+\-*/,=<>]|\\(?:times|div|ge|le|ne|JLand|JLor))\s*$/.test(peers[first-2].latex)))first--
        }
        start=first ? peers[first-1].offset : Math.max(0,peers[first].offset-1)
        end=peers[last].offset
        // 变量宏内部也有原生偏移；宏前边界由其完整原子序列化向左定位。
        if(!/^[\d.]$/.test(at.latex)) {
          while(start>0 && atoms[start]?.depth > at.depth)start--
          if(peers[first-1]?.latex.startsWith('\\operatorname'))start=first>1 ? peers[first-2].offset : Math.max(0,peers[first-1].offset-1)
        }
        node=parse(field.getValue(start,end,'latex'))
        if(!node && !/^\\placeholder/.test(at.latex))return
      } else if(at?.latex && !/^(?:[+\-*/,=<>]|\\(?:times|div|ge|le|ne|JLand|JLor|JLnot|JLmissing|JLpresent))\s*$/.test(at.latex))return
      // 逻辑连接作用于完整比较式，不能只连接比较右边的数字。
      const cell=peers.filter(item=>item.latex)
      const before=cell.filter(item=>item.offset <= end)
      const comma=before.map(item=>item.latex).lastIndexOf(',')
      const first=before[comma+1]
      if(first) {
        const range:Range=[comma>=0 ? before[comma].offset : Math.max(0,(peers.find(item=>item.offset === first.offset)?.offset || 0)-1),end]
        // 含宏/函数的子级偏移由同层前一个空起点限定。
        range[0]=comma>=0 ? range[0] : peers[0]?.latex ? range[0] : peers[0]?.offset ?? range[0]
        const parsed=parse(field.getValue(...range,'latex'))
        if(parsed)segment={range,node:parsed,expected:expected(parsed)}
      }
      if(!node && segment && /\\JL(?:missing|present)$/.test(at?.latex || '')) {node=segment.node;[start,end]=segment.range}
    }
    const range:Range=[start,end]
    let type=node ? expected(node) : 'unknown'
    const peers=siblings(end),before=peers.filter(item=>item.offset <= start).pop(),after=peers.find(item=>item.offset>end)
    const adjacent=[before,after].find(item=>/^(?:[=<>+\-*/]|\\(?:ge|le|ne|times|div|JLand|JLor|JLnot))\s*$/.test(item?.latex || ''))
    // 新比较仍有空槽时，直接依据另一侧完整引用提供枚举，不能退回任意数字。
    let choices:ExpressionValueChoice[]|undefined
    if(adjacent && /^(?:=|\\ne)\s*$/.test(adjacent.latex)) {
      const operand=adjacent === before ? peers.filter(item=>item.offset < adjacent.offset).pop() : peers.find(item=>item.offset > adjacent.offset)
      const reference=operand && parse(operand.latex)
      if(reference?.type === 'reference')choices=enumChoices(options.context().references.find(item=>referenceKey(item) === referenceKey(reference))?.schema)
    }
    if(type === 'unknown' && adjacent)type=/^\\JL(?:and|or|not)/.test(adjacent.latex) ? 'boolean' : /^(?:=|\\ne)\s*$/.test(adjacent.latex) ? 'unknown' : 'number'
    if(!node && type === 'unknown' && pending?.latex === latex && pending.range[0] === start && pending.range[1] === end)type=pending.expected
    if(type === 'unknown')type=enclosingType(range,!node && !adjacent)
    // A new branch is not yet in the last valid AST. Its native cell position defines the condition slot.
    if(!adjacent && enclosingType(range,true) === 'boolean')type='boolean'
    if(!node && type === 'unknown') {
      const left=atoms[start]?.latex || ''
      if(/^(?:[+\-*/<>]|\\(?:times|div|ge|le))\s*$/.test(left))type='number'
      if(/^\\(?:JLand|JLor|JLnot)\s*$/.test(left))type='boolean'
    }
    return {range,node,expected:type,choices,segment}
  }
  function caseAt(selection?:Selection) {
    const field=options.field(),ranges=(selection || field?.selection)?.ranges
    if(!field || options.disabled() || ranges?.length !== 1)return
    const [start,end]=ranges[0].slice().sort((a,b)=>a-b)
    for(const group of atoms.slice(end)) {
      if(!group.latex.startsWith('\\begin{cases}'))continue
      let before=group.offset-1
      while(before>0 && atoms[before].depth > group.depth)before--
      if(start < before)continue
      const peers=atoms.slice(before+1,group.offset).filter(item=>item.depth === group.depth+1)
      const fallback=peers.filter(item=>item.latex === '\\JLotherwise').pop()
      const cells:Array<{start:number;end:number;empty:boolean}>=[]
      for(const item of peers) {
        if(!item.latex)cells.push({start:item.offset,end:item.offset,empty:true})
        else if(cells.length) {const cell=cells[cells.length-1];cell.end=item.offset;cell.empty &&= /^\\placeholder\{[^{}]*\}$/.test(item.latex)}
      }
      if(fallback && cells.length >= 4 && cells.length%2 === 0)return {otherwise:fallback.offset,start:before,end:group.offset,depth:group.depth,cells,active:cells.findIndex(cell=>start>=cell.start && end<=cell.end)}
    }
  }
  const refresh=(selection?:Selection)=>{target.value=current(selection);branch.value=caseAt(selection)}
  /** 点击函数名只切换函数；参数文本仍由原生数学字段保留。 */
  function functionAtPoint(x:number,y:number):FunctionTarget|undefined {
    current()
    const field=options.field()
    if(!field || options.disabled())return
    for(const name of atoms.filter(item=>item.latex.startsWith('\\operatorname'))) {
      const bounds=field.getElementInfo(name.offset)?.bounds
      if(!bounds || x<bounds.left || x>bounds.right || y<bounds.top || y>bounds.bottom)continue
      const args=atoms.slice(name.offset+1).find(item=>item.depth === name.depth)
      if(!args?.latex.startsWith('\\left('))continue
      let start=name.offset-1
      while(start>0 && atoms[start].depth>name.depth)start--
      const node=parse(name.latex+args.latex)
      if(node?.type === 'call')return {range:[start,args.offset],id:node.function,count:node.arguments.length,argumentsLatex:args.latex,bounds}
    }
    for(const root of atoms.filter(item=>item.latex.startsWith('\\sqrt{'))) {
      const bounds=field.getElementInfo(root.offset)?.bounds
      if(!bounds || x<bounds.left || x>bounds.left+12 || y<bounds.top || y>bounds.bottom)continue
      let start=root.offset-1
      while(start>0 && atoms[start].depth>root.depth)start--
      return {range:[start,root.offset],id:'math.sqrt',count:1,argumentsLatex:`\\left(${root.latex.slice(6,-1)}\\right)`,bounds}
    }
  }
  /** 短行的列内留白按行定位；实际文字继续交给原生选区，不改变拖选与Shift扩选。 */
  function placeInBlank(x:number,y:number) {
    current()
    const field=options.field()
    if(!field || options.disabled())return false
    for(const group of atoms.filter(item=>item.latex.startsWith('\\begin{cases}'))) {
      const bounds=field.getElementInfo(group.offset)?.bounds
      if(!bounds || x<bounds.left || x>bounds.right || y<bounds.top || y>bounds.bottom)continue
      const place=caseAt({ranges:[[group.offset,group.offset]]})
      if(!place)continue
      const cells=place.cells.map(cell=>{
        const boxes=atoms.slice(cell.start+1,cell.end+1).flatMap(item=>field.getElementInfo(item.offset)?.bounds || [])
        return {cell,left:Math.min(...boxes.map(box=>box.left)),right:Math.max(...boxes.map(box=>box.right)),top:Math.min(...boxes.map(box=>box.top)),bottom:Math.max(...boxes.map(box=>box.bottom))}
      })
      if(cells.some(box=>x>=box.left && x<=box.right && y>=box.top && y<=box.bottom))continue
      const divider=(Math.max(...cells.filter((_,index)=>index%2 === 0).map(box=>box.right))+Math.min(...cells.filter((_,index)=>index%2 === 1).map(box=>box.left)))/2
      const column=x<divider ? 0 : 1
      const match=cells.find((box,index)=>index%2 === column && y>=Math.min(box.top,cells[index%2 ? index-1 : index+1].top)-3 && y<=Math.max(box.bottom,cells[index%2 ? index-1 : index+1].bottom)+3)
      if(!match)continue
      field.focus()
      if(match.cell.empty)field.selection={ranges:[[match.cell.start,match.cell.end]]}
      else field.position=match.cell.end
      refresh()
      return true
    }
    return false
  }
  /** 原生单次insert记录完整撤销；仅序列化原有单元格，不重建AST或丢弃未完成草稿。 */
  function changeRows(place:NonNullable<ReturnType<typeof caseAt>>,row:number,remove=false) {
    const field=options.field()!
    const rows=place.cells.filter((_,index)=>index%2 === 0).map((cell,index)=>[field.getValue(cell.start,cell.end,'latex'),field.getValue(place.cells[index*2+1].start,place.cells[index*2+1].end,'latex')])
    rows.splice(row,remove ? 1 : 0,...(remove ? [] : [['\\placeholder{}','\\placeholder{}']]))
    const latex=rows.length === 1 ? place.depth ? `\\left(${rows[0][0]}\\right)` : rows[0][0] : `\\begin{cases}${rows.map(cells=>cells.join('&')).join('\\\\')}\\end{cases}`
    field.focus();field.executeCommand('moveToGroupStart')
    field.selection={ranges:[[place.start,place.end]]}
    field.insert(latex,{selectionMode:'after',silenceNotifications:true})
    current()
    const next=caseAt(),cell=next?.cells[Math.min(row,rows.length-1)*2]
    if(rows.length>1 && cell)field.selection={ranges:[[cell.start,cell.end]]}
    options.commit();refresh()
  }
  /** 在默认结果前续写分支，保留默认结果和原生undo。 */
  function addBranch() {
    current()
    const field=options.field(),place=caseAt()
    if(!field || !place)return false
    changeRows(place,place.cells.length/2-1)
    return true
  }
  /** 单行整体成为首个分支的结果，不按光标位置拆开算式；未填条件保留为草稿。 */
  function startBranch() {
    const field=options.field()
    if(!field || options.disabled() || options.conditions?.() === false || field.selection.ranges.length !== 1)return false
    current()
    const latex=field.getValue('latex')
    if(atoms.some(item=>item.latex.startsWith('\\begin{cases}')) || latex && !parse(latex))return false
    field.focus();field.selection={ranges:[[0,field.lastOffset]]}
    field.insert(`\\begin{cases}${latex || '\\placeholder{}'}&\\placeholder{}\\\\\\placeholder{}&\\JLotherwise\\end{cases}`,{selectionMode:'placeholder',silenceNotifications:true})
    options.commit();refresh()
    return true
  }
  /** Enter沿当前行续写；仅删除空分支，默认结果不删。IME和组合快捷键继续交给原生编辑器。 */
  function onKeydown(event:KeyboardEvent) {
    if(event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !['Enter','Backspace'].includes(event.key))return
    current()
    const field=options.field(),place=caseAt()
    if(!field)return
    if(!place) {
      if(event.key === 'Enter' && startBranch()) {event.preventDefault();event.stopImmediatePropagation()}
      return
    }
    const row=place.active < 0 ? place.cells.length/2-1 : Math.floor(place.active/2)
    const result=place.cells[row*2],condition=place.cells[row*2+1]
    if(event.key === 'Backspace') {
      const [start,end]=field.selection.ranges[0].slice().sort((a,b)=>a-b)
      if(!result.empty || !condition.empty || row === place.cells.length/2-1 || start < result.start || end > result.end)return
    }
    event.preventDefault();event.stopImmediatePropagation()
    if(event.key === 'Enter') {
      const isDefault=row === place.cells.length/2-1
      changeRows(place,isDefault ? row : row+1)
    } else changeRows(place,row,true)
  }
  function applicable(item:MathInsertion,place=target.value) {
    if(!place)return false
    const actual=place.node ? infer(place.node) : 'unknown'
    // A blank condition can begin with a scalar operand and become a comparison as editing continues.
    if(item.kind === 'value')return compatible(place.expected,normalize(item.valueType))
      || place.expected === 'boolean' && ['unknown','number','string'].includes(actual) && ['number','string'].includes(normalize(item.valueType))
    if(!place.node)return ['comparison','logical','not'].includes(item.kind) && ['boolean','unknown'].includes(place.expected)
    if(item.kind === 'logical' || item.kind === 'not')return ['boolean','unknown'].includes(infer(place.segment?.node || place.node)) && compatible(place.segment?.expected ?? place.expected,'boolean')
    if(item.kind === 'arithmetic')return ['number','unknown'].includes(actual)
    if(item.kind === 'comparison')return actual !== 'boolean' && actual !== 'object' && actual !== 'array' && compatible(place.expected,'boolean')
    if(item.kind === 'predicate')return compatible(place.expected,'boolean')
    return true
  }
  /** 菜单焦点不改变原生选区；执行前重新解析，失效候选不能写入。一次insert保留原生undo。 */
  function insert(item:MathInsertion,selection?:Selection) {
    const field=options.field(),place=current(selection)
    if(!field || !place || !applicable(item,place))return false
    if(item.kind === 'value' && item.valueType !== 'null') {
      const choices=place.choices ?? expressionValueChoices(options.root(),place.node,options.context())
      const candidate=parse(item.latex)
      if(choices && (!candidate || candidate.type !== 'literal' || !choices.some(choice=>String(choice.node.value) === String(candidate.value) && choice.node.valueType === candidate.valueType)))return false
    }
    // Inserting between existing operands reuses the right-hand content instead of adding a blank before it.
    // Native cell boundaries keep an operand from another condition/function argument out of this decision.
    const original=(selection || field.selection).ranges[0]
    if(original[0] === original[1] && ['arithmetic','comparison','logical'].includes(item.kind)) {
      const cursor=original[0],peers=siblings(cursor),left=peers.find(atom=>atom.offset === cursor),right=peers.find(atom=>atom.offset > cursor)
      const operator=(atom?:Atom)=>/^(?:[+\-*/=<>]|\\(?:times|div|ge|le|ne|JLand|JLor))\s*$/.test(atom?.latex || '')
      const operand=(atom?:Atom)=>Boolean(atom?.latex && (parse(atom.latex) || /^\\placeholder\{[^{}]*\}$/.test(atom.latex)))
      let range:Range|undefined,latex=item.latex === '\\dfrac{#@}{#?}' ? '\\div ' : item.latex
      if(operand(right)) {
        if(operator(left))range=[peers[peers.indexOf(left!)-1]?.offset ?? Math.max(0,cursor-1),cursor]
        else if(operand(left))range=[cursor,cursor]
        else if(!left?.latex){range=[cursor,cursor];latex='#?'+latex}
      } else if(operator(right) && operand(peers[peers.indexOf(right!)+1]))range=[cursor,right!.offset]
      if(range) {
        field.focus();field.selection={ranges:[range]}
        field.insert(latex,{selectionMode:latex.includes('#?') ? 'placeholder' : 'after',silenceNotifications:true})
        options.commit();refresh()
        return true
      }
    }
    let range=place!.range
    if(item.kind === 'logical' || item.kind === 'not')range=place!.segment?.range || range
    const left=(item.kind === 'logical' ? place.segment?.node : place.node)?.type
    const operand=!place.node ? '#?' : left && ['binary','logical','conditional'].includes(left) ? '\\left(#0\\right)' : '#0'
    const latex=item.kind === 'value' ? item.latex : item.kind === 'group' ? '\\left(#0\\right)' : item.kind === 'predicate' ? `${operand}\\;${item.latex}` : item.kind === 'not' ? `\\JLnot\\left(${place.node ? '#0' : '#?'}\\right)` : item.latex === '\\dfrac{#@}{#?}' ? '\\dfrac{#0}{#?}' : `${operand}${item.latex}#?`
    field.focus();field.selection={ranges:[range]}
    field.insert(latex,{selectionMode:'placeholder',silenceNotifications:true})
    pending={latex:field.getValue('latex'),range:field.selection.ranges[0],expected:item.kind === 'logical' || item.kind === 'not' ? 'boolean' : item.kind === 'arithmetic' ? 'number' : item.kind === 'comparison' ? /^(?:=|\\ne)$/.test(item.latex) ? 'unknown' : 'number' : place!.expected}
    options.commit();refresh()
    return true
  }
  return {refresh,insert,applicable,valueChoices,canInsertValue:computed(()=>!!target.value),canAddBranch:computed(()=>!!branch.value),addBranch,startBranch,onKeydown,placeInBlank,functionAtPoint,target}
}
