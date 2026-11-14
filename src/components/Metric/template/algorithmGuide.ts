import type { MetricCalculatorDescriptor, MetricCalculatorSpec, MetricParameter, MetricStateLabel } from '../types'
import { i18nText } from '../../I18n/text'
import { parseIconValue } from '../../IconValue/iconValue'
import { schemaValueLabels } from '../valueSemantics'
import { algorithmParameterValue } from './algorithm'
import { calculatorGuide, type CalculatorGuide } from './calculatorPresentation'
import { durationSeconds } from './window'
import { simulationDuration } from './simulationFlow'

type Translate = (key:string, values?:Record<string,unknown>) => string
export interface GuideSample { x:number; y:number; label:string }
export interface StateGuideExample {
  span:string; ticks:{x:number;label:string}[]; samples:number[]
  segments:{from:number;to:number;kind:'active'|'inactive'|'unknown'}[]
  labels:{name:string;icon?:string;color?:string}[]
}
export interface AlgorithmGuideModel {
  kind:CalculatorGuide; facts:{name:string;value:string}[]; steps:string[]; note:string
  samples:GuideSample[]; state?:StateGuideExample; leftIntegral?:boolean; warning?:string; grid?:{x:number;label:string}[]
}
const primitive = (value:unknown) => ['string','number','boolean'].includes(typeof value) && (typeof value !== 'number' || Number.isFinite(value))

