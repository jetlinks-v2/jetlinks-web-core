<template>
  <main>
    <h1>JVM 空态 · 真实组件夹具</h1>
    <p>仅本地状态，不调用后端；预置有样本状态用于验收紧凑工具栏。</p>
    <a-radio-group :value="scenario" button-style="solid" @change="selectScenario($event.target.value)">
      <a-radio-button v-for="value in scenarios" :key="value" :value="value">{{ value }}</a-radio-button>
    </a-radio-group>
    <a-radio-group v-model:value="contentWidth" class="fixture-width" button-style="solid">
      <a-radio-button v-for="width in widths" :key="width" :value="width">{{ width }}px</a-radio-button>
    </a-radio-group>
    <a-button v-if="scenario === 'waiting'" @click="receiveFrame">收到一帧</a-button>
    <div class="fixture-column" :style="{ maxWidth: `${contentWidth}px` }">
      <JvmDiagnosticPanel v-model:active-tab="activeTab" node-id="fixture:8200" :access="access" :sampling-state="samplingState" :snapshot="snapshot" :elapsed-seconds="elapsed" @start="start" @stop="stop" @capture-jfr="record" />
    </div>
    <hr>
    <div class="fixture-column" :style="{ maxWidth: `${contentWidth}px` }">
      <ThreadViewer :threads="scenario === 'receiving' ? threads : []" :state="threadState" :sample-access="access.threadDump" @sample="record('sample')" />
    </div>
    <pre>{{ events }}</pre>
  </main>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { JvmDiagnosticPanel, ThreadViewer } from '../src/components/RuntimeDiagnostics'
import type { FlameFrame, JfrSnapshot, SamplingState } from '../src/components/RuntimeDiagnostics'
const scenarios = ['idle', 'waiting', 'zero-sample', 'receiving', 'stopped', 'error', 'error-without-snapshot', 'forbidden', 'unsupported', 'permission-denied'] as const
const scenario = ref<typeof scenarios[number]>('idle'), events = ref<string[]>([])
const activeTab = ref<'threads' | 'performance' | 'memory'>('performance')
const widths = [560, 626, 960], contentWidth = ref(626)
const elapsed = ref(5), ticker = window.setInterval(() => { if (['waiting', 'zero-sample', 'receiving'].includes(scenario.value)) elapsed.value++ }, 1000)
const snapshot = ref<JfrSnapshot>()
const denied = computed(() => scenario.value === 'permission-denied')
const access = computed(() => ({ threadDump: { allowed: !denied.value }, jfr: { allowed: !denied.value }, jfrView: { allowed: !denied.value, reason: denied.value ? scenario.value : undefined }, jfrExport: { allowed: true }, heapDump: { allowed: true }, heapExport: { allowed: true } }))
const samplingState = computed<SamplingState>(() => scenario.value === 'waiting' ? { status: 'starting', startedAt: Date.now() - elapsed.value * 1000 } : scenario.value === 'zero-sample' ? { status: 'recording', startedAt: Date.now() - elapsed.value * 1000, sampledAt: snapshot.value?.sampledAt, updateCount: 2 } : scenario.value === 'receiving' ? { status: 'recording', startedAt: Date.now() - elapsed.value * 1000, sampledAt: snapshot.value?.sampledAt, updateCount: 91, delay: 'updates', quietSeconds: 5 } : scenario.value === 'stopped' ? { status: 'stopped', startedAt: snapshot.value?.startedAt, sampledAt: snapshot.value?.sampledAt, updateCount: 91 } : scenario.value === 'forbidden' || scenario.value === 'unsupported' ? { status: scenario.value, message: `Server ${scenario.value}` } : scenario.value.startsWith('error') ? { status: 'error', message: 'Fixture stream failed' } : { status: 'idle' })
const threads = [{ id: '1', name: 'fixture-thread', state: 'RUNNABLE', stack: 'fixture', sampledAt: Date.now() }]
const threadState = computed(() => denied.value ? { status: 'forbidden' as const } : { status: 'ready' as const })
function record(value: string) { events.value.push(value) }
function fixtureSnapshot(samples = 8): JfrSnapshot {
  const chain = (frames: Array<[string, string]>, weight: number): FlameFrame => frames.reduceRight<FlameFrame | undefined>((child, [className, method]) => ({ className, method, samples: weight, children: child ? [child] : [] }), undefined)!
  return {
    startedAt: Date.now() - 90_000,
    sampledAt: Date.now() - 5_000,
    flameGraph: samples ? [{ className: 'org.jetlinks.runtime.RuntimeLoop', method: 'poll', samples, children: [
      chain([['org.jetlinks.network.TcpTransport', 'read'], ['io.netty.channel.nio.NioEventLoop', 'run'], ['io.netty.util.concurrent.SingleThreadEventExecutor', 'runAllTasks'], ['org.jetlinks.device.session.DeviceSession', 'decode'], ['io.netty.buffer.AbstractByteBuf', 'readBytes'], ['org.jetlinks.protocol.MessageCodec', 'decode'], ['java.util.concurrent.ConcurrentHashMap', 'compute'], ['org.jetlinks.rule.engine.EventDispatcher', 'dispatch'], ['reactor.core.publisher.FluxPublishOn', 'runAsync'], ['org.jetlinks.runtime.TraceBridge', 'record']], 5),
      chain([['reactor.core.publisher.FluxFlatMap', 'drainLoop'], ['org.jetlinks.rule.engine.RuleExecutor', 'execute'], ['reactor.core.publisher.MonoFlatMap', 'subscribeOrReturn'], ['org.jetlinks.device.service.DeviceService', 'invoke'], ['reactor.core.publisher.FluxOnErrorResume', 'subscribe'], ['org.jetlinks.runtime.MetricReporter', 'report'], ['java.util.concurrent.ScheduledThreadPoolExecutor', 'runWorker'], ['org.jetlinks.network.ConnectionRegistry', 'refresh'], ['reactor.core.scheduler.WorkerTask', 'call']], 3),
    ] }] : [],
    objectAllocations: [],
  }
}
function selectScenario(value: typeof scenarios[number]) {
  scenario.value = value
  activeTab.value = 'performance'
  elapsed.value = ['receiving', 'stopped'].includes(value) ? 90 : 5
  snapshot.value = value === 'zero-sample' ? fixtureSnapshot(0) : ['receiving', 'stopped', 'error'].includes(value) ? fixtureSnapshot() : undefined
}
function start() { record('start'); elapsed.value = 0; snapshot.value = undefined; scenario.value = 'waiting' }
function receiveFrame() { if (scenario.value === 'waiting' && access.value.jfrView.allowed) { snapshot.value = fixtureSnapshot(); scenario.value = 'receiving' } }
function stop() { record('stop'); scenario.value = 'stopped' }
onBeforeUnmount(() => window.clearInterval(ticker))
</script>
<style scoped>
main { min-height:100vh; padding:24px; background:#f5f7fa; }
.fixture-width { margin-inline:8px; }
.fixture-column { margin-top:16px; }
.fixture-column > :deep(.jvm-panel),.fixture-column > :deep(.thread-viewer) { min-height:420px; padding:16px; background:#fff; }
pre { margin-top:16px; }
</style>
