import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type CSSProperties,
} from 'vue'
import type { MatrixGridRow } from './types'

const remBase = 16

interface MatrixGridLayoutOptions {
  getRows: () => MatrixGridRow<unknown>[]
  getColumnCount: () => number
  getFirstColumnWidth: () => number
  getColumnMinWidth: () => number
  getRowHeight: () => number
  getGridGap: () => number
  getColumnHeaderHeight: () => number
  getColumnGroupHeaderHeight: () => number
  getHasColumnGroups: () => boolean
  getVirtual: () => boolean
  getFillViewport: () => boolean
  getOverscan: () => number
}

const toRem = (value: number) => `${value / remBase}rem`

/** 统一维护固定行高矩阵的列宽、纵向虚拟切片和视口填充行。 */
export function useMatrixGridLayout(options: MatrixGridLayoutOptions) {
  const scrollRef = ref<HTMLElement>()
  const viewportHeight = ref(0)
  const scrollTop = ref(0)
  const fillerRowCount = ref(0)
  let resizeObserver: ResizeObserver | undefined
  let scrollFrame: number | undefined

  const rowPitch = computed(() => options.getRowHeight() + options.getGridGap())
  const headerHeight = computed(() => (
    options.getColumnHeaderHeight()
    + (options.getHasColumnGroups()
      ? options.getColumnGroupHeaderHeight() + options.getGridGap()
      : 0)
  ))
  const totalRowCount = computed(() => options.getRows().length)
  const visibleRowCapacity = computed(() => (
    Math.ceil((viewportHeight.value || rowPitch.value * 16) / rowPitch.value)
    + options.getOverscan() * 2
  ))
  const visibleStartIndex = computed(() => {
    if (!options.getVirtual() || !totalRowCount.value) return 0
    const maxStartIndex = Math.max(0, totalRowCount.value - visibleRowCapacity.value)
    return Math.min(
      maxStartIndex,
      Math.max(0, Math.floor(scrollTop.value / rowPitch.value) - options.getOverscan()),
    )
  })
  const visibleEndIndex = computed(() => (
    options.getVirtual()
      ? Math.min(totalRowCount.value, visibleStartIndex.value + visibleRowCapacity.value)
      : totalRowCount.value
  ))
  const visibleRows = computed(() => (
    options
      .getRows()
      .slice(visibleStartIndex.value, visibleEndIndex.value)
      .map((row, index) => ({ row, rowIndex: visibleStartIndex.value + index }))
  ))
  const topSpacerHeight = computed(() => (
    options.getVirtual() ? visibleStartIndex.value * rowPitch.value : 0
  ))
  const bottomSpacerHeight = computed(() => (
    options.getVirtual()
      ? Math.max(0, totalRowCount.value - visibleEndIndex.value) * rowPitch.value
      : 0
  ))
  const gridStyle = computed<CSSProperties>(() => {
    const columnCount = options.getColumnCount()
    const firstColumnWidth = options.getFirstColumnWidth()
    const columnMinWidth = options.getColumnMinWidth()
    // 数据列筛选到 0 时由首列承接可用宽度，避免固定列宽后留下无意义空白区域。
    const firstColumnTemplate = columnCount > 0
      ? toRem(firstColumnWidth)
      : `minmax(${toRem(firstColumnWidth)}, 1fr)`
    const dataColumnTemplate = columnCount > 0
      ? ` repeat(${columnCount}, minmax(${toRem(columnMinWidth)}, 1fr))`
      : ''
    return {
      gridTemplateColumns: `${firstColumnTemplate}${dataColumnTemplate}`,
      minWidth: toRem(firstColumnWidth + columnCount * columnMinWidth),
      gap: toRem(options.getGridGap()),
      '--matrix-grid-row-height': toRem(options.getRowHeight()),
      '--matrix-grid-column-header-height': toRem(options.getColumnHeaderHeight()),
      '--matrix-grid-column-group-header-height': toRem(options.getColumnGroupHeaderHeight()),
      '--matrix-grid-column-header-top': toRem(
        options.getHasColumnGroups()
          ? options.getColumnGroupHeaderHeight() + options.getGridGap()
          : 0,
      ),
      '--matrix-grid-header-height': toRem(headerHeight.value),
    } as CSSProperties
  })

  function updateViewportMetrics() {
    viewportHeight.value = scrollRef.value?.clientHeight || 0
    scrollTop.value = scrollRef.value?.scrollTop || 0
  }

  function scheduleScrollUpdate() {
    if (scrollFrame != null) return
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame === 'undefined') {
      updateViewportMetrics()
      return
    }
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = undefined
      updateViewportMetrics()
    })
  }

  async function updateFillerRows() {
    await nextTick()
    updateViewportMetrics()
    if (!options.getFillViewport()) {
      fillerRowCount.value = 0
      return
    }
    const remainingHeight = viewportHeight.value - headerHeight.value - totalRowCount.value * rowPitch.value
    fillerRowCount.value = Math.max(0, Math.ceil(remainingHeight / rowPitch.value))
  }

  watch(
    () => [
      totalRowCount.value,
      options.getColumnCount(),
      options.getRowHeight(),
      headerHeight.value,
      options.getFillViewport(),
    ],
    updateFillerRows,
    { immediate: true },
  )
  onMounted(() => {
    if (scrollRef.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateFillerRows)
      resizeObserver.observe(scrollRef.value)
    }
    scrollRef.value?.addEventListener('scroll', scheduleScrollUpdate, { passive: true })
    void updateFillerRows()
  })
  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    scrollRef.value?.removeEventListener('scroll', scheduleScrollUpdate)
    if (scrollFrame != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(scrollFrame)
    }
  })

  return {
    bottomSpacerHeight,
    fillerRowCount,
    gridStyle,
    scrollRef,
    topSpacerHeight,
    visibleRows,
  }
}
