import assert from 'node:assert/strict'
import test from 'node:test'
import {createMetricLoader} from './helpers/metricRuntime.mjs'

const load=createMetricLoader()
const {parseMathExpression}=load('components/Expression/math.ts')
const {validateExpressionTypes}=load('components/Expression/validation.ts')
const number=value=>({type:'literal',valueType:'int',value:String(value)})
const reference={type:'reference',id:'value',path:[]}
const functions=[['sqrt',1,1],['max',2,16],['round',1,2],['clamp',3,3],['mapRange',5,5]]
  .map(([id,min,max])=>({id:`math.${id}`,name:id,returnType:'number',minimumArguments:min,maximumArguments:max,parameters:[{id:'value',name:'value',valueType:'number'}]}))
const context={references:[{...reference,label:'value',schema:{type:'number'}}],functions,resultTypes:['number','null']}
const parse=latex=>parseMathExpression(latex,reference,context,key=>key)

test('原生TeX单token参数与花括号组等价，保留外围运算和嵌套根式',()=>{
  for(const [compact,grouped] of [
    ['\\sqrt9','\\sqrt{9}'],['\\sqrt\\JLa','\\sqrt{\\JLa}'],
    ['\\sqrt\\sqrt9','\\sqrt{\\sqrt{9}}'],['\\frac12','\\frac{1}{2}'],
    ['\\dfrac\\JLa{12}','\\dfrac{\\JLa}{12}'],['\\frac{12}3','\\frac{12}{3}'],
    ['1+\\frac0{2}','1+\\frac{0}{2}'],
  ])assert.deepEqual(parse(compact),parse(grouped),compact)
  assert.deepEqual(parse('\\sqrt9+2'),{type:'binary',operator:'add',left:{type:'call',function:'math.sqrt',arguments:[number(9)]},right:number(2)})
  for(const latex of ['\\sqrt{\\placeholder{}}','\\frac0{\\placeholder{}}','\\sqrt','\\frac1'])assert.throws(()=>parse(latex),/incomplete/,latex)
})
test('固定、可选和可变参数的数量边界均由目录校验',()=>{
  for(const fn of functions) {
    const latex=count=>`\\operatorname{${fn.name}}\\left(${Array.from({length:count},()=>1).join(',')}\\right)`
    for(let count=fn.minimumArguments;count<=fn.maximumArguments;count++)assert.equal(parse(latex(count)).arguments.length,count,`${fn.id}:${count}`)
    for(const count of [fn.minimumArguments-1,fn.maximumArguments+1])assert.throws(()=>parse(latex(count)),/functionArguments/,`${fn.id}:${count}`)
  }
})
test('分母及函数参数可使用返回数值的分支，布尔结果仍被拒绝',()=>{
  const branch='\\begin{cases}2&\\JLa>0\\\\5&\\JLotherwise\\end{cases}'
  for(const latex of [`\\frac1{${branch}}`,`\\sqrt{${branch}}`,`\\operatorname{max}\\left(1,${branch}\\right)`])assert.equal(validateExpressionTypes(parse(latex),context),undefined,latex)
  assert.throws(()=>parse('\\frac1{\\JLa>0}'),/numericOperand/)
  assert.throws(()=>parse('\\sqrt{\\JLa>0}'),/functionArgumentType/)
})
