import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef } from 'vue'
import type { AliasToken } from 'ant-design-vue/es/theme/interface'
import { useSystemStore } from '@jetlinks-web-core/store'

export interface ResponsiveAntdTokenOptions {
  enabled?: boolean
}

export type ResponsiveAntdTokenScreenProfileName = '1k' | '2k' | '4k'

export interface ResponsiveAntdTokenScaleProfile {
  name: ResponsiveAntdTokenScreenProfileName
  minCssWidth: number
  minPhysicalWidth: number
  scale: number
}

interface ResponsiveViewport {
  width: number
  physicalWidth: number
}

const RESPONSIVE_TOKEN_SCALE_PROFILES: ResponsiveAntdTokenScaleProfile[] = [
  { name: '4k', minCssWidth: 3200, minPhysicalWidth: 3800, scale: 2 },
  { name: '2k', minCssWidth: 2560, minPhysicalWidth: 2500, scale: 1.33 },
  { name: '1k', minCssWidth: 0, minPhysicalWidth: 0, scale: 1 }
]

const DEFAULT_ANTD_TOKEN = {
  fontSize: 14,
  sizeUnit: 4,
  controlHeight: 32,
  borderRadius: 6,
  borderRadiusSM: 4,
  borderRadiusLG: 8
}

const RESPONSIVE_LINE_WIDTH_PROFILES: Record<ResponsiveAntdTokenScreenProfileName, number> = {
  '1k': 1,
  '2k': 1,
  '4k': 2
}

const resolveViewport = (): ResponsiveViewport => {
  if (typeof window === 'undefined') {
    return {
      width: 0,
      physicalWidth: 0
    }
  }

  const devicePixelRatio = window.devicePixelRatio || 1
  const cssWidth = Math.max(window.innerWidth, window.screen?.width || 0)

  return {
    width: window.innerWidth,
    // Windows 缩放下 4K 屏常会被折算成 2560 CSS px，乘 DPR 后再判断物理档位。
    physicalWidth: Math.round(cssWidth * devicePixelRatio)
  }
}

const getScreenProfile = (viewport: ResponsiveViewport) => {
  return RESPONSIVE_TOKEN_SCALE_PROFILES.find(item => (
    viewport.width >= item.minCssWidth || viewport.physicalWidth >= item.minPhysicalWidth
  )) || RESPONSIVE_TOKEN_SCALE_PROFILES[RESPONSIVE_TOKEN_SCALE_PROFILES.length - 1]
}

const scaleNumber = (value: number, scale: number) => Math.round(value * scale)

export const useResponsiveAntdToken = (
  options: ResponsiveAntdTokenOptions = {}
): {
  screenProfile: ComputedRef<ResponsiveAntdTokenScaleProfile>
  scale: ComputedRef<number>
  token: ComputedRef<Partial<AliasToken>>
} => {
  const systemStore = useSystemStore()
  const viewport = ref(resolveViewport())
  let resizeFrame = 0

  const updateViewport = () => {
    if (resizeFrame) {
      cancelAnimationFrame(resizeFrame)
    }

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

  const enabled = computed(() => options.enabled !== false)
  const screenProfile = computed(() => getScreenProfile(viewport.value))
  const scale = computed(() => enabled.value ? screenProfile.value.scale : 1)
  const lineWidth = computed(() => (
    enabled.value ? RESPONSIVE_LINE_WIDTH_PROFILES[screenProfile.value.name] : 1
  ))

  const token = computed<Partial<AliasToken>>(() => {
    const currentScale = scale.value
    const baseToken = {
      ...DEFAULT_ANTD_TOKEN,
      borderRadius: systemStore.themeStyleToken.borderRadius || DEFAULT_ANTD_TOKEN.borderRadius,
      borderRadiusSM: systemStore.themeStyleToken.borderRadiusSM || DEFAULT_ANTD_TOKEN.borderRadiusSM,
      borderRadiusLG: systemStore.themeStyleToken.borderRadiusLG || DEFAULT_ANTD_TOKEN.borderRadiusLG
    }

    return {
      fontSize: scaleNumber(baseToken.fontSize, currentScale),
      sizeUnit: scaleNumber(baseToken.sizeUnit, currentScale),
      controlHeight: scaleNumber(baseToken.controlHeight, currentScale),
      borderRadius: scaleNumber(baseToken.borderRadius, currentScale),
      borderRadiusSM: scaleNumber(baseToken.borderRadiusSM, currentScale),
      borderRadiusLG: scaleNumber(baseToken.borderRadiusLG, currentScale),
      lineWidth: lineWidth.value
    }
  })

  return {
    screenProfile,
    scale,
    token
  }
}
