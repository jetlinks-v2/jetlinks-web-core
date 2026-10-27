<template>
  <a-config-provider :locale="locale === 'zh' ? zhCN : enUS"><main class="buffer-fixture"><header><strong>独立组件验证 · 合成样本</strong><a-button size="small" @click="locale = locale === 'zh' ? 'en' : 'zh'">{{ locale === 'zh' ? 'English' : '中文' }}</a-button><a-switch v-model:checked="permitted" checked-children="允许重置" un-checked-children="无重置权限" /></header>
    <RuntimeMBeanOverview :beans="beans" :history="history" :show-lifetime="false" :config="config" :reset-access="{ allowed: permitted }" :reset-state="resetState" @update:config="value => config = value" @reset="reset" />
    <p class="fixture-note">只验证生产组件的布局、精确累计、切换与重置确认；重置仅改变此夹具的合成计数。</p>
  </main></a-config-provider>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import enUS from 'ant-design-vue/es/locale/en_US'
import RuntimeMBeanOverview from '../src/components/RuntimeDiagnostics/RuntimeMBeanOverview.vue'
import type { BufferDisplayConfig, BufferHistorySample, MBeanDescriptor, ViewState } from '../src/components/RuntimeDiagnostics/types'
const { locale } = useI18n()
const config = ref<BufferDisplayConfig>({ filter: 'all', view: 'backlog' }), permitted = ref(true), resetState = ref<ViewState>({ status: 'ready' })
const names = ['设备消息持久化', '规则调度缓冲'], identity = (name: string) => `org.jetlinks:type=PersistenceBuffer,name=${name}`
const startedAt = Date.now() - 60000
const history = ref<BufferHistorySample[]>(Array.from({ length: 13 }, (_, index) => ({ sampledAt: startedAt + index * 5000, buffers: names.map((name, position) => ({ objectName: identity(name), pending: position ? 80 + index * 3 : Math.max(10, 320 - index * 22), dead: position ? 0 : 3, written: (9007199254740993n + BigInt(index * (position ? 130 : 250))).toString(), attempted: (9007199254740100n + BigInt(index * (position ? 120 : 260))).toString(), counterEpoch: 0 })) })))
const beans = computed<MBeanDescriptor[]>(() => names.map((name, position) => {
  const current = history.value.at(-1)!.buffers[position]
  const values = { Remainder: current.pending ?? 0, DeadSize: current.dead ?? 0, Monitor: `queue(in ${current.written},out ${current.attempted},dropped 0);consume(opt 100,cost 10 ms);writer(pending 2);dist[0-50ms(100)]`, WriterPending: 2, Wip: 1 }
  return { objectName: identity(name), domain: 'org.jetlinks', type: 'PersistenceBuffer', name, operations: [], attributes: Object.entries(values).map(([name, value]) => ({ name, value, type: typeof value === 'string' ? 'java.lang.String' : 'long', readable: true, available: true })) }
}))
function reset(objectName: string) {
  if (!permitted.value || !config.value.objectName || objectName !== config.value.objectName) return
  resetState.value = { status: 'loading' }
  setTimeout(() => {
    history.value = [...history.value, { sampledAt: Date.now(), buffers: history.value.at(-1)!.buffers.map(queue => queue.objectName === objectName ? { ...queue, written: '0', attempted: '0', counterEpoch: (queue.counterEpoch ?? 0) + 1 } : { ...queue }) }]
    resetState.value = { status: 'ready', sampledAt: Date.now() }
  }, 250)
}
</script>
<style scoped>
.buffer-fixture { --ink-3:var(--ant-color-text-secondary); max-width:1000px; margin:40px auto; padding:20px; background:var(--ant-color-bg-container); }.buffer-fixture > header { display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding-bottom:16px; border-bottom:1px solid var(--ant-color-border-secondary); }.fixture-note { color:var(--ant-color-text-secondary); font-size:12px; margin:14px 0 0; }
@media(max-width:600px) { .buffer-fixture { margin:12px auto; padding:12px; } }
</style>
