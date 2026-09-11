import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import type { Ref } from 'vue'
import { throttle } from 'lodash-es'
import { normalizeGridItem } from '../utils/layout'
import { createDashboardId } from '../utils/id'
import type { DashboardGridItem, DashboardGridSettings, DashboardLayoutItem } from '../types'

interface GridLayoutHandle {
  $el: HTMLElement
  dragEvent: (eventName: string, id: string, x: number, y: number, h: number, w: number) => void
}
interface GridItemHandle {
  i: string | number
  calcXY: (top: number, left: number) => { x: number; y: number }
}
interface DragSource { type: string; gridItem?: Partial<DashboardGridItem> }
interface DragOptions {
  host: Ref<HTMLElement | undefined>
  layoutRef: Ref<GridLayoutHandle | undefined>
  gridItemRefs: Ref<GridItemHandle[]>
  layout: Ref<DashboardLayoutItem[]>
  settings: () => DashboardGridSettings
  dragging: () => DragSource | undefined
  editable: () => boolean
  onDrop: (type: string, position: { x: number; y: number }, layout: DashboardLayoutItem[]) => void
  onEnd: () => void
}

/**
 * Extracted from LoadingBoard: placeholder -> GridItem.calcXY -> dragEvent -> commit.
 * Drag source and placeholder are scoped to this canvas instead of useDashBoard's module-global state.
 */
export function useDashboardDrag(options: DragOptions) {
  const placeholderId = `drop_${createDashboardId()}`
  let cachedDropElement: DragSource | undefined
  let finalDragPosition = { x: 0, y: 0 }
  let isDraggingToCanvas = false
  let layoutBeforeDrag: DashboardLayoutItem[] | undefined
  let dropping = false
  let generation = 0

  function getCommittedLayout() {
    return options.layout.value.filter(item => item.i !== placeholderId).map(item => ({ ...item }))
  }

  function createPlaceholder() {
    cachedDropElement ??= options.dragging()
    if (!cachedDropElement) return false
    if (options.layout.value.some(item => item.i === placeholderId)) return false
    layoutBeforeDrag = getCommittedLayout()
    const grid = normalizeGridItem(cachedDropElement.gridItem, options.settings().columns)
    options.layout.value.push({ ...grid, x: 0, y: 0, i: placeholderId })
    isDraggingToCanvas = true
    return true
  }

  function removePlaceholder(restore = true) {
    generation += 1
    doPositionUpdate.cancel()
    if (options.layout.value.some(item => item.i === placeholderId)) {
      const grid = normalizeGridItem(cachedDropElement?.gridItem, options.settings().columns)
      options.layoutRef.value?.dragEvent('dragend', placeholderId,
        finalDragPosition.x, finalDragPosition.y, grid.h, grid.w)
      options.layout.value = getCommittedLayout()
    }
    // Cancelled palette drops must not leave the collision preview as an unsaved layout mutation.
    if (restore && layoutBeforeDrag) options.layout.value = layoutBeforeDrag
    layoutBeforeDrag = undefined
    isDraggingToCanvas = false
    cachedDropElement = undefined
    finalDragPosition = { x: 0, y: 0 }
  }

  function updatePosition(clientX: number, clientY: number) {
    const item = options.gridItemRefs.value.find(item => item.i === placeholderId)
    const layoutElement = options.layoutRef.value?.$el
    if (!item || !layoutElement || !cachedDropElement) return
    const rect = layoutElement.getBoundingClientRect()
    const grid = normalizeGridItem(cachedDropElement.gridItem, options.settings().columns)
    const columnWidth = rect.width / options.settings().columns
    const position = item.calcXY(
      clientY - rect.top - grid.h * options.settings().rowHeight / 2,
      clientX - rect.left - grid.w * columnWidth / 2,
    )
    options.layoutRef.value?.dragEvent('dragstart', placeholderId, position.x, position.y, grid.h, grid.w)
    finalDragPosition = position
  }
  const doPositionUpdate = throttle(updatePosition, 14)

  function onDragOver(event: DragEvent) {
    if (!options.editable() || !options.dragging()) return
    event.preventDefault()
    if (!isDraggingToCanvas) createPlaceholder()
    doPositionUpdate(event.clientX, event.clientY)
  }

  async function onDrop(event: DragEvent) {
    if (!options.editable() || !options.dragging() || dropping) return
    event.preventDefault()
    if (!isDraggingToCanvas) createPlaceholder()
    const dropGeneration = generation
    dropping = true
    try {
      // Mount a just-created placeholder before asking GridItem to calculate its coordinates.
      // Native dragend may clear the palette selection during this tick; retain the cached source.
      await nextTick()
      if (generation !== dropGeneration || !cachedDropElement || !options.editable()) return
      doPositionUpdate.cancel()
      updatePosition(event.clientX, event.clientY)
      const type = cachedDropElement.type
      const position = { ...finalDragPosition }
      removePlaceholder(false)
      options.onDrop(type, position, getCommittedLayout())
    } finally {
      dropping = false
      options.onEnd()
    }
  }

  const handleGlobalDragOver = throttle((event: DragEvent) => {
    if (dropping || !isDraggingToCanvas || !options.host.value) return
    const rect = options.host.value.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      removePlaceholder()
    }
  }, 14)
  function cancel() { removePlaceholder(); options.onEnd() }
  function handleNativeDragEnd() { if (!dropping) cancel() }

  watch(options.dragging, source => { if (!source && !dropping) removePlaceholder() })
  watch(options.editable, editable => { if (!editable) cancel() })
  onMounted(() => {
    document.addEventListener('dragover', handleGlobalDragOver)
    document.addEventListener('dragend', handleNativeDragEnd)
  })
  onBeforeUnmount(() => {
    removePlaceholder()
    handleGlobalDragOver.cancel()
    document.removeEventListener('dragover', handleGlobalDragOver)
    document.removeEventListener('dragend', handleNativeDragEnd)
  })
  return { placeholderId, onDragOver, onDrop, getCommittedLayout, cancel }
}
