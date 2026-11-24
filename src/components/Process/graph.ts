import type { ProcessStep, ProcessTemplate } from './types'
import { processLanes } from './model'

export interface ProcessGraphNode {
  key: string; role: 'step' | 'lane' | 'join' | 'insert'; x: number; y: number; width: number; height: number
  stepId: string; label?: string; lane?: string; index?: number
}
export interface ProcessGraphEdge { key: string; source: string; target: string; dashed?: boolean; loop?: boolean }
interface Fragment { nodes: ProcessGraphNode[]; edges: ProcessGraphEdge[]; width: number; height: number; entry?: string; exits: string[] }
const nodeWidth = 208, nodeHeight = 72, gap = 48, laneGap = 36
const key = (...parts: (string | number)[]) => JSON.stringify(parts)
const edge = (source: string, target: string, dashed = false, loop = false): ProcessGraphEdge => ({ key: key(source,target), source,target,dashed,loop })
function move(fragment: Fragment, x: number, y: number) { fragment.nodes.forEach(node => { node.x += x; node.y += y }) }

/** 连线只由结构化路径派生；布局和插入位置不写入模板，不允许画出跨作用域跳转。 */
export function processGraph(template: ProcessTemplate, readonly = false): Fragment {
  function sequence(parent: ProcessStep, lane: string, steps: ProcessStep[]): Fragment {
    const fragments: Fragment[] = []
    const insertion = (index: number): Fragment => {
      const id = key('insert',parent.id,lane,index)
      const empty = steps.length === 0
      return { nodes:[{ key:id,role:'insert',stepId:parent.id,lane,index,x:0,y:0,width:empty ? nodeWidth : 24,height:empty ? 40 : 24 }],edges:[],width:empty ? nodeWidth : 24,height:empty ? 40 : 24,entry:id,exits:[id] }
    }
    if (!readonly) fragments.push(insertion(0))
    steps.forEach((step,index) => {
      fragments.push(build(step))
      if (!readonly && step.type !== 'end') fragments.push(insertion(index + 1))
    })
    const width = Math.max(nodeWidth,...fragments.map(fragment => fragment.width))
    const result: Fragment = { nodes:[],edges:[],width,height:0,exits:[] }
    let previous: string[] = []
    fragments.forEach((fragment,index) => {
      move(fragment,(width - fragment.width) / 2,result.height)
      if (!result.entry) result.entry = fragment.entry
      if (fragment.entry) previous.forEach(source => result.edges.push(edge(source,fragment.entry!)))
      result.nodes.push(...fragment.nodes); result.edges.push(...fragment.edges)
      previous = fragment.exits
      result.height += fragment.height + (index === fragments.length - 1 ? 0 : 28)
    })
    result.exits = previous
    return result
  }
  function build(step: ProcessStep): Fragment {
    const id = key('step',step.id)
    const node: ProcessGraphNode = { key:id,role:'step',stepId:step.id,x:0,y:0,width:nodeWidth,height:nodeHeight }
    const all = processLanes(step)
    const lanes = all.filter(lane => lane.steps.length || ['body','whenTrue','whenFalse'].includes(lane.key)
      || step.type === 'parallel' || lane.key.startsWith('interruptions.') && lane.key.endsWith('.handler'))
    if (lanes.length && (step.type === 'action' || step.type === 'wait')) lanes.unshift({key:'normal',label:step.type === 'action' ? 'actionFinished' : 'conditionSatisfied',steps:[]})
    if (!lanes.length) return {nodes:[node],edges:[],width:nodeWidth,height:nodeHeight,entry:id,exits:step.type === 'end' ? [] : [id]}
    const children = lanes.map(lane => {
      const fragment = lane.key === 'normal' ? {nodes:[],edges:[],width:nodeWidth,height:0,exits:[]} as Fragment : sequence(step,lane.key,lane.steps)
      const header: ProcessGraphNode = {key:key('lane',step.id,lane.key),role:'lane',stepId:step.id,lane:lane.key,label:lane.label,x:0,y:0,width:nodeWidth,height:28}
      move(fragment,0,48)
      fragment.nodes.unshift(header)
      if (fragment.entry) fragment.edges.unshift(edge(header.key,fragment.entry))
      fragment.entry = header.key
      if (lane.key === 'normal' || !fragment.exits.length && !lane.steps.length) fragment.exits = [header.key]
      fragment.height += 48; fragment.width = Math.max(nodeWidth,fragment.width)
      header.x = (fragment.width - nodeWidth) / 2
      return {lane,fragment}
    })
    const width = children.reduce((sum,item) => sum + item.fragment.width,0) + laneGap * (children.length - 1)
    const depth = Math.max(...children.map(item => item.fragment.height))
    node.x = (width - nodeWidth) / 2
    const join: ProcessGraphNode = {key:key('join',step.id),role:'join',stepId:step.id,label:step.type === 'parallel' ? 'parallelJoin'
      : step.id === template.root.id ? template.mode === 'continuous' ? 'cycleDone' : 'end' : 'continueProcess',
      x:(width - nodeWidth) / 2,y:nodeHeight + gap + depth + gap,width:nodeWidth,height:28}
    const result: Fragment = {nodes:[node,join],edges:[],width,height:join.y + join.height,entry:id,exits:[join.key]}
    let x = 0
    children.forEach(({lane,fragment}) => {
      move(fragment,x,nodeHeight + gap)
      const exceptional = ['onTimeout','onUnavailable','onRejected','onStop'].includes(lane.key) || lane.key.startsWith('interruptions.')
      result.edges.push(edge(id,fragment.entry!,exceptional))
      const exitsProcess = lane.key === 'onStop' || step.id === template.root.id && lane.key.startsWith('interruptions.')
      if (exitsProcess && fragment.exits.length) {
        const ending: ProcessGraphNode = {key:key('exit',step.id,lane.key),role:'join',stepId:step.id,label:'handlerFinished',
          x:x + (fragment.width - nodeWidth) / 2,y:join.y,width:nodeWidth,height:28}
        result.nodes.push(ending)
        fragment.exits.forEach(source => result.edges.push(edge(source,ending.key,true)))
      } else fragment.exits.forEach(source => result.edges.push(edge(source,join.key,exceptional)))
      result.nodes.push(...fragment.nodes); result.edges.push(...fragment.edges)
      if (step.type === 'repeat' && step.count > 1) fragment.exits.forEach(source => result.edges.push(edge(source,id,true,true)))
      x += fragment.width + laneGap
    })
    return result
  }
  const result = template.root.onStop.length || template.root.interruptions.length ? build(template.root) : sequence(template.root,'body',template.root.body)
  move(result,32,32); result.width += 64; result.height += 64
  return result
}

export function processEdgePath(edge: ProcessGraphEdge, nodes: ProcessGraphNode[]): string {
  const source = nodes.find(node => node.key === edge.source)!, target = nodes.find(node => node.key === edge.target)!
  const sx = source.x + source.width / 2, sy = source.y + source.height, tx = target.x + target.width / 2, ty = target.y
  if (edge.loop) {
    const left = Math.min(source.x,target.x) - 24
    return `M${sx},${sy} V${sy + 12} H${left} V${ty - 12} H${tx} V${ty}`
  }
  const middle = (sy + ty) / 2
  return `M${sx},${sy} V${middle} H${tx} V${ty}`
}
