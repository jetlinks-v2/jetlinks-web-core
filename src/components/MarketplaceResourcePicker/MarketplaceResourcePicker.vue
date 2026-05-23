<template>
  <div
    class="mp-res-layout"
    :class="{ 'mp-res-layout--fixed': !!panelHeight }"
    :style="panelHeight ? { height: panelHeight } : undefined"
  >
    <div
      v-if="showTypeTabs"
      class="mp-res-layout__types"
    >
      <a-tabs
        v-model:activeKey="activeType"
        type="line"
        class="mp-res-layout__tabs"
      >
        <a-tab-pane
          v-for="ty in typeOptions"
          :key="ty.value"
          :tab="ty.label"
        />
      </a-tabs>
    </div>

    <div
      v-if="!typeOptions.length"
      class="mp-res-layout__empty"
    >
      <CloudEmpty :description="mergedLabels.noResourceTypes" />
    </div>

    <div
      v-else
      class="mp-res-layout__body"
    >
      <aside class="mp-res-layout__aside">
        <div class="mp-res-layout__aside-title">{{ mergedLabels.tags }}</div>
        <a-spin :spinning="tagsLoading">
          <div class="mp-res-layout__tag-list">
            <button
              type="button"
              class="mp-res-layout__tag"
              :class="{ 'mp-res-layout__tag--active': !selectedTagIds.length }"
              @click="clearTagFilter"
            >
              {{ mergedLabels.all }}
            </button>
            <template
              v-for="section in sidebarSections"
              :key="section.id"
            >
              <div
                v-if="isSectionVisible(section)"
                class="mp-res-layout__sidebar-section"
              >
                <button
                  type="button"
                  class="mp-res-layout__sidebar-classifier"
                  :class="{ 'mp-res-layout__sidebar-classifier--active': sectionSelectedCount(section) > 0 }"
                  :style="{ paddingLeft: `${10 + section.depth * 12}px` }"
                  @click="toggleClassifier(section.id)"
                >
                  <span class="mp-res-layout__sidebar-classifier-name">{{ section.name }}</span>
                  <span class="mp-res-layout__sidebar-classifier-meta">
                    <span
                      v-if="sectionSelectedCount(section) > 0"
                      class="mp-res-layout__sidebar-classifier-picked"
                    >
                      {{ sectionSelectedCount(section) }}
                    </span>
                    <span
                      v-if="section.tags.length"
                      class="mp-res-layout__sidebar-classifier-count"
                    >
                      {{ section.tags.length }}
                    </span>
                    <AIcon
                      type="DownOutlined"
                      class="mp-res-layout__sidebar-classifier-caret"
                      :class="{ 'mp-res-layout__sidebar-classifier-caret--open': isClassifierExpanded(section.id) }"
                    />
                  </span>
                </button>
                <div
                  v-if="isClassifierExpanded(section.id) && section.tags.length"
                  class="mp-res-layout__tag-row"
                  :style="{ paddingLeft: `${10 + section.depth * 12}px` }"
                >
                  <TagFilterChip
                    v-for="tg in section.tags"
                    :key="tg.id"
                    :tag="tg"
                    :selected="isTagSelected(tg.id)"
                    @toggle="toggleTag(tg.id)"
                  />
                </div>
              </div>
            </template>
          </div>
        </a-spin>
      </aside>

      <div class="mp-res-layout__main">
        <div class="mp-res-layout__toolbar">
          <a-input-search
            v-model:value="keyword"
            allow-clear
            class="mp-res-layout__search"
            :placeholder="mergedLabels.searchPlaceholder"
            @search="onSearch"
            @pressEnter="onSearch"
          />
          <slot
            name="toolbar-extra"
            :active-type="activeType"
            :keyword="keyword"
          />
        </div>

        <div
          v-if="selectedTagItems.length"
          class="mp-res-layout__selected"
        >
          <span class="mp-res-layout__selected-title">{{ mergedLabels.selectedTags }}</span>
          <div class="mp-res-layout__selected-list">
            <TagFilterChip
              v-for="tag in selectedTagItems"
              :key="tag.id"
              :tag="tag"
              :selected="true"
              @toggle="toggleTag(tag.id)"
            />
          </div>
          <button
            type="button"
            class="mp-res-layout__selected-clear"
            @click="clearTagFilter"
          >
            {{ mergedLabels.clearSelected }}
          </button>
        </div>

        <div
          class="mp-res-layout__list-scroll"
          @scroll.passive="onListScroll"
        >
          <a-spin :spinning="listLoading">
            <CloudEmpty
              v-if="!records.length && !listLoading"
              :description="mergedLabels.empty"
            />
            <template v-else>
              <div class="mp-res-layout__grid">
                <template
                  v-for="row in records"
                  :key="row.id"
                >
                  <slot
                    name="card"
                    :record="row"
                    :selected="isRecordSelected(row)"
                    :selectable="selectionMode !== 'none'"
                    :on-select="() => onCardClick(row)"
                    :show-version-select="showVersionRow(row)"
                    :version="selectedVersion"
                    :version-options="versionOptions"
                    :versions-loading="versionsLoading"
                    :version-label="mergedLabels.version"
                    :version-placeholder="mergedLabels.versionPlaceholder"
                    :view-release-notes="mergedLabels.viewReleaseNotes"
                    :release-notes-title="mergedLabels.releaseNotesTitle"
                    :view-document="mergedLabels.viewDocument"
                    :resource-document-title="mergedLabels.resourceDocumentTitle"
                    :version-summary-label="mergedLabels.versionSummary"
                    :on-version-change="emitVersion"
                  >
                    <PickerResourceCard
                      :record="row"
                      :selectable="selectionMode !== 'none'"
                      :selected="isRecordSelected(row)"
                      :enabled-label="enabledLabel"
                      :disabled-label="disabledLabel"
                      :show-version-select="showVersionRow(row)"
                      :version="selectedVersion"
                      :version-options="versionOptions"
                      :versions-loading="versionsLoading"
                      :version-label="mergedLabels.version"
                      :version-placeholder="mergedLabels.versionPlaceholder"
                      :view-release-notes="mergedLabels.viewReleaseNotes"
                      :release-notes-title="mergedLabels.releaseNotesTitle"
                      :view-document="mergedLabels.viewDocument"
                      :resource-document-title="mergedLabels.resourceDocumentTitle"
                      :version-summary-label="mergedLabels.versionSummary"
                      @update:version="emitVersion"
                      @click="onCardClick(row)"
                    />
                  </slot>
                </template>
              </div>
              <div
                v-if="loadingMore"
                class="mp-res-layout__load-hint"
              >
                <a-spin size="small" />
              </div>
              <div
                v-else-if="!showPagination && !hasMore && records.length > 0"
                class="mp-res-layout__list-end"
              >
                {{ mergedLabels.noMore }}
              </div>
            </template>
          </a-spin>
        </div>

        <div
          v-if="showPagination && total > pageSize"
          class="mp-res-layout__pager"
        >
          <a-pagination
            v-model:current="pageIndex"
            :total="total"
            :page-size="pageSize"
            show-size-changer
            :page-size-options="pageSizeOptions"
            @change="fetchPage"
            @showSizeChange="onPageSizeChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import TagFilterChip from './TagFilterChip.vue'
