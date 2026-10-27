<template>
  <main class="preview-shell">
    <header class="preview-controls"><strong>生产组件验收 · 合成数据</strong><a-button @click="locale = locale === 'zh' ? 'en' : 'zh'">中文 / English</a-button><a-button @click="scenario = 'http'">HTTP</a-button><a-button @click="scenario = 'error'">异常</a-button><a-button @click="scenario = 'database'">数据库</a-button><a-button @click="refresh">刷新连接快照 {{ revision }}</a-button></header>
    <section class="preview-panel"><TraceViewer :spans="spans" :selected-id="`authentication-service:8100:${spans[0].id}`" :state="{ status: 'ready' }" :log-access="{ allowed: true }" :node-access="{ allowed: true }" /></section>
    <section class="preview-panel"><DeviceSessionViewer details-only result-device-id="sample-device" :sessions="sessions" :state="{ status: 'ready' }" :access="{ allowed: true }" /></section>
  </main>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TraceViewer from '../src/components/RuntimeDiagnostics/TraceViewer.vue'
import DeviceSessionViewer from '../src/components/RuntimeDiagnostics/DeviceSessionViewer.vue'
import type { DeviceSessionInfo, TraceSpan } from '../src/components/RuntimeDiagnostics/types'
const { locale } = useI18n(), scenario = ref('http'), revision = ref(0), now = Date.now()
const spans = computed<TraceSpan[]>(() => [{ id: 'c6ed0a862bb04a5c', traceId: '11111111111111111111111111111111', nodeId: 'authentication-service:8100', name: '/http/POST/logger/access/_query', startNanos: '1792974921716000000', endNanos: '1792974922891000000', attributes: scenario.value === 'database' ? { 'db.system': 'postgresql', 'db.namespace': 'jetlinks', 'db.query.text': 'select id, name, state from device_instance where product_id = ?', 'flux-next-count': 6 } : { 'http.response.status_code': scenario.value === 'error' ? 503 : 200, 'flux-next-count': 0 }, events: scenario.value === 'error' ? [{ name: 'exception', attributes: { 'exception.type': 'java.net.SocketTimeoutException', 'exception.message': '示例：数据库连接超时', 'exception.stacktrace': 'java.net.SocketTimeoutException: sample timeout\n  at example.Connection.read(Connection.java:42)' } }] : [] }])
const sessions = computed<DeviceSessionInfo[]>(() => [{ serverId: 'iot-service:8200', deviceId: 'sample-device', transport: 'MQTT', address: `/127.0.0.1:${revision.value % 2 ? 52000 : 51964}`, connectTime: now - 60000 + revision.value * 1000, lastCommTime: now + revision.value * 5000, connections: (revision.value % 2 ? ['connection-2', 'connection-1', 'connection-3'] : ['connection-1', 'connection-2']).map((id, index) => ({ id, address: `/127.0.0.1:${51964 + index}`, metrics: { connectTime: now - 60000, lastCommTime: now + revision.value * 5000, readBytes: 1024 * (revision.value + 1), writeBytes: 0, totalMessages: revision.value * 10, pendingMessages: 0 } })) }])
function refresh() { revision.value++ }
</script>
<style scoped>
.preview-shell { padding:24px; background:var(--bg-sunken,#f5f7fa); min-height:100vh; color:var(--ink-1); }.preview-controls { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:16px; }.preview-controls strong { margin-right:auto; }.preview-panel { padding:16px; margin-block:16px; background:var(--bg-container,#fff); border-radius:8px; min-width:0; }
</style>
