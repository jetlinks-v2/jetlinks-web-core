<template>
  <div class="metric-workspace">
    <header class="metric-workspace__head">
      <a-select :value="selection?.ownerType" :placeholder="t('chooseDimension')" class="metric-workspace__dimension" @update:value="(value: unknown) => chooseDimension(String(value))">
        <a-select-option v-for="item in resources.dimensions" :key="item.provider.ownerType" :value="item.provider.ownerType">{{ resourceLabel(item.provider.label) }}</a-select-option>
      </a-select>
      <a-button v-if="businessRoute" type="text" @click="emit('toBusiness', businessRoute, undefined)">{{ t('openBusiness') }}</a-button>
    </header>
    <a-alert v-if="resources.issues.length" type="error" show-icon :message="t('moduleAssemblyFailed')" />
    <a-alert v-if="unavailable" type="warning" show-icon :message="t('dimensionUnavailable')" />
    <div v-if="dimension" class="metric-workspace__body">
      <aside>
        <component :is="dimension.provider.navigator" :key="JSON.stringify([scopeKey, dimension.moduleId, dimension.provider.ownerType])" :selected-id="selection?.ownerId || undefined" @select="confirmObject" />
      </aside>
      <main>
        <MetricWorkspaceScope v-if="context" :key="JSON.stringify([scopeKey, dimension.moduleId, context.ownerType, context.ownerId])"
          :provider="dimension.provider" :context="{ ...context, alarmEnabled }" :initial-reference="initialReference" :detail-link-label="businessRoute ? t('openBusiness') : undefined" @create-alarm="reference => emit('createAlarm', reference)" @open-detail-link="reference => businessRoute && emit('toBusiness', businessRoute, reference)" />
        <a-empty v-else :description="t('chooseMetricObject')" />
      </main>
    </div>
    <a-empty v-else :description="resources.dimensions.length ? t('chooseDimension') : t('noDimensions')" />
  </div>
</template>
<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import { metricMessages } from '../messages'
import type { MetricAlarmReference, MetricLabel, MetricReference, MetricWorkspaceSelection } from '../types'
import { useMetricWorkspace } from './useMetricWorkspace'
import MetricWorkspaceScope from './MetricWorkspaceScope.vue'
const props = withDefaults(defineProps<{ scopeKey: string; selection?: MetricWorkspaceSelection; initialReference?: MetricReference; editable?: boolean; alarmEnabled?: boolean }>(), { editable: false, alarmEnabled: false })
const emit = defineEmits<{ (event: 'update:selection', value: MetricWorkspaceSelection | undefined): void; (event: 'createAlarm', reference: MetricAlarmReference): void; (event: 'toBusiness', route: RouteLocationRaw, reference: MetricReference | undefined): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
let memory: Storage | undefined
try { memory = typeof window === 'undefined' ? undefined : window.localStorage } catch { /* Restricted browsers may disable preference storage. */ }
const { resources, selection, dimension, confirmed, context, unavailable, chooseDimension, confirmObject } = useMetricWorkspace(toRef(props, 'scopeKey'), toRef(props, 'selection'), toRef(props, 'editable'), value => emit('update:selection', value), memory)
const resourceLabel = (label: MetricLabel) => typeof label === 'function' ? label() : label
const businessRoute = computed(() => confirmed.value && dimension.value?.provider.toBusiness?.(confirmed.value))
</script>
<style scoped>
.metric-workspace { display:grid; gap:var(--space-4,16px); min-width:0 }
.metric-workspace__head { display:flex; justify-content:space-between; align-items:center; gap:var(--space-3,12px) }
.metric-workspace__dimension { min-width:180px }
.metric-workspace__body { display:grid; grid-template-columns:minmax(180px,240px) minmax(0,1fr); gap:var(--space-4,16px) }
.metric-workspace__body aside { min-width:0; border-right:1px solid var(--line); padding-right:var(--space-3,12px) }
.metric-workspace__body main { min-width:0 }
@media(max-width:760px) { .metric-workspace__body { grid-template-columns:minmax(0,1fr) } .metric-workspace__body aside { border-right:0; border-bottom:1px solid var(--line); padding:0 0 var(--space-3,12px) } }
</style>