import PickerResourceCard from './PickerResourceCard.vue'
import {
  defaultFetchCapabilityVersions,
  defaultFetchResources,
  defaultFetchTagClassifiers,
  pickLatestCapabilityVersion
} from './defaultMarketplaceClient'
import { buildSidebarSections, normalizeTagClassifiersResponse, type SidebarSection, type TagChipItem } from './sidebar'
import type {
  CapabilityVersionOption,
  FetchCapabilityVersions,
  MarketplaceResourceFetcher,
  MarketplaceResourcePickerLabels,
  ResourceTypeOption,
  SelectionMode,
  TagClassifiersFetcher
} from './types'

const props = withDefaults(
  defineProps<{
    /** 资源类型 Tab */
    typeOptions: ResourceTypeOption[]
    /** 是否展示顶部类型 Tab（单类型时可设 false 并配合 defaultType） */
    showTypeTabs?: boolean
    /** showTypeTabs 为 false 时使用的固定类型 */
    defaultType?: string
    /**
     * 不传则默认使用 MarketplaceClientController：
     * {@code GET /marketplace/tag-classifiers?type=}
     */
    fetchTagClassifiers?: TagClassifiersFetcher
    /**
     * 不传则默认使用 MarketplaceClientController：
     * {@code POST /marketplace/capabilities/_search}（NDJSON 流）
     */
    fetchResources?: MarketplaceResourceFetcher
    labels?: MarketplaceResourcePickerLabels
    /** 打开时预填的搜索关键字 */
    defaultKeyword?: string
    selectionMode?: SelectionMode
    modelValue?: string | string[] | null
    pageSize?: number
    pageSizeOptions?: string[]
    showPagination?: boolean
    /** 卡片内状态文案（可选，走 i18n 时由业务传入） */
    enabledLabel?: string
    disabledLabel?: string
    /** 选中卡片后在卡片下方展示版本选择（仅 selectionMode=single） */
    enableVersionSelect?: boolean
    /** 与 enableVersionSelect 配合：当前选中的版本号 */
    version?: string | null
    /** 不传则 GET /marketplace/capabilities/{id}/versions */
    fetchVersions?: FetchCapabilityVersions
    /**
     * 固定整体高度（如弹层内 `100%` 配合外层 height），内部列表区域可滚动并触发加载更多。
     * 不设则按内容撑开，列表区使用 max-height 限制并仍可滚动加载。
     */
    panelHeight?: string
  }>(),
  {
    showTypeTabs: true,
    defaultType: '',
    selectionMode: 'none',
    modelValue: undefined,
    defaultKeyword: '',
    pageSize: 12,
    pageSizeOptions: () => ['12', '24', '48'],
    showPagination: false,
    enableVersionSelect: false,
    version: undefined,
    panelHeight: undefined
  }
)

