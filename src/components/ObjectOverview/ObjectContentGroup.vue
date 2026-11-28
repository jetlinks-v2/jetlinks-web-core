<script setup lang="ts">
import { computed, nextTick, onErrorCaptured, ref, watch } from 'vue'
import type { ObjectReadingPosition } from './readingLayout'
import { useIntersectionObserver, useResizeObserver } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { InfoCircleOutlined, HistoryOutlined, DownOutlined } from '@ant-design/icons-vue'
import ObjectContentValue from './ObjectContentValue.vue'
import ObjectOperationPanel from './ObjectOperationPanel.vue'
import ObjectDataExplorer from './ObjectDataExplorer.vue'
import { objectDataAccess } from '../../object-capability/dataAccess'
import { objectOverviewMessages } from './messages'
import { selectionKey } from '../../object-capability/dashboard'
import { objectMemberContentGroup } from '../../object-capability/content'
import type { DataCapabilityRuntime, PersistedOperationBinding, OperationEvent } from '../../data-capability/types'
import type { ObjectMemberState } from '../../object-capability/useObjectCapabilities'
import type { ObjectMember, ObjectMemberPresentation, ObjectMemberSelection, ObjectReference } from '../../object-capability/types'

export interface ObjectContentEntry {
  selection: ObjectMemberSelection
  member?: ObjectMember
  presentation?: ObjectMemberPresentation
  state: ObjectMemberState
  related?: boolean
}
const props = defineProps<{ title?: string; entries: ObjectContentEntry[]; preview?: boolean; appearance?: 'card' | 'section' | 'embedded'; collapsible?: boolean; position?: ObjectReadingPosition; runtime: () => DataCapabilityRuntime | undefined }>()
const emit = defineEmits<{ retry: []; add: []; open: [object: ObjectReference]; operation: [event: OperationEvent]; 'content-height': [height: number]; position: [position: ObjectReadingPosition] }>()
const body = ref<HTMLElement>()
// Natural content excludes the assigned card height, avoiding a resize feedback loop.
useResizeObserver(body, ([entry]) => { if (entry && (props.collapsible || props.appearance !== 'section')) emit('content-height', entry.contentRect.height + (props.collapsible ? 2 : 34)) })
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const active = ref<string>()
const selectedData = ref<ObjectContentEntry>()
const search = ref('')
const expanded = ref(false)
const references = computed(() => props.entries.filter(entry => objectMemberContentGroup(entry.member) === 'references'))
let beforeSearch: ObjectReadingPosition | undefined
const renderFailed = ref(false)
const viewport = ref<HTMLElement>()
const tail = ref<HTMLElement>()
const READING_BATCH_SIZE = 20
const visibleCount = ref(Math.max(READING_BATCH_SIZE, props.position?.visible || READING_BATCH_SIZE))
let desiredPosition = props.position, restoring = !!desiredPosition, scrolled = false
async function restorePosition() {
  const element = viewport.value
  if (!restoring || !element || props.entries.some(entry => entry.state.status === 'loading')) return
  visibleCount.value = Math.max(READING_BATCH_SIZE, desiredPosition?.visible || READING_BATCH_SIZE)
  await nextTick()
  if (!element.clientHeight) return
  element.scrollTop = desiredPosition?.top || 0
  await nextTick()
  restoring = false
}
const filtered = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  const entries = props.collapsible && !expanded.value ? [] : props.entries
  return keyword ? entries.filter(entry => [entry.presentation?.label?.(), entry.member?.name, entry.member?.sourceName,
    (entry.member?.metadata as import('../../object-capability/types').ObjectPropertyMetadata)?.valueType?.unit]
    .some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(keyword))) : entries
})
const displayed = computed(() => props.appearance === 'section' ? filtered.value.slice(0, visibleCount.value) : filtered.value)
const hasMore = computed(() => displayed.value.length < filtered.value.length)
watch(search, (value, previous) => {
  if (!previous.trim()) beforeSearch = { top: viewport.value?.scrollTop || 0, visible: visibleCount.value }
  visibleCount.value = READING_BATCH_SIZE
  if (!value.trim() && beforeSearch) { desiredPosition = beforeSearch; restoring = true; void restorePosition() }
  else void nextTick(() => { if (viewport.value) viewport.value.scrollTop = 0 })
})
useIntersectionObserver(tail, ([entry]) => {
  if (entry?.isIntersecting && hasMore.value) visibleCount.value += READING_BATCH_SIZE
}, { root: viewport, rootMargin: '0px 0px 120px 0px' })
onErrorCaptured(() => { renderFailed.value = true; return false })
watch(() => props.entries.map(entry => selectionKey(entry.selection)).sort().join('|'), () => {
  renderFailed.value = false
  visibleCount.value = Math.max(READING_BATCH_SIZE, props.position?.visible || READING_BATCH_SIZE)
  if (!restoring) void nextTick(() => { if (viewport.value) viewport.value.scrollTop = props.position?.top || 0 })
})
watch(() => props.position, value => {
  if (!scrolled && value) { desiredPosition = value; restoring = true; void restorePosition() }
})
watch([viewport, () => props.entries.some(entry => entry.state.status === 'loading'), () => props.preview], restorePosition, { flush: 'post' })
watch(visibleCount, () => { void nextTick(rememberPosition) })
function rememberPosition() {
  if (!search.value.trim() && !restoring && viewport.value?.clientHeight) {
    scrolled = true
    emit('position', { top: viewport.value.scrollTop, visible: visibleCount.value })
  }
}
const activeEntry = computed(() => active.value ? props.entries.find(entry => selectionKey(entry.selection) === active.value) : undefined)
watch(() => props.preview, preview => { if (preview) { active.value = undefined; selectedData.value = undefined } })
const multipleSources = computed(() => new Set(props.entries.map(entry => entry.member?.ref.providerId).filter(Boolean)).size > 1)
const ambiguousNames = computed(() => {
  const names = new Map<string, number>()
  for (const entry of props.entries) {
    const name = entry.member?.name || entry.selection.member.id
    names.set(name, (names.get(name) || 0) + 1)
  }
  return new Set([...names].filter(([, count]) => count > 1).map(([name]) => name))
})
const showSource = (entry: ObjectContentEntry) => multipleSources.value && ambiguousNames.value.has(entry.member?.name || entry.selection.member.id)
const observations = computed(() => props.appearance === 'section' && props.entries.length > 0 && props.entries.every(entry => objectMemberContentGroup(entry.member) === 'observations'))
const sourceNames = computed(() => [...new Set(props.entries.map(entry => entry.member?.sourceName).filter(Boolean))].join(' / '))
const rowKey = (entry: ObjectContentEntry) => selectionKey(entry.selection)
const entryLabel = (entry: ObjectContentEntry) => entry.presentation?.label?.() || entry.member?.name || entry.selection.member.id
</script>
<template>
  <section class="object-content-group" :class="{ 'object-content-group--section': appearance === 'section', 'object-content-group--embedded': appearance === 'embedded', 'object-content-group--observations': observations, 'object-content-group--collapsible': collapsible, 'is-expanded': expanded }">
    <div ref="body" class="object-content-group__body">
    <header v-if="appearance !== 'embedded'">
      <strong>{{ title }}</strong>
      <div v-if="collapsible && !expanded && references.length" class="object-content-group__summary">
        <span v-for="entry in references" :key="selectionKey(entry.selection)">
          <span class="object-content-group__summary-label">{{ entryLabel(entry) }}</span>
          <ObjectContentValue :entry="entry" :preview="preview" compact @retry="$emit('retry')" @open="$emit('open', $event)" />
        </span>
      </div>
      <a-input-search v-if="observations" v-model:value="search" allow-clear size="small" class="object-content-group__search" :placeholder="t('searchReadings')" :aria-label="t('searchReadings')" />
      <a-button v-if="collapsible" type="text" size="small" :aria-expanded="expanded" @click="expanded = !expanded">{{ t(expanded ? 'collapseDetails' : 'expandDetails') }}<DownOutlined :rotate="expanded ? 180 : 0" /></a-button>
      <slot name="actions" />
    </header>
    <a-alert v-if="renderFailed" type="warning" :message="t('unavailable')"><template #action><a-button @click="renderFailed = false">{{ t('retry') }}</a-button></template></a-alert>
    <a-empty v-else-if="!entries.length" :description="t('empty')" :image="undefined"><a-button v-if="preview" type="link" @click="$emit('add')">{{ t('add') }}</a-button></a-empty>
    <div v-else-if="displayed.length || !collapsible" ref="viewport" class="object-content-group__viewport" @scroll="rememberPosition" :role="appearance === 'section' ? 'region' : undefined" :tabindex="appearance === 'section' ? 0 : undefined" :aria-label="title">
    <a-empty v-if="search.trim() && !filtered.length" :description="t('noMatches')" />
    <template v-else>
    <a-list v-if="observations" :data-source="displayed" :row-key="rowKey" size="small" :aria-label="title">
      <template #renderItem="{ item: entry, index }">
        <a-list-item>
          <a-list-item-meta>
            <template #title><div class="object-content-group__observation-name"><span>{{ entryLabel(entry) }}</span><a-tooltip v-if="entry.member" :title="entry.member.description || t('source', { name: entry.member.sourceName })"><InfoCircleOutlined /></a-tooltip></div></template>
            <template v-if="showSource(entry)" #description><small class="object-content-group__source">{{ entry.member?.sourceName }}</small></template>
          </a-list-item-meta>
          <template #extra><div class="object-content-group__reading-tools"><ObjectContentValue class="object-content-group__reading-value" :entry="displayed[index]" :preview="preview" compact @action="active = selectionKey(entry.selection)" @retry="$emit('retry')" @open="$emit('open', $event)" /><a-tooltip :title="t('historyAndStats')"><a-button v-if="objectDataAccess(entry.member)" type="text" size="small" :disabled="preview" :aria-label="t('inspectReading', { name: entry.member?.name })" @click="selectedData = entry"><HistoryOutlined /></a-button></a-tooltip></div></template>
        </a-list-item>
      </template>
    </a-list>
    <div v-else class="object-content-group__items">
      <article v-for="entry in displayed" :key="selectionKey(entry.selection)" class="object-content-group__item">
        <div class="object-content-group__label">
          <span>{{ entryLabel(entry) }}</span>
          <a-tooltip v-if="entry.member" :title="entry.member.description || t('source', { name: entry.member.sourceName })"><InfoCircleOutlined /></a-tooltip>
        </div>
        <ObjectContentValue :entry="entry" :preview="preview" :compact="appearance === 'section' || objectMemberContentGroup(entry.member) !== 'observations'" @action="active = selectionKey(entry.selection)" @retry="$emit('retry')" @open="$emit('open', $event)" />
        <a-button v-if="objectDataAccess(entry.member)" type="link" size="small" :disabled="preview" :aria-label="t('inspectReading', { name: entry.member?.name })" @click="selectedData = entry">{{ t('historyAndStats') }}</a-button>
        <small v-if="appearance === 'section' && showSource(entry)" class="object-content-group__source">{{ entry.member?.sourceName }}</small>
      </article>
    </div>
    </template>
    <div v-if="hasMore" ref="tail" class="object-content-group__tail" role="status">{{ t('loading') }}</div>
    </div>
    <p v-if="observations || (appearance === 'section' && multipleSources && (!collapsible || expanded))" class="object-content-group__evidence"><span v-if="sourceNames">{{ t('source', { name: sourceNames }) }}</span><span v-if="observations">{{ t('timeUnavailable') }}</span></p>
    <slot name="footer" />
    <a-modal :open="Boolean(activeEntry) && !preview && !renderFailed" :title="activeEntry?.member?.name" :footer="null" destroy-on-close @cancel="active = undefined">
      <component v-if="activeEntry?.member" :is="activeEntry.presentation?.editor || ObjectOperationPanel" :member="activeEntry.member" :binding="activeEntry.selection.binding as PersistedOperationBinding" :runtime="runtime" @operation="emit('operation', $event)" />
    </a-modal>
    <ObjectDataExplorer :entry="selectedData" :runtime="runtime" @close="selectedData = undefined" />
    </div>
  </section>
