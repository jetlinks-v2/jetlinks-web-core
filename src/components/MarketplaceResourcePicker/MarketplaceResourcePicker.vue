<template>
  <div
    class="mp-res-layout"
    :class="{ 'mp-res-layout--fixed': !!panelHeight }"
    :style="panelHeight ? { height: panelHeight } : undefined"
  >
    <div v-if="showTypeTabs" class="mp-res-layout__types">
      <a-tabs v-model:activeKey="activeType" type="line" class="mp-res-layout__tabs">
        <a-tab-pane v-for="ty in typeOptions" :key="ty.value" :tab="ty.label" />
      </a-tabs>
    </div>

    <div v-if="!typeOptions.length" class="mp-res-layout__empty">
      <a-empty :description="mergedLabels.noResourceTypes" />
    </div>

    <div v-else class="mp-res-layout__body">
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
            <template v-for="(block, bIdx) in sidebarBlocks" :key="`sb-${bIdx}`">
              <div
                v-if="block.kind === 'classifier'"
                class="mp-res-layout__sidebar-classifier"
                :style="{ paddingLeft: `${10 + block.depth * 14}px` }"
              >
                {{ block.name }}
              </div>
              <div
                v-else
                class="mp-res-layout__tag-row"
                :style="{ paddingLeft: `${10 + block.depth * 14}px` }"
              >
                <TagFilterChip
                  v-for="tg in block.tags"
                  :key="tg.id"
                  :tag="tg"
                  :selected="isTagSelected(tg.id)"
                  @toggle="toggleTag(tg.id)"
                />
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
          <slot name="toolbar-extra" :active-type="activeType" :keyword="keyword" />
        </div>

        <div class="mp-res-layout__list-scroll" @scroll.passive="onListScroll">
          <a-spin :spinning="listLoading">
            <a-empty v-if="!records.length && !listLoading" :description="mergedLabels.empty" />
            <template v-else>
              <div class="mp-res-layout__grid">
                <template v-for="row in records" :key="row.id">
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
                      @update:version="emitVersion"
                      @click="onCardClick(row)"
                    />
                  </slot>
                </template>
              </div>
              <div v-if="loadingMore" class="mp-res-layout__load-hint">
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

        <div v-if="showPagination && total > pageSize" class="mp-res-layout__pager">
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
import { computed, ref, watch } from 'vue'
import TagFilterChip from './TagFilterChip.vue'
import PickerResourceCard from './PickerResourceCard.vue'
import {
  defaultFetchCapabilityVersions,
  defaultFetchResources,
  defaultFetchTagClassifiers,
  pickLatestCapabilityVersion,
} from './defaultMarketplaceClient'
import { buildSidebarBlocks, normalizeTagClassifiersResponse } from './sidebar'
import type {
  CapabilityVersionOption,
  FetchCapabilityVersions,
  MarketplaceResourceFetcher,
  MarketplaceResourcePickerLabels,
  ResourceTypeOption,
  SelectionMode,
  TagClassifiersFetcher,
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
     * {@code POST /marketplace/capabilities/_search}
     */
    fetchResources?: MarketplaceResourceFetcher
    labels?: MarketplaceResourcePickerLabels
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
    pageSize: 12,
    pageSizeOptions: () => ['12', '24', '48'],
    showPagination: false,
    enableVersionSelect: false,
    version: undefined,
    panelHeight: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [v: string | string[] | null | undefined]
  'update:version': [v: string | undefined]
  change: [record: any]
  'card-click': [record: any]
}>()

const defaultLabels: Required<MarketplaceResourcePickerLabels> = {
  all: '全部',
  tags: '标签',
  searchPlaceholder: '搜索名称',
  empty: '暂无数据',
  noMore: '没有更多了',
  noResourceTypes: '暂无资源类型',
  version: '版本',
  versionPlaceholder: '请选择版本',
  viewReleaseNotes: '查看发布说明',
  releaseNotesTitle: '发布说明',
}

const mergedLabels = computed(() => ({ ...defaultLabels, ...props.labels }))

const activeType = ref('')
const selectedTagIds = ref<string[]>([])
const keyword = ref('')
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
const sidebarBlocks = ref(buildSidebarBlocks([]))

const versionOptions = ref<CapabilityVersionOption[]>([])
const versionsLoading = ref(false)
let versionLoadSeq = 0

const selectedVersion = computed({
  get: () => (props.version == null || props.version === '' ? undefined : String(props.version)),
  set: (v: string | undefined) => emit('update:version', v),
})

function resolveFetchTagClassifiers(): TagClassifiersFetcher {
  return props.fetchTagClassifiers ?? defaultFetchTagClassifiers
}

function resolveFetchResources(): MarketplaceResourceFetcher {
  return props.fetchResources ?? defaultFetchResources
}

async function loadTagSidebar() {
  const ty = activeType.value
  if (!ty) {
    sidebarBlocks.value = []
    return
  }
  tagsLoading.value = true
  try {
    const res: any = await resolveFetchTagClassifiers()(ty)
    const roots = normalizeTagClassifiersResponse(res)
    sidebarBlocks.value = buildSidebarBlocks(roots)
  } finally {
    tagsLoading.value = false
  }
}