const { t: $t } = useI18n()

const emit = defineEmits<{
  'update:modelValue': [v: string | string[] | null | undefined]
  'update:version': [v: string | undefined]
  change: [record: any]
  'card-click': [record: any]
}>()

const defaultLabels = computed<Required<MarketplaceResourcePickerLabels>>(() => ({
  all: $t('components.MarketplaceResourcePicker.all'),
  tags: $t('components.MarketplaceResourcePicker.tags'),
  selectedTags: $t('components.MarketplaceResourcePicker.selectedTags'),
  clearSelected: $t('components.MarketplaceResourcePicker.clearSelected'),
  searchPlaceholder: $t('components.MarketplaceResourcePicker.searchPlaceholder'),
  empty: $t('components.MarketplaceResourcePicker.empty'),
  noMore: $t('components.MarketplaceResourcePicker.noMore'),
  noResourceTypes: $t('components.MarketplaceResourcePicker.noResourceTypes'),
  version: $t('components.MarketplaceResourcePicker.version'),
  versionPlaceholder: $t('components.MarketplaceResourcePicker.versionPlaceholder'),
  viewReleaseNotes: $t('components.MarketplaceResourcePicker.viewReleaseNotes'),
  releaseNotesTitle: $t('components.MarketplaceResourcePicker.releaseNotesTitle'),
  viewDocument: $t('components.MarketplaceResourcePicker.viewDocument'),
  resourceDocumentTitle: $t('components.MarketplaceResourcePicker.resourceDocumentTitle'),
  versionSummary: $t('components.MarketplaceResourcePicker.versionSummary')
}))

const mergedLabels = computed(() => ({ ...defaultLabels.value, ...props.labels }))

const activeType = ref('')
const selectedTagIds = ref<string[]>([])
const keyword = ref(typeof props.defaultKeyword === 'string' ? props.defaultKeyword.trim() : '')
/** 分页模式：与 a-pagination 同步，从 1 开始 */
const pageIndex = ref(1)
/** 滚动加载：请求下一页时使用的 0-based 页码 */
const pageIndexScroll = ref(0)
const pageSize = ref(props.pageSize)
const total = ref(0)
const records = ref<any[]>([])
const listLoading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
const tagsLoading = ref(false)
const sidebarSections = ref<SidebarSection[]>([])
const expandedClassifierIds = ref<string[]>([])

const versionOptions = ref<CapabilityVersionOption[]>([])
const versionsLoading = ref(false)
let listLoadSeq = 0
let tagLoadSeq = 0
let versionLoadSeq = 0

const selectedVersion = computed({
  get: () => (props.version == null || props.version === '' ? undefined : String(props.version)),
  set: (v: string | undefined) => emit('update:version', v)
})

