<template>
  <main>
    <h1>设备会话 · 真实组件示例</h1>
    <p>示例数据，仅用于布局与交互验收；不访问后端、不读取认证信息。</p>
    <div class="preview-controls"><a-select v-model:value="scenario" :options="scenarios.map(value => ({ value, label: value }))" @change="selectScenario" /><a-radio-group v-model:value="width" button-style="solid"><a-radio-button v-for="value in [360, 640, 960]" :key="value" :value="value">{{ value }}px</a-radio-button></a-radio-group><a-button v-if="state.status === 'loading'" @click="finish">返回示例结果</a-button></div>
    <div class="preview-panel" :style="{ maxWidth: `${width}px` }"><DeviceSessionViewer v-model:device-id="input" node-id="iot-service:8200" :queried-device-id="queried" :result-device-id="resultId" :sessions="sessions" :state="state" :access="{ allowed: state.status !== 'forbidden' }" @query="query" @refresh="refresh" /></div>
    <p class="preview-events">交互记录：{{ events.join(' · ') || '尚无操作' }}</p>
  </main>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import DeviceSessionViewer from '../src/components/RuntimeDiagnostics/DeviceSessionViewer.vue'
import type { DeviceSessionInfo, ViewState } from '../src/components/RuntimeDiagnostics/types'
const longId = `device-factory-zone-A-${'long-id-'.repeat(16)}sensor-001`
const now = Date.now(), input = ref(longId), queried = ref(longId), resultId = ref(longId), width = ref(960)
const scenarios = ['示例结果', '初态', '加载新设备', '空结果', '错误保留', '无权限', '缺能力']
const scenario = ref('示例结果'), events = ref<string[]>([]), state = ref<ViewState>({ status: 'ready' })
function sample(id: string): DeviceSessionInfo[] {
  return [
    { deviceId: id, serverId: 'network-service:8300', transport: 'MQTT', address: '/192.168.10.88:18001', connectTime: now - 300_000, lastCommTime: now - 42_000,
      connections: [{ id: 'remote-connection', address: '/192.168.10.88:18001', metrics: { readBytes: 1048576, writeBytes: 32768, connectTime: now - 300_000, lastCommTime: now - 42_000 } }] },
    { deviceId: id, serverId: 'iot-service:8200', transport: 'TCP', address: '/[2001:db8:85a3::8a2e:370:7334]:51021', connectTime: now - 3665_000, lastCommTime: now - 3000, pendingMessages: 0,
      connections: [
        { id: 'connection-current-primary', address: '/[2001:db8:85a3::8a2e:370:7334]:51021', pendingMessages: 0, metrics: { readBytes: 0, writeBytes: 1572864, connectTime: now - 3665_000, lastCommTime: now - 3000, pendingMessages: 0, droppedMessages: 0, totalMessages: 315 } },
        { id: 'connection-current-secondary', address: '/192.168.10.99:51022', pendingMessages: 2, metrics: { readBytes: '9223372036854775807', writeBytes: 0, connectTime: now - 60_000, lastCommTime: now - 9000, droppedMessages: 1 } },
      ] },
    { deviceId: id, serverId: 'edge-service:8201' },
  ]
}
const sessions = ref<DeviceSessionInfo[]>(sample(longId))
function selectScenario() {
  sessions.value = ['示例结果', '加载新设备', '错误保留'].includes(scenario.value) ? sample(longId) : []
  resultId.value = sessions.value.length ? longId : ''
  input.value = scenario.value === '初态' ? '' : scenario.value === '加载新设备' ? 'next-device-002' : longId
  queried.value = scenario.value === '初态' ? '' : input.value
  state.value = { status: scenario.value === '加载新设备' ? 'loading' : scenario.value === '空结果' ? 'empty' : scenario.value === '错误保留' ? 'error' : scenario.value === '无权限' ? 'forbidden' : scenario.value === '缺能力' ? 'unsupported' : 'ready', message: scenario.value === '错误保留' ? '示例查询失败，可重新查询；上次结果仍保留。' : undefined }
}
function query(id: string) { events.value.push(`query(${id})`); queried.value = id; state.value = { status: 'loading' } }
function refresh() { events.value.push(`refresh(${queried.value})`); state.value = { status: 'loading' } }
function finish() { sessions.value = sample(queried.value); resultId.value = queried.value; state.value = { status: 'ready' } }
</script>
<style scoped>
main { min-height:100vh; padding:24px; background:var(--bg-sunken); }h1 { font-size:20px; }p { color:var(--ink-3); }.preview-controls { display:flex; flex-wrap:wrap; gap:8px; }.preview-controls :deep(.ant-select) { width:150px; }.preview-panel { margin-top:16px; padding:16px; background:var(--bg-base); min-width:0; }.preview-events { overflow-wrap:anywhere; font-size:12px; }
</style>
