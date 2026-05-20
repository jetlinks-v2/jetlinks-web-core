import theme from '@theme-config'

export const THEME_COLOR_KEY = 'jetlinks-theme-color'
export const DEFAULT_THEME_COLOR = '#1677FF'

const hexColorReg = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export interface ThemeColorStateOptions {
  hover?: string
  active?: string
  soft?: string
  scale1?: string
  scale2?: string
}

const expandHexColor = (color: string) => {
  const normalized = color.trim()
  if (!hexColorReg.test(normalized)) return ''

  if (normalized.length === 4) {
    const [, r, g, b] = normalized
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }

  return normalized.toUpperCase()
}

export const normalizeThemeColor = (color?: unknown) => {
  return typeof color === 'string' ? expandHexColor(color) : ''
}

const hexToRgb = (color: string) => ({
  r: Number.parseInt(color.slice(1, 3), 16),
  g: Number.parseInt(color.slice(3, 5), 16),
  b: Number.parseInt(color.slice(5, 7), 16)
})

const componentToHex = (value: number) => {
  return Math.round(value).toString(16).padStart(2, '0')
}

const mixColor = (color: string, target: string, ratio: number) => {
  const sourceRgb = hexToRgb(color)
  const targetRgb = hexToRgb(target)
  const next = {
    r: sourceRgb.r * (1 - ratio) + targetRgb.r * ratio,
    g: sourceRgb.g * (1 - ratio) + targetRgb.g * ratio,
    b: sourceRgb.b * (1 - ratio) + targetRgb.b * ratio
  }

  return `#${componentToHex(next.r)}${componentToHex(next.g)}${componentToHex(next.b)}`.toUpperCase()
}

const getDefaultThemeColor = () => {
  return normalizeThemeColor(theme.colorPrimary) || DEFAULT_THEME_COLOR
}

export const getInitialThemeColor = () => {
  try {
    const storedColor = normalizeThemeColor(localStorage.getItem(THEME_COLOR_KEY))
    if (storedColor) return storedColor
  } catch {
    // ignore
  }

  return getDefaultThemeColor()
}

export const applyThemeColor = (color?: string, stateColors: ThemeColorStateOptions = {}) => {
  const themeColor = normalizeThemeColor(color) || getDefaultThemeColor()
  const themeColorHover = normalizeThemeColor(stateColors.hover) || mixColor(themeColor, '#FFFFFF', 0.18)
  const themeColorActive = normalizeThemeColor(stateColors.active) || mixColor(themeColor, '#000000', 0.12)
  const themeColorSoft = normalizeThemeColor(stateColors.soft) || mixColor(themeColor, '#FFFFFF', 0.92)
  const themeColorScale1 = normalizeThemeColor(stateColors.scale1) || themeColorSoft
  const themeColorScale2 = normalizeThemeColor(stateColors.scale2) || mixColor(themeColor, '#FFFFFF', 0.72)

  if (typeof document !== 'undefined') {
    const rootStyle = document.documentElement.style
    rootStyle.setProperty('--primary-color', themeColor)
    rootStyle.setProperty('--primary-color-1', themeColorScale1)
    rootStyle.setProperty('--primary-color-2', themeColorScale2)
    rootStyle.setProperty('--primary-color-hover', themeColorHover)
    rootStyle.setProperty('--primary-color-active', themeColorActive)
    rootStyle.setProperty('--jet-theme-primary', themeColor)
    rootStyle.setProperty('--jet-theme-primary-1', themeColorScale1)
    rootStyle.setProperty('--jet-theme-primary-2', themeColorScale2)
    rootStyle.setProperty('--jet-theme-primary-hover', themeColorHover)
    rootStyle.setProperty('--jet-theme-primary-active', themeColorActive)
    rootStyle.setProperty('--jet-theme-primary-soft', themeColorScale1)
    rootStyle.setProperty('--ant-primary-color', themeColor)
    rootStyle.setProperty('--ant-primary-color-hover', themeColorHover)
    rootStyle.setProperty('--ant-primary-color-active', themeColorActive)
    rootStyle.setProperty('--ant-color-primary', themeColor)
    rootStyle.setProperty('--ant-color-primary-hover', themeColorHover)
    rootStyle.setProperty('--ant-color-primary-active', themeColorActive)
    rootStyle.setProperty('--ant-color-link', themeColor)
    rootStyle.setProperty('--ant-color-link-hover', themeColorHover)
    rootStyle.setProperty('--ant-color-link-active', themeColorActive)
  }

  return themeColor
}

export const persistThemeColor = (color: string) => {
  const themeColor = applyThemeColor(color)

  try {
    localStorage.setItem(THEME_COLOR_KEY, themeColor)
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jetlinks-theme-color-changed', {
      detail: { color: themeColor }
    }))
  }

  return themeColor
}
