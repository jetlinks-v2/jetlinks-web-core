<template>
  <div v-if="items.length" class="runtime-bean-extensions">
    <section v-for="item in items" :key="`${item.id}:${item.bean?.objectName ?? ''}`" class="runtime-bean-extension">
      <header>
        <strong>{{ t(item.renderer.overview.titleKey) }}</strong>
        <span v-if="item.state.sampledAt" class="runtime-bean-extension-time">{{ t('runtimeDiagnostics.updatedAt', { time: new Date(item.state.sampledAt).toLocaleString(locale) }) }}</span>
        <a-button type="text" size="small" :loading="busy" :disabled="busy" @click="emit('refresh')">{{ t('runtimeDiagnostics.refresh') }}</a-button>
        <a-button v-if="item.bean" type="link" size="small" @click="emit('inspect', item.bean.objectName)">MBean</a-button>
      </header>
      <DiagnosticsState :state="item.state" @retry="emit('refresh')">
        <MBeanRendererBoundary v-if="item.bean && supported(item.renderer, item.bean)" :key="`${target}:${item.bean.objectName}`">
          <component :is="item.renderer.component" :bean="item.bean" :active="active" :sample-state="item.state.status" compact @request-section="emit('inspect', item.bean.objectName)" />
          <template #fallback><MBeanAttributes :attributes="item.bean.attributes" /></template>
        </MBeanRendererBoundary>
        <a-button v-else-if="item.bean" type="link" @click="emit('inspect', item.bean.objectName)">{{ t('runtimeDiagnostics.attributes') }}</a-button>
      </DiagnosticsState>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { mbeanOverviewRenderers } from './registry'
import type { MBeanDescriptor, MBeanOverviewEntry, MBeanRenderer } from './types'
import DiagnosticsState from './DiagnosticsState.vue'
import MBeanRendererBoundary from './MBeanRendererBoundary.vue'
import MBeanAttributes from './MBeanAttributes.vue'
const props = defineProps({ entries: { type: Array as PropType<MBeanOverviewEntry[]>, default: () => [] }, busy: { type: Boolean, default: false }, target: { type: String, default: '' }, active: { type: Boolean, default: true } })
const emit = defineEmits<{ (event: 'refresh'): void; (event: 'inspect', objectName: string): void }>()
const { t, locale } = useI18n()
const items = computed(() => props.entries.flatMap(entry => {
  const renderer = mbeanOverviewRenderers().find(item => item.id === entry.id)
  return renderer ? [{ ...entry, renderer }] : []
}))
// 扩展匹配器失败同样保留原始对象入口，不能影响其他概览内容。
function supported(renderer: MBeanRenderer, bean: MBeanDescriptor) { try { return renderer.match(bean) } catch { return false } }
</script>
<style scoped>
.runtime-bean-extensions { margin-block:var(--space-4,16px); }
.runtime-bean-extension > header { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
.runtime-bean-extension { padding-top:var(--space-3,12px); border-top:1px solid var(--line); margin-bottom:8px; }
.runtime-bean-extension > header { margin-bottom:12px; }
.runtime-bean-extension-time { color:var(--ink-3); font-size:12px; margin-inline-start:auto; }
</style>
