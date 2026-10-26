<template>
  <div class="attribute-search"><a-input-search v-model:value="search" size="small" :placeholder="t('runtimeDiagnostics.attributeSearch')" allow-clear /></div>
  <a-table :columns="columns" :data-source="filtered" row-key="name" size="small" :pagination="{ pageSize: 12, hideOnSinglePage: true, showSizeChanger: false }" :scroll="{ x: 320 }">
    <template #bodyCell="{ column, record }">
      <div v-if="column.key === 'name'" class="attribute-identity"><a-tooltip :title="record.description"><strong>{{ label(record.name) }}</strong></a-tooltip><small v-if="label(record.name) !== record.name">{{ record.name }}</small><small>{{ record.type }}</small></div>
      <template v-else-if="column.key === 'value'">
        <span v-if="!record.readable || !record.available" class="attribute-unavailable">{{ t(record.readable ? 'runtimeDiagnostics.unavailable' : 'runtimeDiagnostics.notReadable') }}</span>
        <a-collapse v-else-if="complex(record.value)" ghost><a-collapse-panel key="value" :header="t('runtimeDiagnostics.expand')"><CodeBlock :content="formatValue(record.value)" variant="light" /></a-collapse-panel></a-collapse>
        <span v-else class="attribute-value">{{ formatValue(record.value) }}</span>
      </template>
    </template>
  </a-table>
</template>
<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeBlock from '../CodeBlock/index.vue'
import { formatValue } from './utils'
import type { MBeanAttribute } from './types'
const props = defineProps({ attributes: { type: Array as PropType<MBeanAttribute[]>, default: () => [] } })
const { t, te } = useI18n()
const search = ref('')
const label = (name: string) => te(`runtimeDiagnostics.bean.${name}`) ? t(`runtimeDiagnostics.bean.${name}`) : name
const complex = (value: unknown) => value !== null && typeof value === 'object' || typeof value === 'string' && (value.length > 160 || value.includes('\n'))
const filtered = computed(() => props.attributes.filter(attribute => [attribute.name, attribute.type, attribute.description, label(attribute.name)].join(' ').toLowerCase().includes(search.value.trim().toLowerCase())))
const columns = computed(() => [{ key: 'name', title: t('runtimeDiagnostics.attribute'), width: '38%' }, { key: 'value', title: t('runtimeDiagnostics.value') }])
</script>
<style scoped>
.attribute-search { max-width:320px; margin-block:4px 12px; }
.attribute-identity small { display:block; color:var(--ink-3); font-size:var(--fs-caption,12px); overflow-wrap:anywhere; }
.attribute-identity strong { font-weight:500; overflow-wrap:anywhere; }
.attribute-unavailable { color:var(--ink-3); }
.attribute-value { white-space:pre-wrap; overflow-wrap:anywhere; }
</style>