</template>
<style scoped>
.object-content-group { box-sizing: border-box; height: 100%; overflow: auto; padding: 16px; border: 1px solid var(--ant-color-border-secondary, var(--line)); border-radius: 8px; background: var(--bg-trans-8, var(--ant-color-bg-container, var(--bg))); }
.object-content-group__body > header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.object-content-group__items { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 16px; }
.object-content-group__label { display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px; color: var(--ant-color-text-secondary, var(--ink-2)); font-size: 12px; overflow-wrap: anywhere; }
.object-content-group__label .anticon { color: var(--ant-color-text-tertiary, inherit); }
.object-content-group__item,.object-content-group__value { min-width: 0; }
.object-content-group__source { display: flex; grid-column: 1 / -1; flex-wrap: wrap; gap: 4px 12px; font-size: var(--ant-font-size-sm, 12px); color: var(--ant-color-text-secondary, var(--ink-2)); }
.object-content-group--section { min-height: 0; overflow: hidden; padding: 0; }
.object-content-group--section .object-content-group__body { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.object-content-group--section .object-content-group__body > header { flex: none; padding: 12px 16px; margin: 0; border-bottom: 1px solid var(--line); font-size: 14px; }
.object-content-group--section .object-content-group__viewport { flex: 1; min-height: 0; padding: 12px 16px; overflow: auto; overflow-anchor: none; overscroll-behavior: contain; scrollbar-gutter: stable; }
.object-content-group--section .object-content-group__evidence { flex: none; margin: 0; padding: 8px 16px; border-top: 1px solid var(--line); }
.object-content-group__viewport:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.object-content-group__tail { padding: 12px 0; color: var(--ink-2); font-size: var(--ant-font-size-sm, 12px); }
.object-content-group--section .object-content-group__items { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr)); gap: 18px 20px; }
.object-content-group--section .object-content-group__item { display: flex; flex-direction: column; gap: 4px; }
.object-content-group--section .object-content-group__label { margin-bottom: 0; align-items: baseline; font-size: var(--ant-font-size-sm, 12px); }
.object-content-group--observations { --object-value-font-size: inherit; }
.object-content-group--observations .object-content-group__viewport { padding: 0; }
.object-content-group__observation-name { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
.object-content-group__reading-value { max-width: 45%; margin-inline-start: var(--space-4, 16px); text-align: end; }
.object-content-group__reading-tools { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:4px; min-width:0; max-width:50%; }
.object-content-group__reading-tools .object-content-group__reading-value { max-width:100%; margin-inline-start:0; }
.object-content-group__search { width:180px; max-width:100%; }
.object-content-group__evidence { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 10px 0 0; color: var(--ant-color-text-secondary, var(--ink-2)); font-size: var(--ant-font-size-sm, 12px); }
.object-content-group--observations :deep(.ant-list-items) { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); }
.object-content-group--observations :deep(.ant-list-item) { min-width: 0; padding: 10px 16px; gap: 12px; border-bottom: 1px solid var(--line); }
.object-content-group--observations :deep(.ant-list-item-meta) { min-width: 0; margin: 0; }
.object-content-group--observations :deep(.ant-list-item-meta-title) { margin: 0; font-size: inherit; font-weight: 400; color: inherit; }
.object-content-group--observations :deep(.ant-list-item-extra) { flex: none; max-width: 55%; margin-inline-start: 0; }
.object-content-group__reading-tools { max-width: 100%; flex-wrap: nowrap; }
.object-content-group--collapsible .object-content-group__body { height: auto; }
.object-content-group--collapsible { overflow: auto; }
.object-content-group--collapsible .object-content-group__viewport { flex: none; max-height: 20rem; }
.object-content-group--collapsible .object-content-group__items { grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); }
.object-content-group--collapsible:not(.is-expanded) .object-content-group__body > header { border-bottom: 0; }
.object-content-group--embedded { height: auto; overflow: visible; border: 0; border-radius: 0; background: transparent; padding: 12px 16px; }
.object-content-group__summary { display: flex; flex: 1; flex-wrap: wrap; gap: 8px 16px; min-width: 0; }
.object-content-group__summary > span { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; }
.object-content-group__summary-label { color: var(--ink-2); font-size: var(--ant-font-size-sm, 12px); }
</style>
