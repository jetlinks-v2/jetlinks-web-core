<template>
  <section class="allocation-ranking" :aria-label="t('runtimeDiagnostics.recordedAllocations')">
    <div class="allocation-toolbar">
      <div class="allocation-heading"><strong>{{ t('runtimeDiagnostics.recordedAllocations') }}</strong><a-tooltip :title="t('runtimeDiagnostics.allocationHint')"><InfoCircleOutlined tabindex="0" :aria-label="t('runtimeDiagnostics.allocationHint')" /></a-tooltip><span v-if="ranking.classCount" class="allocation-total">{{ t('runtimeDiagnostics.allocationTotal', { bytes: formatAllocationBytes(ranking.totalBytes), count: ranking.classCount.toLocaleString() }) }}</span></div>
      <a-input-search v-if="ranking.classCount" :value="search" size="small" allow-clear :placeholder="t('runtimeDiagnostics.allocationSearch')" :aria-label="t('runtimeDiagnostics.allocationSearch')" @update:value="value => emit('update:search', value)" />
    </div>
    <ol v-if="ranking.rows.length" class="allocation-list">
      <li v-for="item in ranking.rows" :key="item.className" class="allocation-row">
        <span class="allocation-rank" aria-hidden="true">{{ item.rank }}</span>
        <div class="allocation-content">
          <div class="allocation-line"><code class="allocation-name">{{ item.className }}</code><span class="allocation-value" :title="`${t('runtimeDiagnostics.recordedBytes')}: ${item.allocationSize.toLocaleString()} B`"><strong>{{ formatAllocationBytes(item.allocationSize) }}</strong><span :title="t('runtimeDiagnostics.allocationShare')">{{ percentage(item.share) }}</span></span></div>
          <a-progress :percent="item.share" :show-info="false" size="small" :aria-label="t('runtimeDiagnostics.allocationShare')" />
        </div>
      </li>
    </ol>
    <a-empty v-else-if="ranking.classCount" :description="t('runtimeDiagnostics.noMatches')" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
    <div v-else class="allocation-empty"><a-empty :description="t('runtimeDiagnostics.noAllocationEvents')" :image="Empty.PRESENTED_IMAGE_SIMPLE" /><small>{{ t('runtimeDiagnostics.allocationEmptyHint') }}</small><a-button v-if="!integrated" type="link" size="small" @click="emit('go-performance')">{{ t('runtimeDiagnostics.goToPerformance') }}</a-button></div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { Empty } from 'ant-design-vue'
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import type { ObjectAllocation } from './types'
import { allocationRanking, formatAllocationBytes } from './allocationPresentation'
const props = withDefaults(defineProps<{ allocations?: ObjectAllocation[]; search?: string; integrated?: boolean }>(), { allocations: () => [], search: '' })
const emit = defineEmits<{ (event: 'update:search', value: string): void; (event: 'go-performance'): void }>()
const { t } = useI18n()
const ranking = computed(() => allocationRanking(props.allocations, props.search))
function percentage(value: number) { return value > 0 && value < 0.1 ? '<0.1%' : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%` }
</script>
<style scoped>
.allocation-ranking { min-width:0; container-type:inline-size; }
.allocation-toolbar { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--space-2,8px) var(--space-3,12px); margin-bottom:var(--space-2,8px); }
.allocation-heading { display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-2,8px); min-width:0; }
.allocation-heading > :deep(.anticon),.allocation-total { color:var(--ink-3); font-size:var(--fs-12,12px); }
.allocation-toolbar > :deep(.ant-input-search) { width:210px; max-width:100%; }
.allocation-list { list-style:none; padding:0; margin:0; max-height:380px; overflow:auto; scrollbar-gutter:stable; }
.allocation-row { display:flex; align-items:baseline; gap:var(--space-2,8px); padding:var(--space-2,8px) 0; border-bottom:1px solid var(--line); }
.allocation-row:last-child { border-bottom:0; }
.allocation-rank { flex:none; width:24px; color:var(--ink-3); font-size:var(--fs-12,12px); text-align:end; font-variant-numeric:tabular-nums; }
.allocation-content { flex:1; min-width:0; padding-inline-end:var(--space-2,8px); }
.allocation-line { display:flex; align-items:baseline; justify-content:space-between; gap:var(--space-3,12px); }
.allocation-name { min-width:0; overflow-wrap:anywhere; color:var(--ink); font:var(--fs-12,12px)/1.6 ui-monospace,SFMono-Regular,Consolas,monospace; }
.allocation-value { display:flex; align-items:baseline; justify-content:flex-end; flex:none; gap:var(--space-2,8px); min-width:132px; font-size:var(--fs-12,12px); font-variant-numeric:tabular-nums; white-space:nowrap; }
.allocation-value > span { width:48px; text-align:end; color:var(--ink-3); }
.allocation-content > :deep(.ant-progress) { display:block; line-height:1; margin:var(--space-1,4px) 0 0; }
.allocation-empty { display:flex; flex-direction:column; align-items:center; gap:var(--space-1,4px); max-width:360px; margin:var(--space-3,12px) auto 0; text-align:center; }.allocation-empty > :deep(.ant-empty) { margin:0; }.allocation-empty small { color:var(--ink-3); }.allocation-empty > :deep(.ant-btn) { margin-top:calc(var(--space-1,4px) * -1); }
@container(max-width:520px) { .allocation-line { align-items:flex-start; flex-direction:column; gap:var(--space-1,4px); }.allocation-value { align-self:flex-end; } }
</style>
