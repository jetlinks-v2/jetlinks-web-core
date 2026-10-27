<template>
  <section class="log-entry-details" :aria-label="t('runtimeDiagnostics.logDetails')">
    <dl class="log-entry-metadata">
      <template v-if="entry.time"><dt>{{ t('runtimeDiagnostics.logTime') }}</dt><dd>{{ entry.time }}</dd></template>
      <template v-if="entry.thread"><dt>{{ t('runtimeDiagnostics.thread') }}</dt><dd>{{ entry.thread }}</dd></template>
      <template v-if="entry.traceId"><dt>{{ t('runtimeDiagnostics.traceIdentifier') }}</dt><dd>{{ entry.traceId }}</dd></template>
    </dl>
    <CodeBlock :content="raw" :wrap="wrap" variant="light" copyable :copy-title="t('runtimeDiagnostics.copy')" :label="t('runtimeDiagnostics.rawLogText')"><template v-for="(part, index) in parts" :key="index"><mark v-if="part.match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></CodeBlock>
  </section>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeBlock from '../../CodeBlock/index.vue'
import type { LogEntry } from '../types'
import { logHighlight, logPresentation } from './presentation'
const props = defineProps({ entry: { type: Object as PropType<LogEntry>, required: true }, query: { type: String, default: '' }, wrap: { type: Boolean, default: true } })
const { t } = useI18n()
const raw = computed(() => logPresentation(props.entry).raw)
const parts = computed(() => logHighlight(raw.value, props.query))
</script>
<style scoped>
.log-entry-details { min-width:0; margin-block:6px 4px; font-size:12px; }
.log-entry-metadata { display:grid; grid-template-columns:max-content minmax(0,1fr); gap:3px 10px; margin:0 0 8px; line-height:1.7; }
.log-entry-metadata:empty { display:none; }.log-entry-metadata dt { color:var(--ink-3); }.log-entry-metadata dd { margin:0; min-width:0; white-space:pre-wrap; overflow-wrap:anywhere; }
.log-entry-details mark { color:inherit; background:var(--diagnostic-log-highlight); border-radius:2px; }
</style>
