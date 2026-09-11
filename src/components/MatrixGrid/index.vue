<template>
  <section
    class="matrix-grid"
    :class="{ 'matrix-grid--with-column-groups': hasColumnGroups }"
  >
    <div ref="scrollRef" class="matrix-grid__scroll">
      <div class="matrix-grid__grid" :style="gridStyle">
        <div class="matrix-grid__corner">
          <slot name="corner" />
        </div>

        <div
          v-for="group in columnGroupLayouts"
          :key="group.key"
          class="matrix-grid__column-group"
          :style="{ gridColumn: `${group.startColumn} / span ${group.span}` }"
        >
          <slot name="column-group-header" :group="group" />
        </div>

        <div
          v-for="(column, columnIndex) in columns"
          :key="column.key"
          class="matrix-grid__column-header"
          :style="{ gridColumn: `${columnIndex + 2}` }"
          :data-matrix-column-key="column.key"
        >
          <slot name="column-header" :column="column" :column-index="columnIndex" />
        </div>

        <div
          v-if="topSpacerHeight"
          class="matrix-grid__virtual-spacer"
          :style="{ height: `${topSpacerHeight}px` }"
          aria-hidden="true"
        />

        <template v-for="{ row, rowIndex } in visibleRows" :key="row.key">
          <template v-if="row.kind === 'group'">
            <button
              type="button"
              class="matrix-grid__group-row"
              :class="{ 'is-hovered': hoveredGroupKey === row.key }"
              :style="groupRowStyle(row.depth)"
              :data-matrix-row-key="row.key"
              :aria-expanded="isExpanded(row.key)"
              @mouseenter="hoveredGroupKey = row.key"
              @mouseleave="hoveredGroupKey = ''"
              @click="emit('toggle-row', row.key, row)"
            >
              <AIcon
                class="matrix-grid__group-caret"
                :class="{ 'is-expanded': isExpanded(row.key) }"
                type="RightOutlined"
              />
              <span class="matrix-grid__group-row-content">
                <slot
                  name="group-row"
                  :row="row"
                  :row-index="rowIndex"
                  :expanded="isExpanded(row.key)"
                />
              </span>
            </button>
            <button
              v-for="(column, columnIndex) in columns"
              :key="`${row.key}-${column.key}`"
              type="button"
              tabindex="-1"
              aria-hidden="true"
              class="matrix-grid__group-cell"
              :class="{ 'is-hovered': hoveredGroupKey === row.key }"
              @mouseenter="hoveredGroupKey = row.key"
              @mouseleave="hoveredGroupKey = ''"
              @click="emit('toggle-row', row.key, row)"
            >
              <slot
                name="group-cell"
                :row="row"
                :row-index="rowIndex"
                :column="column"
                :column-index="columnIndex"
                :expanded="isExpanded(row.key)"
              />
            </button>
          </template>

          <template v-else>
            <div
              class="matrix-grid__row-header"
              :data-matrix-row-key="row.key"
            >
              <slot name="row-header" :row="row" :row-index="rowIndex" />
            </div>
            <div
              v-for="(column, columnIndex) in columns"
              :key="`${row.key}-${column.key}`"
              class="matrix-grid__cell"
              :data-matrix-row-key="row.key"
              :data-matrix-column-key="column.key"
            >
              <slot
                name="cell"
                :row="row"
                :row-index="rowIndex"
                :column="column"
                :column-index="columnIndex"
              />
            </div>
          </template>
        </template>

        <div
          v-if="bottomSpacerHeight"
          class="matrix-grid__virtual-spacer"
          :style="{ height: `${bottomSpacerHeight}px` }"
          aria-hidden="true"
        />

        <template v-for="fillerRow in rows.length ? fillerRowCount : 0" :key="`filler-${fillerRow}`">
          <div class="matrix-grid__filler-row-header" aria-hidden="true" />
          <div
            v-for="column in columns"
            :key="`filler-${fillerRow}-${column.key}`"
            class="matrix-grid__filler-cell"
            aria-hidden="true"
          />
        </template>
      </div>

      <slot v-if="!rows.length" name="empty">
        <CloudEmpty class="matrix-grid__empty" :description="emptyDescription" />
      </slot>
    </div>

    <footer v-if="showFooter" class="matrix-grid__footer">
      <template v-if="showGroupActions">
        <a-button
          type="text"
          size="small"
          class="matrix-grid__footer-action"
          :class="{ 'is-active': expandAllActive }"
          @click="emit('expand-all')"
        >
          <template #icon><AIcon type="CheckSquareOutlined" /></template>
          {{ expandAllText }}
        </a-button>
        <a-button
          type="text"
          size="small"
          class="matrix-grid__footer-action"
          :class="{ 'is-active': collapseAllActive }"
          @click="emit('collapse-all')"
        >
          <template #icon><AIcon type="MinusSquareOutlined" /></template>
          {{ collapseAllText }}
        </a-button>
      </template>
      <slot
        name="footer"
        :expand-all-active="expandAllActive"
        :collapse-all-active="collapseAllActive"
      />
    </footer>
  </section>
