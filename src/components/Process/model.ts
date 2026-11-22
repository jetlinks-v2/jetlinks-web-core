import type { StructuredExpression } from '../Expression/types'
import type { ExpressionReference } from '../Expression/editor'
import type { ProcessStep, ProcessTemplate, ProcessTemplateEntity } from './types'

export const copyProcess = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export const processId = () => crypto.randomUUID().replaceAll('-', '')
export const literal = (value: unknown): StructuredExpression => ({ version: 1, root: { type: 'literal', valueType: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'double' : 'string', value } })
export function newProcess(): ProcessTemplate {
  return { id: processId(), version: '1', name: '', mode: 'once', inputs: {}, actions: {}, parameters: {}, stepNames: {}, root: { type: 'scope', id: processId(), body: [], interruptions: [], onStop: [] } }
}
export function newProcessStep(type: ProcessStep['type']): ProcessStep {
  const id = processId(), condition = { expression: literal(true) }
  switch (type) {
    case 'action': return { type, id, action: '', arguments: {}, timeoutMillis: 30000 }
    case 'wait': return { type, id, condition, stableMillis: 0, timeoutMillis: 60000, onTimeout: [newProcessStep('end')], onUnavailable: [] }
    case 'branch': return { type, id, condition, whenTrue: [], whenFalse: [], onUnavailable: [] }
    case 'parallel': return { type, id, branches: [[], []] }
    case 'repeat': return { type, id, count: 2, body: [] }
    case 'scope': return { type, id, body: [], interruptions: [], onStop: [] }
    case 'end': return { type, id, outcome: 'failed', reason: '' }
  }
}
export function processLanes(step: ProcessStep): { key: string; label: string; steps: ProcessStep[] }[] {
  switch (step.type) {
    case 'wait': return [{ key: 'onTimeout', label: 'onTimeout', steps: step.onTimeout }, { key: 'onUnavailable', label: 'onUnavailable', steps: step.onUnavailable }]
    case 'branch': return [{ key: 'whenTrue', label: 'whenTrue', steps: step.whenTrue }, { key: 'whenFalse', label: 'whenFalse', steps: step.whenFalse }, { key: 'onUnavailable', label: 'onUnavailable', steps: step.onUnavailable }]
    case 'parallel': return step.branches.map((steps, i) => ({ key: String(i), label: 'parallelBranch', steps }))
    case 'repeat': return [{ key: 'body', label: 'repeatBody', steps: step.body }]
    case 'scope': return [{ key: 'body', label: 'body', steps: step.body }, { key: 'onStop', label: 'onStop', steps: step.onStop }, ...step.interruptions.flatMap((item, i) => [
      { key: `interruptions.${i}.handler`, label: 'interruption', steps: item.handler }, { key: `interruptions.${i}.onUnavailable`, label: 'onUnavailable', steps: item.onUnavailable },
    ])]
    default: return []
  }
}
export function findProcessStep(root: ProcessStep, id?: string): ProcessStep | undefined {
  if (root.id === id) return root
  for (const lane of processLanes(root)) for (const step of lane.steps) { const found = findProcessStep(step, id); if (found) return found }
}
/** 每次修改整个受控值，避免嵌套 prop 写入及分支间共享节点身份。 */
export function updateProcess(template: ProcessTemplate, id: string, update: (step: ProcessStep) => void): ProcessTemplate {
  const next = JSON.parse(JSON.stringify(template)) as ProcessTemplate
  const step = findProcessStep(next.root, id)
  if (step) update(step)
  return next
}
export function insertProcessStep(template: ProcessTemplate, parentId: string, lane: string, index: number, type: ProcessStep['type']): ProcessTemplate {
  return updateProcess(template, parentId, parent => { processLanes(parent).find(item => item.key === lane)?.steps.splice(index, 0, newProcessStep(type)) })
}
export function removeProcessStep(template: ProcessTemplate, id: string): ProcessTemplate {
  const next = JSON.parse(JSON.stringify(template)) as ProcessTemplate
  const remove = (parent: ProcessStep) => processLanes(parent).forEach(lane => {
    const index = lane.steps.findIndex(step => step.id === id)
    if (index >= 0) lane.steps.splice(index, 1)
    else lane.steps.forEach(remove)
  })
  remove(next.root)
  const retained = Object.keys(next.stepNames).filter(key => findProcessStep(next.root, key))
  next.stepNames = Object.fromEntries(retained.map(key => [key, next.stepNames[key]]))
  return next
}
export const readProcessTemplate = (row: ProcessTemplateEntity): ProcessTemplate => JSON.parse(row.published ? row.publishedJson! : row.draftJson!) as ProcessTemplate
export function processReferences(template: ProcessTemplate): ExpressionReference[] {
  return [...Object.entries(template.inputs).map(([id, input]) => ({ id, path: [], label: input.name || id, schema: { type: input.type === 'number' ? 'double' : input.type }, unit: input.unit })),
    ...Object.entries(template.parameters).map(([id, value]) => ({ id, path: [], label: id, schema: { type: typeof value === 'number' ? 'double' : typeof value } }))]
}
export function activeProcessNodes(frame?: import('./types').ProcessFrame): string[] {
  return !frame || frame.done ? [] : [frame.nodeId, ...(frame.children || []).flatMap(activeProcessNodes)]
}

/** 动作签名变动同步所有引用步骤；已有且类型不变的参数表达式保留。 */
export function patchProcessAction(template: ProcessTemplate, id: string, patch: Partial<import('./types').ProcessAction>): ProcessTemplate {
  const next = copyProcess(template), previous = next.actions[id]
  next.actions[id] = {...previous,...patch}
  const visit = (step: ProcessStep): void => {
    if (step.type === 'action' && step.action === id) step.arguments = Object.fromEntries(Object.entries(next.actions[id].parameters).map(([key,type]) =>
      [key, previous.parameters[key] === type && step.arguments[key] ? step.arguments[key] : literal(type === 'boolean' ? false : type === 'number' ? 0 : '')]))
    processLanes(step).forEach(lane => lane.steps.forEach(visit))
  }
  visit(next.root); return next
}
