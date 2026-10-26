<template>
  <div v-if="snapshot" class="bean-query-result">
    <a-alert v-if="snapshot.state.status === 'error' || snapshot.state.status === 'forbidden'" type="warning" show-icon :message="snapshot.state.message || t(`runtimeDiagnostics.${snapshot.state.status === 'forbidden' ? 'forbidden' : 'failed'}`)" />
    <a-spin :spinning="snapshot.state.status === 'loading'">
      <slot v-if="snapshot.result !== undefined && snapshot.result !== null" :result="snapshot.result"><CodeBlock :content="formatValue(snapshot.result)" variant="light" /></slot>
      <a-empty v-else-if="snapshot.state.status !== 'loading' && !['error', 'forbidden'].includes(snapshot.state.status)" :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="t('runtimeDiagnostics.empty')" />
    </a-spin>
  </div>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { Empty } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import CodeBlock from '../../CodeBlock/index.vue'
import type { MBeanQueryId } from '../types'
import { formatValue } from '../utils'
import { useMBeanRendererContext } from './context'
const props = defineProps({ queries: { type: Array as PropType<MBeanQueryId[]>, required: true } })
const { t } = useI18n(), context = useMBeanRendererContext()
const snapshot = computed(() => { const value = context?.snapshot.value; return value && props.queries.includes(value.queryId) ? value : undefined })
</script>
<style scoped>
.bean-query-result { margin-block:12px; min-width:0; }
.bean-query-result :deep(.ant-alert) { margin-bottom:8px; }
</style>