function resolveFetchTagClassifiers(): TagClassifiersFetcher {
  return props.fetchTagClassifiers ?? defaultFetchTagClassifiers
}

function resolveFetchResources(): MarketplaceResourceFetcher {
  return props.fetchResources ?? defaultFetchResources
}

function buildResourceQuery(pageIndexValue: number) {
  return {
    type: activeType.value,
    pageIndex: pageIndexValue,
    pageSize: pageSize.value,
    keyword: keyword.value?.trim() ?? '',
    selectedTagIds: [...selectedTagIds.value]
  }
}

async function loadTagSidebar() {
  const ty = activeType.value
  const seq = ++tagLoadSeq
  if (!ty) {
    sidebarSections.value = []
    expandedClassifierIds.value = []
    tagsLoading.value = false
    return
  }
  tagsLoading.value = true
  try {
    const res: any = await resolveFetchTagClassifiers()(ty)
    if (seq !== tagLoadSeq || activeType.value !== ty) return
    const roots = normalizeTagClassifiersResponse(res)
    const sections = buildSidebarSections(roots)
    sidebarSections.value = sections
    expandedClassifierIds.value = defaultExpandedSections(sections)
  } finally {
    if (seq === tagLoadSeq) {
      tagsLoading.value = false
    }
  }
}

/** 底部分页：接口不返回 total，用本页条数推断（满页则假定可能还有下一页） */
async function fetchPage() {
  if (!activeType.value) {
    records.value = []
    total.value = 0
    return
  }

  const seq = ++listLoadSeq
  loadingMore.value = false
  listLoading.value = true

  try {
    const { list } = await resolveFetchResources()(buildResourceQuery(pageIndex.value - 1))
    if (seq !== listLoadSeq) return

    records.value = list
    const pi = pageIndex.value
    if (list.length < pageSize.value) {
      total.value = (pi - 1) * pageSize.value + list.length
    } else {
      total.value = pi * pageSize.value + 1
    }
  } catch {
    if (seq !== listLoadSeq) return
    records.value = []
    total.value = 0
  } finally {
    if (seq === listLoadSeq) {
      listLoading.value = false
    }
  }
}

/** 滚动加载：reset=true 重新拉第一页；分页模式请用 fetchPage */
async function fetchList(reset = true) {
  if (!activeType.value) {
    pageIndexScroll.value = 0
    records.value = []
    hasMore.value = false
    listLoading.value = false
    loadingMore.value = false
    return
  }
  if (props.showPagination) {
    await fetchPage()
    return
  }

  if (reset) {
    pageIndexScroll.value = 0
    records.value = []
    hasMore.value = true
    loadingMore.value = false
  } else if (!hasMore.value || loadingMore.value || listLoading.value) {
    return
  }

  const seq = ++listLoadSeq
  const pi = pageIndexScroll.value
  const initial = reset || records.value.length === 0
  if (initial) listLoading.value = true
  else loadingMore.value = true

  try {
    const { list } = await resolveFetchResources()(buildResourceQuery(pi))
    if (seq !== listLoadSeq) return

    if (reset) {
      records.value = list
    } else {
      records.value = [...records.value, ...list]
    }
    pageIndexScroll.value = pi + 1
    // 本页无数据，或条数不足一页 → 已是最后一页；满页则可能还有下一页（再请求为空则结束）
    hasMore.value = list.length > 0 && list.length >= pageSize.value
  } catch {
    if (seq !== listLoadSeq) return
    if (reset) {
      records.value = []
    }
    hasMore.value = false
  } finally {
    if (seq === listLoadSeq) {
      listLoading.value = false
      loadingMore.value = false
    }
  }
}

async function loadMore() {
  if (props.showPagination) return
  await fetchList(false)
}

let scrollGate = false
function onListScroll(e: Event) {
  if (props.showPagination) return
  const el = e.target as HTMLElement
  const threshold = 72
  if (el.scrollHeight - el.scrollTop - el.clientHeight > threshold) return
  if (scrollGate || listLoading.value || loadingMore.value || !hasMore.value) return
  scrollGate = true
  loadMore().finally(() => {
    requestAnimationFrame(() => {
      scrollGate = false
    })
  })
}

function isTagSelected(id: string) {
  return selectedTagIds.value.includes(id)
}