/** 底部分页：接口不返回 total，用本页条数推断（满页则假定可能还有下一页） */
async function fetchPage() {
  if (!activeType.value) return
  listLoading.value = true
  try {
    const { list } = await resolveFetchResources()({
      type: activeType.value,
      pageIndex: pageIndex.value - 1,
      pageSize: pageSize.value,
      keyword: keyword.value?.trim() ?? '',
      selectedTagIds: [...selectedTagIds.value],
    })
    records.value = list
    const pi = pageIndex.value
    if (list.length < pageSize.value) {
      total.value = (pi - 1) * pageSize.value + list.length
    } else {
      total.value = pi * pageSize.value + 1
    }
  } catch {
    records.value = []
    total.value = 0
  } finally {
    listLoading.value = false
  }
}

/** 滚动加载：reset=true 重新拉第一页；分页模式请用 fetchPage */
async function fetchList(reset = true) {
  if (!activeType.value) return
  if (props.showPagination) {
    await fetchPage()
    return
  }

  if (reset) {
    pageIndexScroll.value = 0
    records.value = []
    hasMore.value = true
  } else {
    if (!hasMore.value || loadingMore.value || listLoading.value) return
  }

  const initial = reset || records.value.length === 0
  if (initial) listLoading.value = true
  else loadingMore.value = true

  try {
    const pi = pageIndexScroll.value
    const { list } = await resolveFetchResources()({
      type: activeType.value,
      pageIndex: pi,
      pageSize: pageSize.value,
      keyword: keyword.value?.trim() ?? '',
      selectedTagIds: [...selectedTagIds.value],
    })
    if (reset) {
      records.value = list
    } else {
      records.value = [...records.value, ...list]
    }
    pageIndexScroll.value = pi + 1
    // 本页无数据，或条数不足一页 → 已是最后一页；满页则可能还有下一页（再请求为空则结束）
    hasMore.value = list.length > 0 && list.length >= pageSize.value
  } catch {
    if (reset) {
      records.value = []
    }
    hasMore.value = false
  } finally {
    listLoading.value = false
    loadingMore.value = false
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

function toggleTag(id: string) {
  const next = [...selectedTagIds.value]
  const i = next.indexOf(id)
  if (i >= 0) next.splice(i, 1)
  else next.push(id)
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
  { immediate: true, deep: true },
)

watch(
  activeType,
  (ty, oldTy) => {
    if (!ty) return
    if (oldTy !== undefined && oldTy !== '' && ty !== oldTy) {
      selectedTagIds.value = []
      keyword.value = ''
      pageIndex.value = 1
    }
    loadTagSidebar().then(() => {
      if (props.showPagination) fetchPage()
      else fetchList(true)
    })
  },
  { immediate: true },
)

watch(
  () => props.pageSize,
  (v) => {
    if (v != null && v > 0) pageSize.value = v
  },
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
  { immediate: true },
)

defineExpose({
  refresh: () => (props.showPagination ? fetchPage() : fetchList(true)),
})
</script>

<style scoped lang="less">
.mp-res-layout {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
}
.mp-res-layout__types {
  flex-shrink: 0;
  margin-bottom: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.mp-res-layout__tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}
.mp-res-layout__empty {
  padding: 48px 0;
}
.mp-res-layout__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
  min-height: 0;
  align-items: stretch;
}
@media (min-width: 992px) {
  .mp-res-layout__body {
    flex-direction: row;
    align-items: flex-start;
  }
}
.mp-res-layout__aside {
  width: 100%;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 12px;
  background: #fafafa;
  align-self: stretch;
  max-height: min(40vh, 360px);
  overflow: auto;
}
@media (min-width: 992px) {
  .mp-res-layout__aside {
    width: 300px;
    align-self: flex-start;
    max-height: calc(100vh - 220px);
  }
}
.mp-res-layout__aside-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: 10px;
}
.mp-res-layout__tag-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mp-res-layout__tag-list > button + .mp-res-layout__sidebar-classifier {
  margin-top: 8px;
}
.mp-res-layout__sidebar-classifier {
  padding: 6px 10px 2px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.45);
  line-height: 1.35;
  user-select: none;
}
.mp-res-layout__tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}
.mp-res-layout__tag {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.75);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.mp-res-layout__tag:hover {
  border-color: rgba(22, 119, 255, 0.25);
  color: #1677ff;
}
.mp-res-layout__tag--active {
  border-color: rgba(22, 119, 255, 0.45);
  background: rgba(22, 119, 255, 0.06);
  color: #0958d9;
  font-weight: 500;
}
.mp-res-layout__main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
}
.mp-res-layout__list-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  max-height: calc(100vh - 220px);
}
.mp-res-layout--fixed .mp-res-layout__list-scroll {
  max-height: none;
}
.mp-res-layout__load-hint {
  display: flex;
  justify-content: center;
  padding: 12px 0 4px;
}
.mp-res-layout__list-end {
  text-align: center;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
  padding: 4px 0 8px;
}
.mp-res-layout__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.mp-res-layout__search {
  flex: 1;
  min-width: 200px;
  max-width: 400px;
}
.mp-res-layout__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 12px;
  width: 100%;
  align-items: stretch;
}
.mp-res-layout__pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  flex-shrink: 0;
}
</style>
