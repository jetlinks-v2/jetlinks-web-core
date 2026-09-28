import { computed, type Ref } from 'vue'

export interface GridLayoutOptions {
  /** 最小列宽，例如 '160px' */
  minWidth: string
  /** 当数据量少于或等于阈值时，单个列允许拉伸的最大宽度，例如 '320px'。 */
  maxWidthForFew: string
  /** 判断数据量“少”的阈值，默认 3 */
  fewThreshold?: number
}

/**
 * 通用网格自动居中布局 Hook
 * 解决 `grid-template-columns: repeat(auto-fill, ...)` 在多余空间时创建空列导致内容无法居中的问题，并防止数量较少时子项过度拉伸。
 *
 * @param dataSourceListRef 数据源列表 Ref
 * @param styleGetter 基础样式的 Getter (如 () => props.style)
 * @param options 最小、最大的列宽配置
 */
export function useGridLayout(
  dataSourceListRef: Ref<any[] | undefined>,
  styleGetter: () => Record<string, any>,
  options: GridLayoutOptions
) {
  const containerStyle = computed(() => {
    const len = dataSourceListRef.value?.length || 0
    const baseStyle = styleGetter() || {}

    if (len === 0) return baseStyle

    const { minWidth, maxWidthForFew, fewThreshold = 3 } = options
    const maxSpan = len <= fewThreshold ? maxWidthForFew : '1fr'

    return {
      ...baseStyle,
      gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minWidth}), ${maxSpan}))`
    }
  })

  return {
    containerStyle
  }
}
