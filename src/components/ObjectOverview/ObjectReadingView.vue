<script setup lang="ts">
import { computed } from 'vue'
import type { ObjectReadingLayout, ObjectReadingPosition } from './readingLayout'
import { useI18n } from 'vue-i18n'
import ObjectContentGroup, { type ObjectContentEntry } from './ObjectContentGroup.vue'
import { objectOverviewMessages } from './messages'
import { objectMemberContentGroup, type ObjectContentGroupKind } from '../../object-capability/content'
import type { DataCapabilityRuntime, OperationEvent } from '../../data-capability/types'
import type { ObjectReference } from '../../object-capability/types'

const props = defineProps<{
  entries: ObjectContentEntry[]
  labels?: Partial<Record<ObjectContentGroupKind, string>>
  preview?: boolean
  runtime: () => DataCapabilityRuntime | undefined
  layout?: ObjectReadingLayout
}>()
const emit = defineEmits<{ open: [object: ObjectReference]; retry: []; operation: [event: OperationEvent]; 'update:layout': [layout: ObjectReadingLayout] }>()
function position(key: string, value: ObjectReadingPosition) {
  emit('update:layout', { ...props.layout, positions: { ...props.layout?.positions, [key]: value } })
}
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const labels = computed(() => ({ data: t('basicInfo'), status: t('currentStatus'), references: t('references'),
  observations: t('readings'), related: t('relatedData'), actions: t('operations'), ...props.labels }))
const groups = computed(() => {
  const byKind = new Map<ObjectContentGroupKind, ObjectContentEntry[]>()
  for (const entry of props.entries) {
    const kind = objectMemberContentGroup(entry.member)
    const existing = byKind.get(kind)
    if (existing) existing.push(entry)
    else byKind.set(kind, [entry])
  }
  return byKind
})
const primary = computed(() => (['observations', 'data', 'status'] as const).find(kind => groups.value.has(kind)))
const context = computed(() => (['status', 'data', 'references', 'related', 'actions'] as const)
  .filter(kind => kind !== primary.value && groups.value.has(kind)))
</script>
<template>
  <div class="object-reading">
    <div class="object-reading__columns" :class="{ 'object-reading__columns--single': !context.length }">
      <ObjectContentGroup v-if="primary" class="object-reading__primary" :title="labels[primary]" :entries="groups.get(primary)!" appearance="section"
        :position="layout?.positions?.[primary]" @position="position(primary, $event)"
        :preview="preview" :runtime="runtime" @retry="$emit('retry')" @operation="$emit('operation', $event)" @open="$emit('open', $event)" />
      <aside v-if="context.length" class="object-reading__context">
        <ObjectContentGroup v-for="kind in context" :key="kind" :title="labels[kind]" :entries="groups.get(kind)!" appearance="section"
          :position="layout?.positions?.[kind]" @position="position(kind, $event)"
          :preview="preview" :runtime="runtime" @retry="$emit('retry')" @operation="$emit('operation', $event)" @open="$emit('open', $event)" />
      </aside>
      <a-card v-if="$slots.context" size="small" class="object-reading__records"><slot name="context" /></a-card>
    </div>
    <p v-if="!entries.length" class="object-reading__empty" role="status">{{ t('empty') }}</p>
  </div>
</template>
<style scoped>
.object-reading { container-type: inline-size; min-width: 0; padding: 16px; }
.object-reading__empty { margin: 0; padding: 12px 0; color: var(--ant-color-text-secondary, var(--ink-2)); }
.object-reading__columns { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(224px, 1fr); gap: 12px; align-items: start; }
.object-reading__columns--single { grid-template-columns: minmax(0, 1fr); }
.object-reading__primary { height: 480px; min-width: 0; }
.object-reading__context { display: grid; gap: 12px; min-width: 0; }
.object-reading__context > * { height: 234px; }
.object-reading__records { grid-column: 1 / -1; min-width: 0; }
@container (max-width: 620px) { .object-reading__columns { grid-template-columns: minmax(0, 1fr); } }
</style>
