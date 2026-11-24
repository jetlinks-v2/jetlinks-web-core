import assert from 'node:assert/strict'
import test from 'node:test'
import { webcrypto } from 'node:crypto'
import { createComponentLoader as createMetricLoader } from './helpers/componentRuntime.mjs'
import { ref, effectScope } from 'vue'
import { flush } from './helpers/componentRuntime.mjs'
if (!globalThis.crypto) globalThis.crypto = webcrypto
const load = createMetricLoader()
const { newProcess, newProcessStep, insertProcessStep, processSteps } = load('components/Process/model.ts')
const { processGraph, processEdgePath } = load('components/Process/graph.ts')

test('单图的并行汇合有每条分支的入边；投影不改模板',()=>{
  const template = newProcess(), parallel = newProcessStep('parallel')
  parallel.branches = [[newProcessStep('action')],[newProcessStep('delay')]]
  template.root.body = [parallel,newProcessStep('action')]
  const original = JSON.stringify(template), graph = processGraph(template,true)
  const join = graph.nodes.find(node=>node.role === 'join' && node.stepId === parallel.id)
  assert.equal(graph.edges.filter(edge=>edge.target === join.key).length,2)
  assert.equal(new Set(graph.nodes.map(node=>node.key)).size,graph.nodes.length)
  assert.equal(JSON.stringify(template),original)
  assert.ok(graph.nodes.every(node=>node.x >= 0 && node.y >= 0))
  assert.ok(graph.edges.every(edge=>!processEdgePath(edge,graph.nodes).includes('NaN')))
})

test('循环、并行与已配置的拒绝路径同图展开，空异常路不抢占主路径',()=>{
  const template = newProcess(), repeat = newProcessStep('repeat'), parallel = newProcessStep('parallel')
  parallel.branches = [[newProcessStep('delay')],[newProcessStep('action')]]
  repeat.body = [parallel]; template.root.body = [repeat]
  const action = parallel.branches[1][0]
  const graph = processGraph(template)
  assert.equal(graph.edges.filter(edge=>edge.loop).length,1)
  const rejected = graph.nodes.find(node=>node.role === 'lane' && node.stepId === action.id && node.lane === 'onRejected')
  assert.equal(rejected,undefined)
  const updated = insertProcessStep(template,action.id,'onRejected',0,'end')
  const configured = processGraph(updated)
  assert.ok(configured.nodes.some(node=>node.role === 'lane' && node.stepId === action.id && node.lane === 'onRejected'))
  assert.equal(processSteps(updated.root).filter(step=>step.type === 'end').length,1)
  assert.equal(template.root.body[0].body[0].branches[1][0].onRejected.length,0)
})

test('新建直接添加步骤；停止处理配置后独立结束，不汇合到正常路径',()=>{
  const template = newProcess()
  const empty = processGraph(template)
  assert.equal(empty.nodes.length,1); assert.equal(empty.nodes[0].role,'insert')
  template.root.body = [newProcessStep('action')]; template.root.onStop = [newProcessStep('action')]
  const graph = processGraph(template,true), join = graph.nodes.find(node=>node.key === JSON.stringify(['join',template.root.id]))
  const stop = graph.nodes.find(node=>node.role === 'step' && node.stepId === template.root.onStop[0].id)
  assert.ok(graph.edges.some(edge=>edge.source === stop.key && edge.target !== join.key))
  assert.equal(graph.edges.some(edge=>edge.source === stop.key && edge.target === join.key),false)
})

test('旧动作缺省拒绝路径时插入仍写到统一结构，不修改来源模板',()=>{
  const template = newProcess(), action = newProcessStep('action')
  delete action.onRejected; template.root.body = [action]
  const next = insertProcessStep(template,action.id,'onRejected',0,'delay')
  assert.equal(next.root.body[0].onRejected[0].type,'delay')
  assert.equal(action.onRejected,undefined)
})

test('恢复与人工核实沿用失败请求身份，核实依据为空时不提交',async()=>{
  const {useProcessRun} = load('components/Process/useProcessRun.ts')
  const id = ref('run'), calls = {resume:[],resolve:[]}; let resumeFails = true, resolveFails = true
  const api = {run:async()=>({snapshot:{status:'held'}}),history:async()=>[],operations:async()=>[],
    resume:async(_,request)=>{calls.resume.push(request);if(resumeFails)throw new Error('response lost');return true},
    resolve:async(_,operation,request,decision,reason)=>{calls.resolve.push({operation,request,decision,reason});if(resolveFails)throw new Error('response lost');return true}}
  const scope = effectScope(), state = scope.run(()=>useProcessRun(id,api)); await flush()
  await state.resume(); resumeFails = false; await state.resume()
  assert.equal(calls.resume[0],calls.resume[1])
  state.beginResolution('operation'); await state.resolve(); assert.equal(calls.resolve.length,0)
  state.resolution.value.reason = '现场记录 A'
  await state.resolve(); resolveFails = false; await state.resolve()
  assert.equal(calls.resolve[0].request,calls.resolve[1].request)
  assert.deepEqual(calls.resolve[1],{operation:'operation',request:calls.resolve[0].request,decision:'completed',reason:'现场记录 A'})
  assert.equal(state.resolution.value,undefined); scope.stop()
})