</template>

<script setup lang="ts" name="MatrixGrid">
import { computed, ref, type CSSProperties } from 'vue'
import CloudEmpty from '../CloudEmpty/index.vue'
import type {
  MatrixGridColumn,
  MatrixGridColumnGroup,
  MatrixGridColumnGroupLayout,
  MatrixGridRow,
} from './types'
import { useMatrixGridLayout } from './useMatrixGridLayout'

const props = withDefaults(defineProps<{
  rows: MatrixGridRow<unknown>[]
  columns: MatrixGridColumn<unknown>[]
  columnGroups?: MatrixGridColumnGroup<unknown>[]
  expandedKeys?: ReadonlySet<string> | string[]
  emptyDescription?: string
  firstColumnWidth?: number
  columnMinWidth?: number
  rowHeight?: number
  gridGap?: number
  columnHeaderHeight?: number
  columnGroupHeaderHeight?: number
  groupRowPadding?: number
  groupIndent?: number
  virtual?: boolean
  virtualOverscan?: number
  fillViewport?: boolean
  showFooter?: boolean
  showGroupActions?: boolean
  expandAllText?: string
  collapseAllText?: string
}>(), {
  columnGroups: () => [],
  expandedKeys: () => new Set<string>(),
  emptyDescription: '',
  firstColumnWidth: 400,
  columnMinWidth: 165,
  rowHeight: 40,
  gridGap: 1,
  columnHeaderHeight: 86,
  columnGroupHeaderHeight: 40,
  groupRowPadding: 16,
  groupIndent: 20,
  virtual: false,
  virtualOverscan: 8,
  fillViewport: false,
  showFooter: false,
  showGroupActions: true,
  expandAllText: '',
  collapseAllText: '',
})

const emit = defineEmits<{
  (event: 'toggle-row', key: string, row: MatrixGridRow<unknown>): void
  (event: 'expand-all'): void
  (event: 'collapse-all'): void
}>()

const hoveredGroupKey = ref('')
const hasColumnGroups = computed(() => props.columnGroups.length > 0)
const groupRows = computed(() => props.rows.filter(row => row.kind === 'group'))
const expandedKeySet = computed<ReadonlySet<string>>(() => (
  props.expandedKeys instanceof Set ? props.expandedKeys : new Set(props.expandedKeys)
))
const hasExpandedGroup = computed(() => (
  groupRows.value.some(row => expandedKeySet.value.has(row.key))
))
const expandAllActive = computed(() => (
  groupRows.value.length > 0
  && groupRows.value.every(row => expandedKeySet.value.has(row.key))
))
const collapseAllActive = computed(() => groupRows.value.length > 0 && !hasExpandedGroup.value)
const columnGroupLayouts = computed<MatrixGridColumnGroupLayout<unknown>[]>(() => {
  const columnIndexByKey = new Map(props.columns.map((column, index) => [column.key, index]))
  return props.columnGroups.flatMap(group => {
    const indexes = group.columnKeys
      .map(key => columnIndexByKey.get(key))
      .filter((index): index is number => index != null)
    if (!indexes.length) return []
    const startIndex = Math.min(...indexes)
    return [{ ...group, startColumn: startIndex + 2, span: indexes.length }]
  })
})

const {
  bottomSpacerHeight,
  fillerRowCount,
  gridStyle,
  scrollRef,
  topSpacerHeight,
  visibleRows,
} = useMatrixGridLayout({
  getRows: () => props.rows,
  getColumnCount: () => props.columns.length,
  getFirstColumnWidth: () => props.firstColumnWidth,
  getColumnMinWidth: () => props.columnMinWidth,
  getRowHeight: () => props.rowHeight,
  getGridGap: () => props.gridGap,
  getColumnHeaderHeight: () => props.columnHeaderHeight,
  getColumnGroupHeaderHeight: () => props.columnGroupHeaderHeight,
  getHasColumnGroups: () => hasColumnGroups.value,
  getVirtual: () => props.virtual,
  getFillViewport: () => props.fillViewport,
  getOverscan: () => props.virtualOverscan,
})

function isExpanded(key: string) {
  return expandedKeySet.value.has(key)
}

function groupRowStyle(depth = 0): CSSProperties {
  return {
    paddingLeft: `${(props.groupRowPadding + depth * props.groupIndent) / 16}rem`,
  }
}

defineExpose({
  getScrollElement: () => scrollRef.value,
})
</script>

<style scoped src="./style.css"></style>
