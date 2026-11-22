import type { StructuredExpression } from '../Expression/types'
import type { MetricInputSemantics, MetricSourceReference } from '../Metric/types'
import type { ObjectMember } from '../../object-capability/types'

export interface ProcessObject { type: string; id: string; name?: string }
export interface ProcessMember extends Omit<ObjectMember, 'ref'> {
  ref: Omit<ObjectMember['ref'], 'kind'> & { kind: ObjectMember['ref']['kind'] | 'event' | 'metric' }
  source?: MetricSourceReference
}
export interface ProcessCondition { expression: StructuredExpression }
export interface ProcessInput { name: string; type: 'boolean' | 'number' | 'string' | 'object'; unit?: string; semantics?: MetricInputSemantics }
export interface ProcessAction { name: string; parameters: Record<string, string>; completion: 'accepted' | 'completed'; semanticTypes: string[] }
export interface ProcessInterruption { id: string; priority: number; condition: ProcessCondition; handler: ProcessStep[]; onUnavailable: ProcessStep[] }
export type ProcessStep =
  | { type: 'action'; id: string; action: string; arguments: Record<string, StructuredExpression>; timeoutMillis: number }
  | { type: 'wait'; id: string; condition: ProcessCondition; stableMillis: number; timeoutMillis: number; onTimeout: ProcessStep[]; onUnavailable: ProcessStep[] }
  | { type: 'branch'; id: string; condition: ProcessCondition; whenTrue: ProcessStep[]; whenFalse: ProcessStep[]; onUnavailable: ProcessStep[] }
  | { type: 'parallel'; id: string; branches: ProcessStep[][] }
  | { type: 'repeat'; id: string; count: number; body: ProcessStep[] }
  | { type: 'scope'; id: string; body: ProcessStep[]; interruptions: ProcessInterruption[]; onStop: ProcessStep[] }
  | { type: 'end'; id: string; outcome: 'completed' | 'stopped' | 'interrupted' | 'failed' | 'handed_off'; reason?: string }
export interface ProcessTemplate {
  id: string; version: string; name: string; mode: 'once' | 'continuous'
  inputs: Record<string, ProcessInput>; actions: Record<string, ProcessAction>; parameters: Record<string, unknown>
  root: Extract<ProcessStep, { type: 'scope' }>; stepNames: Record<string, string>
}
export interface ProcessTemplateEntity {
  id: string; templateId: string; version: string; name: string; revision: number; published: boolean
  draftJson?: string; publishedJson?: string
}
export interface ProcessBinding {
  id: string; owner: ProcessObject; slot: string; revision: number; generation: number
  application: 'self' | 'members'; scope?: { provider: string; memberType: string; depth: string }
  priority: number; enabled: boolean; templateId: string; templateVersion: string; parameters: Record<string, unknown>
  inputs: Record<string, { member: string; source: MetricSourceReference; maxAgeMillis: number }>
  actions: Record<string, { provider: string; object: ProcessObject; capability: string; parameters: Record<string, unknown> }>
}
export interface ProcessConfigEntity { id: string; bindingJson: string; synchronization: string; revision: number; generation: number }
export interface ProcessAssignment {
  id: string; configId?: string; desiredConfigId?: string; configGeneration: number; effectiveGeneration: number
  subjectType: string; subjectId: string; slot: string; state: string; executionIntent: string
  currentRunId?: string; reason?: string; bindingJson?: string
}
export type ProcessOperationState = 'prepared' | 'dispatching' | 'accepted' | 'completed' | 'failed' | 'unknown' | 'cancelled'
export interface ProcessObservation { value: unknown; epoch?: string; progress: number; observedAt: number; validUntil: number; quality: 'valid' | 'unavailable' | 'invalid'; continuous: boolean; notification: boolean }
export interface ProcessEvent {
  now: number; observations: Record<string, ProcessObservation>
  operations: Record<string, { state: ProcessOperationState; output: Record<string, unknown>; reason?: string }>
  stop: boolean; recovering: boolean
}
export interface ProcessFrame { nodeId: string; activationId: string; done: boolean; children?: ProcessFrame[]; operationId?: string; phase?: string }
export interface ProcessSnapshot {
  runId: string; revision: number; cycle: number; status: string; outcome?: string; reason?: string; nextDueAt: number
  root?: ProcessFrame; pendingOperations: Record<string, ProcessOperationState>
}
export interface ProcessHistory { nodeId: string; activationId: string; event: string; reason?: string; time: number }
export interface ProcessTrace { snapshot: ProcessSnapshot; intents: { operationId: string; activationId: string; action: string; arguments: Record<string, unknown> }[]; history: ProcessHistory[] }
export interface ProcessSimulationResult { state: ProcessSnapshot; trace: ProcessTrace[] }
export interface ProcessRun { subject: ProcessObject; template: ProcessTemplate; binding: ProcessBinding; snapshot: ProcessSnapshot }
export interface ProcessRunRow { id: string; status: string; snapshotJson: string; createTime?: number }
export interface ProcessOperation { id: string; state: ProcessOperationState; preparedJson: string; resultJson?: string }
export interface ProcessPage<T> { data: T[]; total: number }
/** 宿主负责 API 和身份；设计器、绑定表单与执行视图仅消费这个契约。 */
export interface ProcessApi {
  templates(page: number, published?: boolean): Promise<ProcessPage<ProcessTemplateEntity>>
  template(key: string): Promise<ProcessTemplateEntity>
  resolveTemplate(id: string, version: string): Promise<ProcessTemplateEntity>
  saveTemplate(template: ProcessTemplate, expectedRevision: number): Promise<ProcessTemplateEntity>
  publish(key: string, expectedRevision: number): Promise<ProcessTemplateEntity>
  validate(template: ProcessTemplate): Promise<boolean>
  simulate(template: ProcessTemplate, inputs: ProcessEvent[]): Promise<ProcessSimulationResult>
  configurations(owner: ProcessObject, page: number): Promise<ProcessPage<ProcessConfigEntity>>
  saveBinding(binding: ProcessBinding, expectedRevision: number): Promise<ProcessBinding>
  removeBinding(id: string, expectedRevision: number): Promise<void>
  assignments(owner: ProcessObject, after?: string): Promise<ProcessAssignment[]>
  runs(owner: ProcessObject, page: number): Promise<ProcessRunRow[]>
  run(id: string): Promise<ProcessRun>
  history(id: string, page: number): Promise<{ id: string; revision: number; entriesJson: string }[]>
  operations(id: string, page: number): Promise<ProcessOperation[]>
  start(subject: ProcessObject, slot: string, requestId: string): Promise<{ runId: string; revision: number; status: string }>
  stop(runId: string, requestId: string): Promise<boolean>
  reconcile(runId: string, requestId: string): Promise<boolean>
}