const selectedTagSet = computed(() => new Set(selectedTagIds.value))
const sectionParentMap = computed(() => {
  const map = new Map<string, string | undefined>()
  for (const section of sidebarSections.value) {
    map.set(section.id, section.parentId)
  }
  return map
})
const tagMap = computed(() => {
  const map = new Map<string, TagChipItem>()
  for (const section of sidebarSections.value) {
    for (const tag of section.tags) {
      if (!map.has(tag.id)) map.set(tag.id, tag)
    }
  }
  return map
})
const tagOwnerMap = computed(() => {
  const map = new Map<string, string>()
  for (const section of sidebarSections.value) {
    for (const tag of section.tags) {
      if (!map.has(tag.id)) map.set(tag.id, section.id)
    }
  }
  return map
})
const selectedTagItems = computed(() =>
  selectedTagIds.value.map((id) => tagMap.value.get(id)).filter((item): item is TagChipItem => !!item)
)

function defaultExpandedSections(sections: SidebarSection[]) {
  return sections.filter((section) => section.depth === 0).map((section) => section.id)
}

function isClassifierExpanded(id: string) {
  return expandedClassifierIds.value.includes(id)
}

function toggleClassifier(id: string) {
  const next = [...expandedClassifierIds.value]
  const index = next.indexOf(id)
  if (index >= 0) next.splice(index, 1)
  else next.push(id)
  expandedClassifierIds.value = next
}

function ensureClassifierExpanded(id: string) {
  const next = new Set(expandedClassifierIds.value)
  let current: string | undefined = id
  while (current) {
    next.add(current)
    current = sectionParentMap.value.get(current)
  }
  expandedClassifierIds.value = [...next]
}

function isSectionVisible(section: SidebarSection) {
  let parentId = section.parentId
  while (parentId) {
    if (!expandedClassifierIds.value.includes(parentId)) return false
    parentId = sectionParentMap.value.get(parentId)
  }
  return true
}

function sectionSelectedCount(section: SidebarSection) {
  let count = 0
  for (const tag of section.tags) {
    if (selectedTagSet.value.has(tag.id)) count += 1
  }
  return count
}

function toggleTag(id: string) {
  const next = [...selectedTagIds.value]
  const i = next.indexOf(id)
  if (i >= 0) next.splice(i, 1)
  else {
    next.push(id)
    const owner = tagOwnerMap.value.get(id)
    if (owner) ensureClassifierExpanded(owner)
  }
  selectedTagIds.value = next
  pageIndex.value = 1
  if (props.showPagination) fetchPage()
  else fetchList(true)
}

function clearTagFilter() {
  selectedTagIds.value = []
  pageIndex.value = 1
  if (props.showPagination) fetchPage()
  else fetchList(true)
}

function onSearch() {
  pageIndex.value = 1
  if (props.showPagination) fetchPage()
  else fetchList(true)
}

function onPageSizeChange(_: number, size: number) {
  pageSize.value = size
  pageIndex.value = 1
  if (props.showPagination) fetchPage()
  else fetchList(true)
}

function selectedIdsNormalized(): string[] {
  if (props.selectionMode === 'single' && props.modelValue != null && props.modelValue !== '') {
    return [String(props.modelValue)]
  }
  if (props.selectionMode === 'multiple' && Array.isArray(props.modelValue)) {
    return [...props.modelValue]
  }
  return []
}

function isRecordSelected(row: any): boolean {
  const id = row?.id
  if (id == null) return false
  return selectedIdsNormalized().includes(String(id))
}

function showVersionRow(row: any) {
  return props.enableVersionSelect && props.selectionMode === 'single' && isRecordSelected(row)
}

function emitVersion(v: string | undefined) {
  emit('update:version', v)
}

async function loadVersionsForCapability(capabilityId: string) {
  const seq = ++versionLoadSeq
  versionsLoading.value = true
  try {
    const fetcher = props.fetchVersions ?? defaultFetchCapabilityVersions
    const opts = await fetcher(capabilityId)
    if (seq !== versionLoadSeq) return
    versionOptions.value = Array.isArray(opts) ? opts : []
    const values = versionOptions.value.map((o) => o.value)
    const latest = pickLatestCapabilityVersion(values)
    emit('update:version', latest)
  } catch {
    if (seq !== versionLoadSeq) return
    versionOptions.value = []
    emit('update:version', undefined)
  } finally {
    if (seq === versionLoadSeq) versionsLoading.value = false
  }
}

