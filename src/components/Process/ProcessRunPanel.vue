<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import ProcessDesigner from './ProcessDesigner.vue'
import { activeProcessNodes } from './model'
import { useProcessRun } from './useProcessRun'
import { processMessages } from './messages'
import type { ProcessApi } from './types'
const props = defineProps<{ runId: string; api: ProcessApi }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const {run,history,operations,loading,error,historyPage,operationPage,moreHistory,moreOperations,load,operationName} = useProcessRun(toRef(props,'runId'),props.api)
</script>
<template>
  <a-spin :spinning="loading"><div class="process-run-panel">
    <a-space><a-button :loading="loading" @click="load">{{ t('refresh') }}</a-button><a-tag v-if="run">{{ t(run.snapshot.status) }}</a-tag><a-tag v-if="run?.snapshot.outcome">{{ t(run.snapshot.outcome) }}</a-tag><span>{{ run?.snapshot.reason }}</span></a-space>
    <a-alert v-if="error" :message="t('loadFailed')" :description="error" type="error" show-icon />
    <a-tabs v-if="run">
      <a-tab-pane key="steps" :tab="t('steps')"><ProcessDesigner :model-value="run.template" readonly :active="activeProcessNodes(run.snapshot.root)" /></a-tab-pane>
      <a-tab-pane key="history" :tab="t('history')"><a-empty v-if="!history.length" :description="t('empty')" /><a-timeline v-else><a-timeline-item v-for="(item,index) in history" :key="index"><strong>{{ run.template.stepNames[item.nodeId] || item.event }}</strong> · {{ item.event }} · {{ dayjs(item.time).format('YYYY-MM-DD HH:mm:ss') }}<p v-if="item.reason">{{ item.reason }}</p></a-timeline-item></a-timeline><a-space><a-button :disabled="loading || historyPage === 0" @click="historyPage--">{{ t('previous') }}</a-button><a-button :disabled="loading || !moreHistory" @click="historyPage++">{{ t('next') }}</a-button></a-space></a-tab-pane>
      <a-tab-pane key="operations" :tab="t('operations')"><a-empty v-if="!operations.length" :description="t('empty')" /><a-list v-else :data-source="operations"><template #renderItem="{item}"><a-list-item><a-list-item-meta :title="operationName(item)" :description="item.id" /><a-tag>{{ t(item.state) }}</a-tag></a-list-item></template></a-list><a-space><a-button :disabled="loading || operationPage === 0" @click="operationPage--">{{ t('previous') }}</a-button><a-button :disabled="loading || !moreOperations" @click="operationPage++">{{ t('next') }}</a-button></a-space></a-tab-pane>
    </a-tabs>
  </div></a-spin>
</template>
<style scoped>.process-run-panel { display:grid; gap:16px; min-width:0 }</style>
