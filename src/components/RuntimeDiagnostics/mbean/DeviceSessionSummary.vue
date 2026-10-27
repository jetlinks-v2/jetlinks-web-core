<template>
  <MBeanSemanticMetrics :metrics="metrics" />
  <a-input-search v-if="available" v-model:value="deviceId" class="bean-query-input" :placeholder="t('runtimeDiagnostics.mbeanSummary.deviceId')" :enter-button="t('runtimeDiagnostics.mbeanSummary.querySession')" :disabled="!context?.access.value.allowed || context.busy.value" :loading="context?.busy.value" :title="context?.access.value.reason" @search="query" />
  <MBeanQueryResult :queries="['deviceSession']">
    <template #default="{ result }"><a-descriptions v-if="record(result)" :column="{ xs: 1, sm: 2 }" size="small"><a-descriptions-item v-for="(value, key) in record(result)" :key="key" :label="t(`runtimeDiagnostics.mbeanSummary.session.${key}`, String(key))">{{ formatValue(value) }}</a-descriptions-item></a-descriptions><CodeBlock v-else :content="formatValue(result)" variant="light" /></template>
  </MBeanQueryResult>
</template>
<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeBlock from '../../CodeBlock/index.vue'
import type { MBeanDescriptor } from '../types'
import { formatValue } from '../utils'
import { useMBeanRendererContext } from './context'
import { mbeanSemanticMetrics } from './semantic'
import MBeanSemanticMetrics from './MBeanSemanticMetrics.vue'
import MBeanQueryResult from './MBeanQueryResult.vue'
const props = defineProps({ bean: { type: Object as PropType<MBeanDescriptor>, required: true } })
const { t } = useI18n(), context = useMBeanRendererContext(), deviceId = ref('')
const metrics = computed(() => mbeanSemanticMetrics(props.bean)), available = computed(() => context?.availableQueries.value.includes('deviceSession'))
function query() { if (deviceId.value.trim()) void context?.query('deviceSession', [deviceId.value]) }
function record(value: unknown) { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined }
</script>
<style scoped>.bean-query-input { max-width:560px; }</style>