function onCardClick(record: any) {
  if (props.selectionMode === 'none') {
    emit('card-click', record)
    return
  }
  const id = record?.id
  if (id == null) return
  if (props.selectionMode === 'single') {
    emit('update:modelValue', id)
    emit('change', record)
    return
  }
  const cur = new Set(selectedIdsNormalized())
  if (cur.has(String(id))) cur.delete(String(id))
  else cur.add(String(id))
  emit('update:modelValue', [...cur])
  emit('change', record)
}

watch(
  () => [props.typeOptions, props.showTypeTabs, props.defaultType] as const,
  () => {
    if (!props.showTypeTabs && props.defaultType) {
      activeType.value = props.defaultType
      return
    }
    const tabs = props.typeOptions
    if (!tabs?.length) {
      activeType.value = ''
      return
    }
    if (!tabs.some((x) => x.value === activeType.value)) {
      activeType.value = tabs[0].value
    }
  },
  { immediate: true, deep: true }
)

watch(
  () => props.defaultKeyword,
  (value) => {
    const next = typeof value === 'string' ? value.trim() : ''
    if (keyword.value === next) return
    keyword.value = next
    pageIndex.value = 1
    if (activeType.value) {
      if (props.showPagination) fetchPage()
      else fetchList(true)
    }
  },
  { immediate: true }
)

watch(
  activeType,
  async (ty, oldTy) => {
    if (!ty) {
      listLoadSeq += 1
      tagLoadSeq += 1
      versionLoadSeq += 1
      pageIndexScroll.value = 0
      sidebarSections.value = []
      expandedClassifierIds.value = []
      records.value = []
      total.value = 0
      hasMore.value = false
      versionOptions.value = []
      tagsLoading.value = false
      listLoading.value = false
      loadingMore.value = false
      versionsLoading.value = false
      return
    }
    if (oldTy !== undefined && oldTy !== '' && ty !== oldTy) {
      selectedTagIds.value = []
      keyword.value = ''
      pageIndex.value = 1
    }
    await loadTagSidebar()
    if (ty !== activeType.value) return
    if (props.showPagination) await fetchPage()
    else await fetchList(true)
  },
  { immediate: true }
)

watch(
  () => props.pageSize,
  (v) => {
    if (v != null && v > 0) pageSize.value = v
  }
)

watch(
  () => [props.modelValue, props.enableVersionSelect, props.selectionMode] as const,
  async () => {
    if (!props.enableVersionSelect || props.selectionMode !== 'single') {
      versionOptions.value = []
      return
    }
    const id = selectedIdsNormalized()[0]
    if (!id) {
      versionOptions.value = []
      emit('update:version', undefined)
      return
    }
    await loadVersionsForCapability(id)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  listLoadSeq += 1
  tagLoadSeq += 1
  versionLoadSeq += 1
})

defineExpose({
  refresh: () => (props.showPagination ? fetchPage() : fetchList(true))
})
</script>

