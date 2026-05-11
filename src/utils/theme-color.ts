import theme from '@theme-config'

export const THEME_COLOR_KEY = 'jetlinks-theme-color'
export const DEFAULT_THEME_COLOR = '#1677FF'

const hexColorReg = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

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

export const applyThemeColor = (color?: string) => {
  const themeColor = normalizeThemeColor(color) || getDefaultThemeColor()

  if (typeof document !== 'undefined') {
    const rootStyle = document.documentElement.style
    rootStyle.setProperty('--jet-theme-primary', themeColor)
    rootStyle.setProperty('--jet-theme-primary-hover', mixColor(themeColor, '#FFFFFF', 0.18))
    rootStyle.setProperty('--jet-theme-primary-active', mixColor(themeColor, '#000000', 0.12))
    rootStyle.setProperty('--jet-theme-primary-soft', mixColor(themeColor, '#FFFFFF', 0.92))
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
