import type { Component, ComputedRef, ShallowRef } from 'vue'

export interface TargetRef { nodeId: string }
/** 相对范围保留时长语义；from/to 是本次查询解析出的 epoch 毫秒。 */
export interface TimeWindow { from: number; to: number; relativeSeconds?: number }
export interface ViewState {
  status: 'ready' | 'loading' | 'empty' | 'error' | 'forbidden' | 'unsupported' | 'stale'
  message?: string
  sampledAt?: number
}
export interface ActionAccess { allowed: boolean; reason?: string }
export type JvmDiagnosticTab = 'performance' | 'snapshots'
/** 设备联想候选：value 为查询使用的真实设备 ID，label 为可读名称。 */
export interface DeviceSessionDeviceOption { value: string; label: string; description?: string }
export interface DeviceSessionConnection {
  id?: string; address?: string; pendingMessages?: number | string
  metrics?: {
    readBytes?: number | string; writeBytes?: number | string; connectTime?: number | string; lastCommTime?: number | string
    totalMessages?: number | string; pendingMessages?: number | string; droppedMessages?: number | string
  }
}
/** 会话与连接时间均为 epoch 毫秒，计数可用十进制文本保留 Java long 精度。 */
export interface DeviceSessionInfo {
  deviceId?: string; serverId?: string; address?: string; transport?: string; parentDeviceId?: string
  connectTime?: number | string; lastCommTime?: number | string; pendingMessages?: number | string
  connections?: DeviceSessionConnection[]
}
export interface MetricValue { key: string; label: string; value?: string | number; unit?: string; detail?: string }
export interface MetricSample { timestamp: number; value?: number }
export interface MetricChart {
  key: string; label: string; description?: string; unit?: string
  max?: number; minInterval?: number; formatValue?: (value: number) => string
  series: Array<{ key: string; label: string; samples: MetricSample[]; color?: string }>
}
export interface ThreadSnapshot {
  id: string; name: string; state: string; stack: string; lock?: string; sampledAt: number
  lockOwner?: { id?: string; name?: string }
  blockedCount?: number; blockedTime?: number; waitedCount?: number; waitedTime?: number
  inNative?: boolean; suspended?: boolean
}
export interface MBeanAttribute {
  name: string; type: string; readable: boolean; available: boolean; value?: unknown; description?: string
}
export interface MBeanParameter { name: string; type: string; description?: string }
export interface MBeanOperation {
  name: string; signature: string[]; returnType: string; parameters: MBeanParameter[]; description?: string
}
export interface MBeanDescriptor {
  objectName: string; domain: string; type: string; name: string
  attributes: MBeanAttribute[]; operations: MBeanOperation[]
}
export interface MBeanInvocation { bean: MBeanDescriptor; operation: MBeanOperation; args: Array<{ name: string; value: unknown }> }
export type MBeanQueryId = 'deviceSession' | 'eventSubscribers' | 'structuredSubscriptions' | 'brokerAll' | 'brokerByName'
export interface MBeanInvocationOutcome { state: ViewState; result?: unknown }
export interface MBeanQuerySnapshot extends MBeanInvocationOutcome {
  requestId: number; target: string; objectName: string; queryId: MBeanQueryId
}
/** 摘要只获得已核实的查询能力；传输、权限核验和目标路由仍归宿主所有。 */
export interface MBeanRendererContext {
  access: ComputedRef<ActionAccess>; busy: ComputedRef<boolean>
  availableQueries: ComputedRef<readonly MBeanQueryId[]>
  snapshot: Readonly<ShallowRef<MBeanQuerySnapshot | undefined>>
  query(id: MBeanQueryId, values: readonly (string | undefined)[]): Promise<void>
}
export interface MBeanRenderer { id: string; match: (bean: MBeanDescriptor) => boolean; component: Component }
export interface MBeanDisplayConfig { expandedKeys: string[]; section: 'summary' | 'attributes' | 'operations' }
export interface BufferDisplayConfig {
  filter: 'all' | 'failed' | 'pending'
  /** 默认聚合当前已知队列；按队列模式继续使用完整身份图例偏好。 */
  grouping?: 'aggregate' | 'queues'
  objectName?: string
  view?: 'backlog' | 'throughput'
  /** 完整 ObjectName 的显式图例选择；空数组表示主动全关。 */
  visibleObjectNames?: string[]
  scale?: 'linear' | 'compressed'
}
export interface BufferHistorySample {
  sampledAt: number
  buffers: Array<{
    objectName: string; pending?: number; dead?: number
    /** Monitor 累计元素计数，以十进制文本保留 Java long 精度。 */
    written?: string; attempted?: string
    /** 宿主在统计重置后递增；不同 epoch 之间不计算速率。 */
    counterEpoch?: number
  }>
}
export interface LogDisplayConfig { level: string; wrap: boolean }
/** 十进制纳秒文本；无法保留精度的输入应留空，由展示层显示未知时间。 */
export type Nanoseconds = string
export interface TraceEvent {
  name: string; epochNanos?: Nanoseconds; attributes?: Record<string, unknown>
}
export interface TraceSpan {
  id: string; parentId?: string; name: string; nodeId?: string; app?: string; traceId: string
  /** 远程来源独立于服务节点；不能以远程 app 匹配云端节点跳转。 */
  source?: { id: string; label: string }
  startNanos: Nanoseconds; endNanos: Nanoseconds; error?: boolean; attributes?: Record<string, unknown>; events?: TraceEvent[]
}
/** 树结构异常与业务异常分开；有歧义的父级不自动挂接。 */
export interface TraceRow extends TraceSpan {
  key: string; depth: number; duration?: number; parentKey?: string
  missingParent: boolean; ambiguousParent: boolean; cyclic: boolean; duplicate: boolean
}
export interface TraceNodeStatus { nodeId: string; status: string }
/** text 保留完整原文；解析字段缺失时直接显示原文，不丢失未识别行。 */
export interface LogEntry {
  id: string; text: string; time?: string; level?: string; thread?: string; traceId?: string
  message?: string; stack?: string; raw?: string
}
export interface LogFile { id: string; name: string; directory: boolean; providerId: string; operations: string[]; entry?: string; exportName?: string; size?: number; lastModified?: number; current?: boolean; compressed?: boolean; seekable?: boolean }

/** samples 是包含子帧的采样数；duration 不代表实际 CPU 耗时。 */
export interface FlameFrame {
  className: string; method?: string; line?: number; samples: number; children: FlameFrame[]; duration?: number
}
export interface ObjectAllocation { className: string; allocationSize: number }
/** 实时流每次发送累计快照，宿主替换前一份数据，不累加 samples 或分配字节数。 */
export interface JfrSnapshot {
  flameGraph: FlameFrame[]; objectAllocations: ObjectAllocation[]; sampledAt?: number; startedAt?: number
}
export interface SamplingState {
  status: 'idle' | 'starting' | 'recording' | 'stopped' | 'error' | 'forbidden' | 'unsupported'
  message?: string; startedAt?: number; sampledAt?: number
  /** 本次已接收的有效累计快照数，与报告树中的执行样本数无关。 */
  updateCount?: number; quietSeconds?: number; delay?: 'first-frame' | 'updates'
}
/** 宿主计算每项动作的所有必要权限，采集、结果读取与导出分别授权。 */
export interface JvmDiagnosticAccess {
  threadDump: ActionAccess; jfr: ActionAccess; jfrView: ActionAccess; jfrExport: ActionAccess
  heapDump: ActionAccess; heapExport: ActionAccess
}
