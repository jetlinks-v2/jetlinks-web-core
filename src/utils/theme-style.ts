import {
  applyThemeColor,
  normalizeThemeColor,
  persistThemeColor
} from './theme-color'
import { styleTokens } from '@/utils/theme-config'

export const THEME_STYLE_KEY = 'jetlinks-theme-style'
export const DEFAULT_THEME_STYLE = 'light'
const legacyThemeStyleMap: Record<string, string> = {
  light: DEFAULT_THEME_STYLE
}

export interface ThemeStyleToken {
  label: string
  colorPrimary: string
  colorInfo?: string
  colorSuccess?: string
  colorWarning?: string
  colorError?: string
  colorBgBase: string
  colorBgLayout: string
  colorBgContainer: string
  colorBgElevated: string
  colorTextBase: string
  colorText: string
  colorTextSecondary: string
  colorBorder: string
  colorBorderSecondary: string
  borderRadius: number
  borderRadiusLG?: number
  borderRadiusSM?: number
  boxShadow?: string
  boxShadowSecondary?: string
  fontFamily?: string
  wireframe?: boolean
  cssVars?: Record<string, string>
}

export type ThemeStyleKey = keyof typeof themeStyleTokens

export const themeStyleTokens = styleTokens

export const themeStyleOptions = Object.entries(themeStyleTokens).map(([value, item]) => ({
  label: item.label,
  value
}))

export const normalizeThemeStyle = (style?: unknown): ThemeStyleKey => {
  if (typeof style === 'string') {
    const normalizedStyle = legacyThemeStyleMap[style] || style
    if (Object.prototype.hasOwnProperty.call(themeStyleTokens, normalizedStyle)) {
      return normalizedStyle as ThemeStyleKey
    }
  }

  return DEFAULT_THEME_STYLE
}

export const getThemeStyleToken = (style?: unknown) => {
  return themeStyleTokens[normalizeThemeStyle(style)]
}

export const getThemeStylePrimaryColor = (style?: unknown) => {
  console.log(style)
  return normalizeThemeColor(getThemeStyleToken(style).colorPrimary)
}

const getInitialThemeStyle = () => {
  try {
    return normalizeThemeStyle(localStorage.getItem(THEME_STYLE_KEY))
  } catch {
    return DEFAULT_THEME_STYLE
  }
}

export const getInitialThemeStyleConfig = () => {
  const style = getInitialThemeStyle()
  const token = getThemeStyleToken(style)

  return {
    style,
    token,
    color: normalizeThemeColor(token.colorPrimary)
  }
}

export const applyThemeStyle = (style?: unknown, color?: string) => {
  const themeStyle = normalizeThemeStyle(style)
  const token = getThemeStyleToken(themeStyle)
  const themeColor = applyThemeColor(color || token.colorPrimary)

  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.dataset.themeStyle = themeStyle
    const rootStyle = root.style
    rootStyle.setProperty('--jet-theme-bg-base', token.colorBgBase)
    rootStyle.setProperty('--jet-theme-bg-layout', token.colorBgLayout)
    rootStyle.setProperty('--jet-theme-bg-container', token.colorBgContainer)
    rootStyle.setProperty('--jet-theme-bg-elevated', token.colorBgElevated)
    rootStyle.setProperty('--jet-theme-success', token.colorSuccess || '#52C41A')
    rootStyle.setProperty('--jet-theme-warning', token.colorWarning || '#FAAD14')
    rootStyle.setProperty('--jet-theme-error', token.colorError || '#FF4D4F')
    rootStyle.setProperty('--jet-theme-text', token.colorText)
    rootStyle.setProperty('--jet-theme-text-secondary', token.colorTextSecondary)
    rootStyle.setProperty('--jet-theme-border', token.colorBorder)
    rootStyle.setProperty('--jet-theme-border-secondary', token.colorBorderSecondary)
    rootStyle.setProperty('--jet-theme-radius', `${token.borderRadius}px`)
    rootStyle.setProperty('--jet-theme-radius-lg', `${token.borderRadiusLG || token.borderRadius}px`)
    rootStyle.setProperty('--jet-theme-radius-sm', `${token.borderRadiusSM || token.borderRadius}px`)
    rootStyle.setProperty('--jet-theme-shadow', token.boxShadow || 'none')
    rootStyle.setProperty('--jet-theme-shadow-secondary', token.boxShadowSecondary || 'none')
    rootStyle.setProperty('--jet-theme-font-family', token.fontFamily || 'AliRegular, sans-serif')

    Object.entries(token.cssVars || {}).forEach(([name, value]) => {
      rootStyle.setProperty(name, value)
    })
  }

  return {
    style: themeStyle,
    color: themeColor,
    token
  }
}

export const persistThemeStyle = (style: string, color?: string) => {
  const result = applyThemeStyle(style, color)

  try {
    localStorage.setItem(THEME_STYLE_KEY, result.style)
  } catch {
    // ignore
  }

  if (color) {
    persistThemeColor(color)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jetlinks-theme-style-changed', {
      detail: result
    }))
  }

  return result
}
