<template>
  <main>
    <h1>设备观测 · 真实组件示例</h1>
    <p>仅使用示例数据，不访问后端。</p>
    <div class="preview-controls">
      <a-radio-group v-model:value="count"><a-radio-button v-for="value in [1,2,5]" :key="value" :value="value">{{ value }} devices</a-radio-button></a-radio-group>
      <a-radio-group v-model:value="width"><a-radio-button v-for="value in [360,680,1100]" :key="value" :value="value">{{ value }}px</a-radio-button></a-radio-group>
      <a-button @click="locale = locale === 'zh' ? 'en' : 'zh'">{{ locale === 'zh' ? 'English' : '中文' }}</a-button>
      <a-checkbox v-model:checked="missing">缺测 / 失败</a-checkbox>
    </div>
    <div class="preview-panel" :style="{ maxWidth: `${width}px` }">
      <DeviceSessionObservation v-model:metrics="metrics" v-model:paused="paused" v-model:interval="interval" :entries="entries" :device-options="[]" :device-searching="false" active :access="{ allowed: true }" />
    </div>
  </main>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DeviceSessionObservation from '../src/components/RuntimeDiagnostics/DeviceSessionObservation.vue'
import { deviceObservationSample, deviceObservationMetrics, type DeviceObservationEntry, type DeviceObservationMetric } from '../src/components/RuntimeDiagnostics/device-sessions/observation'
import type { DeviceSessionInfo } from '../src/components/RuntimeDiagnostics/types'
const { locale } = useI18n()
const count = ref(5), width = ref(1100), missing = ref(false), paused = ref(false), interval = ref(5), metrics = ref<DeviceObservationMetric[]>([...deviceObservationMetrics])
const now = Date.now()
function sessions(index: number, step: number): DeviceSessionInfo[] {
  return ['iot-service:8200', 'network-service:8300'].map((serverId, node) => ({ deviceId: `device-${index + 1}`, serverId, connectTime: now - 300_000 + node * 60_000, lastCommTime: now - 2000, pendingMessages: index,
    connections: Array.from({ length: node === 0 ? 2 : 1 }, (_, connection) => ({ id: `connection-${index}-${node}-${connection}`, address: `/192.0.2.${10 + node}:${1883 + node + connection}`, metrics: { connectTime: now - 300_000 + node * 60_000, lastCommTime: now - 3000, readBytes: 1024 * (1 + index) * (step * 5 + 1), writeBytes: 512 * (step * 5 + 1), totalMessages: 20 * (step + 1), pendingMessages: index, droppedMessages: index } })) }))
}
const entries = computed<DeviceObservationEntry[]>(() => Array.from({ length: count.value }, (_, index) => ({
  id: `device-${index + 1}`, label: index < 2 ? '同名设备 / Shared name' : `Factory sensor ${index + 1}`, sessions: sessions(index, 12), collecting: false,
  state: { status: missing.value && index === 0 ? 'stale' : 'ready', sampledAt: now, message: missing.value ? 'Example query failed' : undefined },
  history: Array.from({ length: 13 }, (_, step) => missing.value && step >= 10 ? { sampledAt: now - (12 - step) * 5000, interrupted: index === 0 } : deviceObservationSample(sessions(index, step), now - (12 - step) * 5000)),
})))
</script>
<style scoped>
main { min-height:100vh; padding:16px; background:var(--bg-sunken); }h1 { font-size:20px; }p { color:var(--ink-2); }.preview-controls { display:flex; flex-wrap:wrap; gap:8px; }.preview-panel { margin-top:16px; padding:12px; background:var(--bg-base); min-width:0; }
</style>
