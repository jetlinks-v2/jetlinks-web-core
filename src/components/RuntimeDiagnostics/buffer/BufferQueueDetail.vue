<template>
  <section class="buffer-detail" :style="{ '--buffer-failure-bg': token.colorErrorBg, '--buffer-failure': token.colorError }">
    <div class="buffer-detail-heading"><h3>{{ t('runtimeDiagnostics.bufferProcessing') }}</h3><a-tag :color="buffer.dead === undefined ? undefined : buffer.dead > 0 ? 'error' : 'success'">{{ t(buffer.dead === undefined ? 'runtimeDiagnostics.unknown' : buffer.dead > 0 ? 'runtimeDiagnostics.hasFailures' : 'runtimeDiagnostics.noFailures') }}</a-tag></div>
    <div class="buffer-flow">
      <template v-for="(stage, index) in stages" :key="stage.key">
        <div class="buffer-stage"><span>{{ t(`runtimeDiagnostics.queue.${stage.key}`) }}</span><strong>{{ stage.value ?? '—' }}</strong><small>{{ t(`runtimeDiagnostics.${stage.unit}`) }}</small></div>
        <RightOutlined v-if="index < stages.length - 1" class="buffer-stage-arrow" aria-hidden="true" />
      </template>
    </div>
    <div v-if="buffer.dead !== undefined && buffer.dead > 0" class="buffer-failure"><strong>{{ buffer.dead }}</strong><span>{{ t('runtimeDiagnostics.failedItems') }}</span><a-button v-if="showOperations" type="link" size="small" @click="emit('request-section', 'operations')">{{ t('runtimeDiagnostics.viewOperations') }}</a-button></div>
    <p class="buffer-stage-note">{{ t('runtimeDiagnostics.bufferIndependentStages') }}</p>
    <div class="buffer-last-error" :class="{ 'has-error': !!buffer.error, 'is-clear': buffer.error === '' }">
      <template v-if="buffer.error"><div class="buffer-error-heading"><WarningOutlined /><strong>{{ t('runtimeDiagnostics.recentError') }}</strong></div><pre class="buffer-error-message">{{ errorMessage }}</pre><a-button v-if="hasStack" type="link" size="small" :aria-expanded="stackOpen" @click="stackOpen = !stackOpen">{{ t(stackOpen ? 'runtimeDiagnostics.collapseStack' : 'runtimeDiagnostics.expandErrorStack') }}</a-button><CodeBlock v-if="hasStack && stackOpen" :content="buffer.error" variant="light" wrap /></template>
      <a-tag v-else-if="buffer.error === ''" color="success"><CheckCircleOutlined /> {{ t('runtimeDiagnostics.noError') }}</a-tag>
      <span v-else class="buffer-error-unknown"><QuestionCircleOutlined /> {{ t('runtimeDiagnostics.recentError') }} · {{ t('runtimeDiagnostics.unknown') }}</span>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { theme } from 'ant-design-vue'
import { CheckCircleOutlined, QuestionCircleOutlined, RightOutlined, WarningOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import CodeBlock from '../../CodeBlock/index.vue'
import type { runtimeBeanOverview } from '../utils'
type BufferView = ReturnType<typeof runtimeBeanOverview>['buffers'][number]
const props = defineProps({ buffer: { type: Object as PropType<BufferView>, required: true }, showOperations: { type: Boolean, default: false } })
const emit = defineEmits<{ (event: 'request-section', section: 'operations'): void }>()
const { t } = useI18n(), { token } = theme.useToken()
const stackOpen = ref(false)
const stages = computed(() => [
  { key: 'writerPending', value: props.buffer.writerPending, unit: 'requests' },
  { key: 'pending', value: props.buffer.pending, unit: 'items' },
  { key: 'wip', value: props.buffer.wip, unit: 'batches' },
])
// 展开时展示实际错误原文；不为单行错误拼造堆栈，也不把未读取视为正常。
const errorMessage = computed(() => props.buffer.error?.split(/\r?\n/).find(line => line.trim()) ?? '')
const hasStack = computed(() => !!props.buffer.error?.trim().includes('\n'))
watch(() => props.buffer.objectName, () => { stackOpen.value = false })
</script>
<style scoped>
.buffer-detail-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.buffer-detail-heading h3 { font-size:var(--fs-body,14px); font-weight:600; margin:0; }.buffer-detail-heading :deep(.ant-tag) { margin:0; }
.buffer-flow { display:grid; grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr) 16px minmax(0,1fr); gap:8px; align-items:center; margin-block:8px; }
.buffer-stage { display:grid; grid-template-columns:minmax(0,1fr) auto; column-gap:6px; align-items:baseline; padding:6px 8px; border-inline-start:2px solid var(--line); text-align:start; }
.buffer-stage > span,.buffer-stage small,.buffer-stage-note,.buffer-stage-arrow,.buffer-error-unknown { font-size:var(--fs-caption,12px); color:var(--ink-3); }
.buffer-stage strong { grid-row:span 2; font-size:var(--fs-title-4,16px); font-weight:600; line-height:1.35; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.buffer-stage-arrow { font-size:var(--fs-caption,12px); }.buffer-stage-note { margin-block:8px 16px; }
.buffer-failure { display:flex; align-items:center; gap:10px; border-radius:6px; padding:10px 12px; background:var(--buffer-failure-bg); }
.buffer-failure > strong { font-size:var(--fs-21,21px); font-weight:600; color:var(--buffer-failure); }.buffer-failure > span { font-size:var(--fs-caption,12px); }.buffer-failure :deep(.ant-btn) { margin-inline-start:auto; padding-inline:0; }
.buffer-last-error { border:1px solid var(--line); border-radius:6px; padding:12px; min-width:0; }.buffer-last-error.has-error { border-color:var(--buffer-failure); }.buffer-last-error.is-clear { display:inline-flex; border:0; padding:0; }
.buffer-last-error :deep(.ant-tag) { margin:0; }.buffer-error-heading { display:flex; align-items:center; gap:6px; color:var(--buffer-failure); font-size:var(--fs-caption,12px); }
.buffer-error-message { font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace; margin:8px 0 0; white-space:pre-wrap; overflow-wrap:anywhere; }.buffer-last-error > :deep(.ant-btn) { padding-inline:0; }
@media(max-width:600px) { .buffer-flow { gap:4px; grid-template-columns:minmax(0,1fr) 10px minmax(0,1fr) 10px minmax(0,1fr); }.buffer-stage { padding:6px 4px; }.buffer-stage strong { font-size:var(--fs-title-4,16px); } }
</style>
