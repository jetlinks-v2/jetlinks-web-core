import { watch, type Ref } from 'vue'
import type { DashboardGridItem, DashboardLayoutItem } from '../types'

interface PlaceholderGrid {
  readonly isDragging: boolean
  readonly placeholder: Pick<DashboardGridItem, 'x' | 'y' | 'w' | 'h'> & { i: string | number }
}

/** 网格先记录占位再执行移动/压紧；渲染后以引擎最终布局同步其公开占位对象。 */
export function useDashboardPlaceholder(grid: Readonly<Ref<PlaceholderGrid | undefined>>, layout: Readonly<Ref<DashboardLayoutItem[]>>) {
  watch(() => [grid.value?.isDragging, layout.value], () => {
    if (!grid.value?.isDragging) return
    const placeholder = grid.value.placeholder
    const target = layout.value.find(item => item.i === String(placeholder.i))
    if (target) {
      placeholder.x = target.x
      placeholder.y = target.y
      placeholder.w = target.w
      placeholder.h = target.h
    }
  }, { deep: true, flush: 'post' })
}
