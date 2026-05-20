import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue'

type MaybeRef<T> = Ref<T> | ComputedRef<T>

export interface LayoutDimensionModel {
  siderWidth: number
  headerHeight: number
  collapsedWidth: number
  [key: string]: unknown
}

export interface LayoutThemeModel {
  siderWidth?: number
}

type LayoutScreenProfile = {
  name: '1k' | '2k' | '4k'
  minCssWidth: number
  headerHeight: number
  siderWidth: number
  collapsedWidth: number
}

const screenProfiles: LayoutScreenProfile[] = [
  {
    name: '4k',
    minCssWidth: 3200,
    headerHeight: 80,
    siderWidth: 320,
    collapsedWidth: 64
  },
  {
    name: '2k',
    minCssWidth: 2560,
    headerHeight: 56,
    siderWidth: 240,
    collapsedWidth: 56
  },
  {
    name: '1k',
    minCssWidth: 0,
    headerHeight: 48,
    siderWidth: 208,
    collapsedWidth: 48
  }
]

const resolveViewport = () => {
  if (typeof window === 'undefined') {
    return {
      width: 0
    }
  }

  return {
    width: window.innerWidth
  }
}

export const useResponsiveLayoutDimensions = (
  layout: MaybeRef<LayoutDimensionModel>,
  themeLayout?: MaybeRef<LayoutThemeModel | undefined>
) => {
  const viewport = ref(resolveViewport())
  let resizeFrame = 0

  const updateViewport = () => {
    if (resizeFrame) {
      cancelAnimationFrame(resizeFrame)
    }

    // resize 事件触发很密，合并到下一帧再更新，避免拖拽窗口时反复触发布局计算。
    resizeFrame = requestAnimationFrame(() => {
      viewport.value = resolveViewport()
      resizeFrame = 0
    })
  }

  onMounted(() => {
    viewport.value = resolveViewport()
    window.addEventListener('resize', updateViewport)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', updateViewport)
    if (resizeFrame) {
      cancelAnimationFrame(resizeFrame)
    }
  })

  const layoutConfig = computed(() => {
    const baseLayout = layout.value
    const baseSiderWidth = themeLayout?.value?.siderWidth ?? baseLayout.siderWidth
    const { width } = viewport.value
    const profile = screenProfiles.find(item => (
      width >= item.minCssWidth
    )) || screenProfiles[screenProfiles.length - 1]

    return {
      ...baseLayout,
      // 响应式档位只负责抬高最低尺寸，不压低主题或系统侧显式给出的更大配置。
      headerHeight: Math.max(baseLayout.headerHeight, profile.headerHeight),
      siderWidth: Math.max(baseSiderWidth, profile.siderWidth),
      collapsedWidth: Math.max(baseLayout.collapsedWidth, profile.collapsedWidth)
    }
  })

  return {
    layoutConfig
  }
}