<style scoped>
.mp-res-layout {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
  height: 100%;
}
.mp-res-layout__types {
  flex-shrink: 0;
  margin-bottom: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--ink-1) 6%, transparent);
}
.mp-res-layout__tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}
.mp-res-layout__empty {
  padding: 3rem 0;
}
.mp-res-layout__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-4);
  min-height: 0;
  align-items: stretch;
  flex: 1;
  overflow-y: auto;
}
@media (min-width: 62rem) {
  .mp-res-layout__body {
    flex-direction: row;
    align-items: stretch;
  }
}
.mp-res-layout__aside {
  width: 100%;
  flex-shrink: 0;
  padding: 0.625rem;
  background: transparent;
  align-self: stretch;
}
@media (min-width: 62rem) {
  .mp-res-layout__aside {
    width: clamp(13rem, 18vw, 14.5rem);
    align-self: stretch;
  }
}
.mp-res-layout__aside-title {
  font-size: var(--fs-12);
  font-weight: 600;
  color: var(--ink-4);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: 0.625rem;
}
.mp-res-layout__tag-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.mp-res-layout__sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.mp-res-layout__sidebar-classifier {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--r-3);
  background: transparent;
  padding: 0.5rem 0.625rem;
  font-size: var(--fs-12);
  font-weight: 600;
  color: var(--ink-4);
  line-height: 1.35;
  user-select: none;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.mp-res-layout__sidebar-classifier:hover {
  border-color: color-mix(in srgb, var(--accent) 18%, transparent);
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}
.mp-res-layout__sidebar-classifier--active {
  color: var(--jet-theme-primary-active);
}
.mp-res-layout__sidebar-classifier-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.mp-res-layout__sidebar-classifier-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}
.mp-res-layout__sidebar-classifier-count,
.mp-res-layout__sidebar-classifier-picked {
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.3125rem;
  border-radius: 62.4375rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-12);
  line-height: 1;
}
.mp-res-layout__sidebar-classifier-count {
  background: color-mix(in srgb, var(--ink-2) 6%, transparent);
  color: var(--ink-4);
}
.mp-res-layout__sidebar-classifier-picked {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--jet-theme-primary-active);
}
.mp-res-layout__sidebar-classifier-caret {
  transition: transform 0.15s ease;
}
.mp-res-layout__sidebar-classifier-caret--open {
  transform: rotate(180deg);
}
.mp-res-layout__tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  align-items: center;
}
.mp-res-layout__tag {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.625rem;
  border: 1px solid transparent;
  border-radius: var(--r-2);
  background: var(--bg);
  font-size: var(--fs-14);
  color: var(--ink-2);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}
.mp-res-layout__tag:hover {
  border-color: color-mix(in srgb, var(--accent) 25%, transparent);
  color: var(--accent);
  box-shadow: var(--shadow-1);
  transform: translateY(-0.0625rem);
}
.mp-res-layout__tag--active {
  border-color: var(--jet-theme-primary-active);
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, transparent), color-mix(in srgb, var(--accent) 4%, transparent));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--bg) 96%, transparent) inset, 0 0 0 0.1875rem color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--jet-theme-primary-active);
  font-weight: 500;
}
.mp-res-layout__main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  background: var(--bg);
  border-radius: 0.75rem;
  padding: var(--space-4);
  box-shadow: var(--shadow-1);
}
.mp-res-layout--fixed {
  min-height: 0;
}
.mp-res-layout--fixed .mp-res-layout__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  align-items: stretch;
}
.mp-res-layout--fixed .mp-res-layout__aside {
  align-self: stretch;
  max-height: none;
  height: auto;
}
.mp-res-layout--fixed .mp-res-layout__main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--bg);
  border-radius: 0.75rem;
  padding: var(--space-4);
  box-shadow: var(--shadow-1);
}
.mp-res-layout__list-scroll {
  flex: 1;
  min-height: 0;
}
.mp-res-layout--fixed .mp-res-layout__list-scroll {
  max-height: none;
}
.mp-res-layout__load-hint {
  display: flex;
  justify-content: center;
  padding: 0.75rem 0 0.25rem;
}
.mp-res-layout__list-end {
  text-align: center;
  font-size: var(--fs-12);
  color: var(--ink-4);
  padding: 0.25rem 0 0.5rem;
}
.mp-res-layout__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.mp-res-layout__selected {
  margin-top: -0.25rem;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding: var(--space-2) var(--space-3);
  border: 1px solid color-mix(in srgb, var(--accent) 12%, transparent);
  border-radius: 0.75rem;
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 5%, transparent), color-mix(in srgb, var(--accent) 2%, transparent));
}
.mp-res-layout__selected-title {
  font-size: var(--fs-12);
  font-weight: 600;
  color: var(--jet-theme-primary-active);
  flex-shrink: 0;
}
.mp-res-layout__selected-clear {
  border: none;
  background: transparent;
  padding: 0;
  font-size: var(--fs-12);
  color: var(--ink-4);
  cursor: pointer;
  margin-left: auto;
  flex-shrink: 0;
}
.mp-res-layout__selected-clear:hover {
  color: var(--accent);
}
.mp-res-layout__selected-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}
.mp-res-layout__search {
  flex: 1;
  min-width: 12.5rem;
  max-width: 25rem;
}
.mp-res-layout__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: var(--space-3);
  width: 100%;
  align-items: stretch;
  padding-top: var(--space-1);
  padding-bottom: 0.125rem;
  box-sizing: border-box;
}
.mp-res-layout__pager {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-2);
  flex-shrink: 0;
}</style>