/** 只生成教学样本、几何和步骤；不执行算法、不读取真实数据、不写入试算样本。 */
export function algorithmGuideModel(spec:MetricCalculatorSpec, descriptor:MetricCalculatorDescriptor|undefined, labels:MetricStateLabel[], locale:string, t:Translate):AlgorithmGuideModel|undefined {
  const kind=calculatorGuide(spec)
  if(!kind)return
  const definitions=descriptor?.parameterDefinitions || []
  const read=(id:string)=>algorithmParameterValue(definitions.find(item=>item.id === id) || {id},spec,descriptor)
  const raw=(id:string)=>{const value=read(id);return primitive(value) ? String(value) : t('guideUnset')}
  const duration=(id:string)=>typeof read(id) === 'string' ? simulationDuration(read(id) as string,t) : t('guideUnset')
  const fields:Record<CalculatorGuide,string[]>={
    stateDuration:['duration','maxHold','activeValue','inactiveValue'],increase:['negativeDelta','modulus','multiplier'],
    integral:['integration','timeUnit','multiplier'],rms:['maxGap'],mad:['maxGap'],rate:['maxGap'],
    ewma:['alpha','maxGap'],difference:['maxGap'],align:['step','duration','maxGap'],
    hampel:['windowSize','sigma','tolerance','replace','maxGap'],spectrum:['sampleRateHz','window','removeMean'],
  }
  const durationIds=['duration','maxHold','timeUnit','maxGap','step']
  const valueText=(id:string,parameter?:MetricParameter)=>{
    const value=read(id)
    if(value == null)return t(id === 'sampleRateHz' ? 'guideRateFromFrame' : 'guideDefault')
    if(durationIds.includes(id))return duration(id)
    const elements=parameter?.valueType?.elements
    const choice=Array.isArray(elements) ? elements.find(item=>item.value === value) : undefined
    if(choice)return i18nText(String(choice.text ?? choice.label ?? choice.value),choice.textI18n,locale)
    const optionKeys:Record<string,string>={reject:'guideReject',resetToZero:'guideReset',rollover:'guideRollover',signed:'guideSigned',left:'guideLeft',trapezoid:'guideTrapezoid',hann:'guideHann',none:'guideWindowNone'}
    return optionKeys[String(value)] ? t(optionKeys[String(value)]) : typeof value === 'boolean' ? t(value ? 'guideYes' : 'guideNo') : raw(id)
  }
  const facts=fields[kind].filter(id=>id !== 'modulus' || read('negativeDelta') === 'rollover').filter(id=>(id !== 'duration' || !spec.inputTypes?.from) && (read(id) != null || !['maxGap','duration'].includes(id))).map(id=>({
    name:definitions.find(item=>item.id === id)?.name || t(`guideParam_${id}`),value:valueText(id,definitions.find(item=>item.id === id)),
  }))
  if(kind === 'stateDuration' && spec.inputTypes?.from)facts.unshift({name:t('guideParam_duration'),value:t('guideRangeInputs')})
  const model:AlgorithmGuideModel={kind,facts,steps:[],note:t(`guideNote_${kind}`),samples:[]}
  if(kind === 'stateDuration') {
    const hold=durationSeconds(typeof read('maxHold') === 'string' ? read('maxHold') as string : undefined)
    const window=durationSeconds(typeof read('duration') === 'string' ? read('duration') as string : undefined)
    if(!hold || !Number.isFinite(hold) || !spec.inputTypes?.from && (!window || !Number.isFinite(window)) || !primitive(read('activeValue')) || !primitive(read('inactiveValue')) || read('activeValue') === read('inactiveValue')) {
      model.warning=t('guideStateIncomplete');return model
    }
    // 展示至多四个有效期的局部片段；轴标题明确片段长度，不伪装完整窗口。
    const span=Math.min(spec.inputTypes?.from ? Infinity : window!,hold*4)
    if(!Number.isFinite(span) || span <= 0){model.warning=t('guideStateIncomplete');return model}
    const second=Math.min(hold/2,span/4),change=span*.75,expiry=Math.min(change,second+hold),end=Math.min(span,change+hold)
    const x=(at:number)=>14+at/span*292
    const segments:StateGuideExample['segments']=[{from:0,to:expiry,kind:'active'},
      {from:expiry,to:change,kind:'unknown'},{from:change,to:end,kind:'inactive'},{from:end,to:span,kind:'unknown'}]
    const declared=labels.length ? labels : schemaValueLabels(spec.inputTypes?.state?.type === 'array' ? spec.inputTypes.state.elementType as Record<string,unknown> : spec.inputTypes?.state)
    const stateLabel=(id:string)=>{
      const value=read(id),label=declared.find(item=>item.value === value),icon=label?.icon,parsed=parseIconValue(icon)
      return {name:label ? `${i18nText(label.name,label.nameI18n,locale)} (${String(value)})` : `${t(`guideParam_${id}`)} (${String(value)})`,icon,color:parsed.kind === 'color' ? parsed.color : undefined}
    }
    const short=(seconds:number)=>{
      const unit=seconds >= 3600 ? 3600 : seconds >= 60 ? 60 : 1
      return `${new Intl.NumberFormat(locale,{maximumSignificantDigits:3}).format(seconds/unit)}${t(unit === 3600 ? 'guideHours' : unit === 60 ? 'guideMinutes' : 'guideSeconds')}`
    }
    const ticks=[...new Set([0,expiry,change,span])].filter((at,index,array)=>index === 0 || index === array.length-1 || (x(at)-x(array[index-1])>48 && x(span)-x(at)>48))
    model.state={span:short(span),ticks:ticks.map(at=>({x:x(at),label:short(at)})),samples:[0,second,change].map(x),
      segments:segments.filter(segment=>segment.to>segment.from).map(segment=>({...segment,from:x(segment.from),to:x(segment.to)})),
      labels:[stateLabel('activeValue'),stateLabel('inactiveValue'),{name:t('guideUnknown')}]}
    return model
  }
  const steps:Record<Exclude<CalculatorGuide,'stateDuration'>,string[]>={
    increase:['guideReading','guideAdjacentDelta','guideApplyMultiplier'],integral:['guideReading','guideArea','guideApplyMultiplier'],
    rms:['guideSquare','guideAverage','guideRoot'],mad:['guideMedian','guideAbsoluteDelta','guideMedian'],
    rate:['guideLastTwo','guideValueDelta','guideDivideTime'],difference:['guideAdjacent','guideValueDelta','guideSequence'],
    ewma:['guidePreviousWeight','guideCurrentWeight','guideSum'],align:['guideGrid','guideHold','guideSequence'],
    hampel:['guideBaseline','guideCandidate','guideMark'],spectrum:['guideWaveform','guideTransform','guideFrequency'],
  }
  const alpha=read('alpha')
  model.steps=steps[kind].map(key=>t(key,{alpha:raw('alpha')}))
  if(kind === 'hampel')model.steps[2]=t(read('replace') === true ? 'guideReplace' : 'guideMark')
  if(kind === 'integral'){model.leftIntegral=read('integration') !== 'trapezoid';model.steps[1]=t(model.leftIntegral ? 'guideLeftArea' : 'guideTrapezoidArea')}
  if(kind === 'ewma' && (typeof alpha !== 'number' || !Number.isFinite(alpha) || alpha<=0 || alpha>1))model.warning=t('guideAlphaIncomplete')
  let values=kind === 'increase' ? [20,40,65,90] : kind === 'integral' ? [20,40,35,60] : kind === 'hampel' ? [4,5,4,5,12,4] : [2,7,3,8,4,6]
  if(kind === 'increase' && ['resetToZero','rollover','signed','reject'].includes(String(read('negativeDelta')))) {
    const modulus=read('modulus'),scale=read('negativeDelta') === 'rollover' && typeof modulus === 'number' && modulus>0 && Number.isFinite(modulus) ? modulus : 100
    values=[.6,.85,.1,.3].map(value=>Number((value*scale).toPrecision(4)))
    model.note=t(`guideIncrease_${String(read('negativeDelta'))}`)
  }
  if(kind === 'hampel') {
    const count=read('windowSize')
    // 只生成前序基线和一个候选点，不运行异常判定；大基线以局部样本示意。
    const shown=typeof count === 'number' && Number.isInteger(count) && count>0 ? Math.min(count,12) : 3
    values=[...Array.from({length:shown},(_,index)=>4+index%2),12]
    if(typeof count === 'number' && count>shown)model.note+=` ${t('guidePartialBaseline',{count:shown})}`
  }
  if(kind === 'align') {
    const step=durationSeconds(typeof read('step') === 'string' ? read('step') as string : undefined)
    if(step && Number.isFinite(step) && step>0)model.grid=Array.from({length:4},(_,index)=>({x:14+index/3*292,label:simulationDuration(`PT${step*index}S`,t)}))
  }
  if(kind === 'spectrum')values=[0,1,0,-1,0,1,0,-1,0]
  const min=Math.min(0,...values),max=Math.max(...values),range=max-min || 1
  model.samples=values.map((value,index)=>({x:14+index/(values.length-1)*292,y:80-(value-min)/range*56,label:new Intl.NumberFormat(locale,{maximumSignificantDigits:4}).format(value)}))
  return model
}
