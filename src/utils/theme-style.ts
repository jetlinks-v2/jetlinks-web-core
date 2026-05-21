import {
  applyThemeColor,
  normalizeThemeColor,
  persistThemeColor
} from './theme-color'
import type { AliasToken } from 'ant-design-vue/es/theme/interface'
import { styleTokens } from '@/utils/theme-config'

export const THEME_STYLE_KEY = 'jetlinks-theme-style'
export const DEFAULT_THEME_STYLE = 'light'
const legacyThemeStyleMap: Record<string, string> = {
  light: DEFAULT_THEME_STYLE
}

const REQUIRED_ANTD_TOKEN_KEYS = [
  'colorPrimary',
  'colorInfo',
  'colorSuccess',
  'colorWarning',
  'colorError',
  'colorBgBase',
  'colorBgLayout',
  'colorBgContainer',
  'colorBgElevated',
  'colorTextBase',
  'colorText',
  'colorTextSecondary',
  'colorBorder',
  'colorBorderSecondary',
  'borderRadius',
  'borderRadiusLG',
  'borderRadiusSM',
  'boxShadow',
  'boxShadowSecondary'
] as const satisfies readonly (keyof AliasToken)[]

const OPTIONAL_ANTD_TOKEN_KEYS = [
  'fontFamily',
  'colorPrimaryBgHover',
  'colorPrimaryBorderHover',
  'colorPrimaryHover',
  'colorPrimaryActive',
  'colorPrimaryTextHover',
  'colorPrimaryText',
  'colorPrimaryTextActive',
  'colorLink',
  'colorLinkHover',
  'colorLinkActive',
  'wireframe'
] as const satisfies readonly (keyof AliasToken)[]

const ANTD_TOKEN_KEYS = [
  ...REQUIRED_ANTD_TOKEN_KEYS,
  ...OPTIONAL_ANTD_TOKEN_KEYS
] as const satisfies readonly (keyof AliasToken)[]

type RequiredThemeAntdToken = Pick<AliasToken, typeof REQUIRED_ANTD_TOKEN_KEYS[number]>
type OptionalThemeAntdToken = Partial<Pick<AliasToken, typeof OPTIONAL_ANTD_TOKEN_KEYS[number]>>

export type ThemeStyleCssVarName =
  | `--jet-theme-${string}`
  | `--layout-${string}`
  | `--chrome-${string}`
  | `--brand-${string}`
  | `--accent-${string}`
  | `--macaron-${string}`
  | `--gap-${string}`
  | `--padding-${string}`
  | `--ind-${string}`
  | `--cp-${string}`
  | `--cap-${string}`
  | `--ambient-${string}`
  | `--code-${string}`
  | `--fs-${string}`
  | `--space-${string}`
  | `--shadow-${string}`
  | `--ring-${string}`
  | `--font-${string}`
  | `--lh-${string}`
  | `--r-${string}`
  | '--primary-color'
  | '--primary-color-1'
  | '--primary-color-2'
  | '--primary-color-active'
  | '--text-color'
  | '--text-color-secondary'
  | '--text-color-disabled'
  | '--canvas'
  | '--bg'
  | '--bg-elev'
  | '--bg-sunken'
  | '--bg-hover'
  | '--bg-2'
  | '--line'
  | '--line-2'
  | '--line-strong'
  | '--ink-1'
  | '--ink-2'
  | '--ink-3'
  | '--ink-4'
  | '--ink-5'
  | '--accent'
  | '--accent-ink'
  | '--accent-soft'
  | '--danger'
  | '--danger-bg'
  | '--warning'
  | '--warning-bg'
  | '--success'
  | '--success-bg'
  | '--ok'
  | '--ok-bg'
  | '--ok-line'
  | '--warn'
  | '--warn-bg'
  | '--warn-line'
  | '--err'
  | '--err-bg'
  | '--err-line'
  | '--info'
  | '--info-bg'
  | '--info-line'
  | '--topbar-h'
  | '--sidebar-w'
  | '--row-h'
  | '--pad-y'
  | '--z-dev-tools'

export type ThemeStyleCssVars = Partial<Record<ThemeStyleCssVarName, string>>

export interface ThemeStyleToken extends RequiredThemeAntdToken, OptionalThemeAntdToken {
  label: string
  layout?: ThemeLayoutToken
  cssVars?: ThemeStyleCssVars
}

export interface ThemeLayoutToken {
  menuVariant?: 'classic' | 'compact-search'
  showMenuSearch?: boolean
  siderWidth?: number
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
  return normalizeThemeColor(getThemeStyleToken(style).colorPrimary)
}

export const getThemeStyleInitialColor = (style?: unknown, color?: string) => {
  const themeStyle = normalizeThemeStyle(style)
  const token = getThemeStyleToken(themeStyle)
  const tokenColor = getThemeStylePrimaryColor(themeStyle)
  const hasFixedPrimaryStates = Boolean(
    token.colorPrimaryHover ||
    token.colorPrimaryActive ||
    token.colorLinkHover ||
    token.colorLinkActive
  )

  return hasFixedPrimaryStates
    ? tokenColor
    : normalizeThemeColor(color) || tokenColor
}

export const getThemeStylePrimaryStateColors = (style?: unknown, color?: string) => {
  const token = getThemeStyleToken(style)
  const primaryColor = normalizeThemeColor(color) || normalizeThemeColor(token.colorPrimary)
  const primaryHover = normalizeThemeColor(token.colorPrimaryHover)
  const primaryActive = normalizeThemeColor(token.colorPrimaryActive)
  const primarySoft = normalizeThemeColor(token.cssVars?.['--primary-color-1'])
    || normalizeThemeColor(token.cssVars?.['--jet-theme-primary-soft'])
    || normalizeThemeColor(token.cssVars?.['--accent-soft'])
  const result: Partial<AliasToken> = {
    colorPrimary: primaryColor,
    colorLink: normalizeThemeColor(token.colorLink) || primaryColor
  }

  if (primarySoft || token.colorPrimaryBgHover) {
    result.colorPrimaryBgHover = normalizeThemeColor(token.colorPrimaryBgHover) || primarySoft
  }

  if (primaryHover || token.colorPrimaryBorderHover) {
    result.colorPrimaryBorderHover = normalizeThemeColor(token.colorPrimaryBorderHover) || primaryHover
  }

  if (primaryHover) {
    result.colorPrimaryHover = primaryHover
    result.colorPrimaryTextHover = normalizeThemeColor(token.colorPrimaryTextHover) || primaryHover
  } else if (token.colorPrimaryTextHover) {
    result.colorPrimaryTextHover = normalizeThemeColor(token.colorPrimaryTextHover)
  }

  if (primaryActive) {
    result.colorPrimaryActive = primaryActive
    result.colorPrimaryTextActive = normalizeThemeColor(token.colorPrimaryTextActive) || primaryActive
  } else if (token.colorPrimaryTextActive) {
    result.colorPrimaryTextActive = normalizeThemeColor(token.colorPrimaryTextActive)
  }

  if (token.colorPrimaryText) {
    result.colorPrimaryText = normalizeThemeColor(token.colorPrimaryText)
  }

  if (token.colorLinkHover || primaryHover) {
    result.colorLinkHover = normalizeThemeColor(token.colorLinkHover) || primaryHover
  }

  if (token.colorLinkActive || primaryActive) {
    result.colorLinkActive = normalizeThemeColor(token.colorLinkActive) || primaryActive
  }

  return result
}

const antdTokenKeySet = new Set<keyof AliasToken>(ANTD_TOKEN_KEYS)

export const pickAntdToken = (token: ThemeStyleToken): Partial<AliasToken> => {
  const result: Partial<AliasToken> = {}
  for (const key of ANTD_TOKEN_KEYS) {
    const val = token[key]
    if (val !== undefined) {
      result[key] = val as never
    }
  }
  return result
}

export const isAntdThemeTokenKey = (key: string): key is keyof AliasToken => {
  return antdTokenKeySet.has(key as keyof AliasToken)
}

const defaultThemeCssVars: ThemeStyleCssVars = {
  '--primary-color': 'var(--jet-theme-primary)',
  '--primary-color-1': 'var(--jet-theme-primary-soft)',
  '--primary-color-2': 'var(--jet-theme-primary-2)',
  '--primary-color-active': 'var(--jet-theme-primary-active)',
  '--text-color': 'var(--jet-theme-text)',
  '--text-color-secondary': 'var(--jet-theme-text-secondary)',
  '--text-color-disabled': 'var(--jet-theme-text-disabled)',
  '--canvas': 'var(--jet-theme-bg-layout)',
  '--bg': 'var(--jet-theme-bg-container)',
  '--bg-elev': 'var(--jet-theme-bg-elevated)',
  '--bg-sunken': 'color-mix(in srgb, var(--text-color) 4%, var(--jet-theme-bg-container))',
  '--bg-hover': 'color-mix(in srgb, var(--text-color) 6%, var(--jet-theme-bg-container))',
  '--line': 'var(--jet-theme-border-secondary)',
  '--line-strong': 'color-mix(in srgb, var(--jet-theme-border) 72%, var(--text-color) 8%)',
  '--jet-theme-text-title': 'var(--text-color)',
  '--jet-theme-text-description': 'var(--text-color-secondary)',
  '--jet-theme-text-disabled': 'var(--text-color-disabled)',
  '--ink-1': 'var(--text-color)',
  '--ink-2': 'var(--text-color-secondary)',
  '--ink-3': 'var(--text-color-disabled)',
  '--ink-4': 'var(--text-color-disabled)',
  '--accent': 'var(--primary-color)',
  '--accent-ink': '#FFFFFF',
  '--accent-soft': 'var(--primary-color-1)',
  '--jet-theme-stroke-width': '1px',
  '--ok': 'var(--jet-theme-success)',
  '--ok-bg': 'color-mix(in srgb, var(--jet-theme-success) 12%, var(--jet-theme-bg-container))',
  '--ok-line': 'color-mix(in srgb, var(--jet-theme-success) 24%, var(--jet-theme-bg-container))',
  '--warn': 'var(--jet-theme-warning)',
  '--warn-bg': 'color-mix(in srgb, var(--jet-theme-warning) 14%, var(--jet-theme-bg-container))',
  '--warn-line': 'color-mix(in srgb, var(--jet-theme-warning) 26%, var(--jet-theme-bg-container))',
  '--err': 'var(--jet-theme-error)',
  '--err-bg': 'color-mix(in srgb, var(--jet-theme-error) 12%, var(--jet-theme-bg-container))',
  '--err-line': 'color-mix(in srgb, var(--jet-theme-error) 24%, var(--jet-theme-bg-container))',
  '--info': 'var(--primary-color)',
  '--info-bg': 'var(--primary-color-1)',
  '--info-line': 'color-mix(in srgb, var(--primary-color) 22%, var(--jet-theme-bg-container))',
  '--font-sans': 'var(--jet-theme-font-family)',
  '--font-cjk': 'var(--jet-theme-font-family)',
  '--font-mono': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  '--lh-tight': '1.15',
  '--lh-snug': '1.35',
  '--lh-normal': '1.5',
  '--lh-relaxed': '1.65',
  '--lh-loose': '1.8',
  '--fs-12': '0.75rem',
  '--fs-13': '0.8125rem',
  '--fs-14': '0.875rem',
  '--fs-15': '0.9375rem',
  '--fs-16': '1rem',
  '--fs-17': '1.0625rem',
  '--fs-18': '1.125rem',
  '--fs-19': '1.1875rem',
  '--fs-20': '1.25rem',
  '--fs-21': '1.3125rem',
  '--fs-22': '1.375rem',
  '--fs-24': '1.5rem',
  '--fs-25': '1.5625rem',
  '--fs-26': '1.625rem',
  '--fs-28': '1.75rem',
  '--fs-30': '1.875rem',
  '--fs-32': '2rem',
  '--fs-34': '2.125rem',
  '--fs-36': '2.25rem',
  '--fs-38': '2.375rem',
  '--fs-40': '2.5rem',
  '--fs-42': '2.625rem',
  '--fs-44': '2.75rem',
  '--fs-46': '2.875rem',
  '--fs-48': '3rem',
  '--fs-54': '3.375rem',
  '--fs-56': '3.5rem',
  '--fs-60': '3.75rem',
  '--fs-64': '4rem',
  '--fs-90': '5.625rem',
  '--fs-100': '6.25rem',
  '--fs-tiny': 'var(--fs-12)',
  '--fs-pill': 'var(--fs-12)',
  '--fs-meta': 'var(--fs-12)',
  '--fs-caption': 'var(--fs-12)',
  '--fs-sm': 'var(--fs-13)',
  '--fs-body': 'var(--fs-14)',
  '--fs-label': 'var(--fs-12)',
  '--fs-title-4': 'var(--fs-16)',
  '--fs-title': 'var(--fs-18)',
  '--fs-h4': 'var(--fs-16)',
  '--fs-h3': 'var(--fs-18)',
  '--fs-h2': 'var(--fs-22)',
  '--fs-h1': 'var(--fs-24)',
  '--fs-display': 'var(--fs-24)',
  '--space-1': '0.25rem',
  '--space-2': '0.5rem',
  '--space-3': '0.75rem',
  '--space-4': '1rem',
  '--space-5': '1.25rem',
  '--space-6': '1.5rem',
  '--space-7': '1.75rem',
  '--space-8': '2rem',
  '--space-9': '2.25rem',
  '--space-10': '2.5rem',
  '--space-11': '2.75rem',
  '--space-12': '3rem',
  '--space-13': '3.25rem',
  '--space-section': '4rem',
  '--space-page': '6rem',
  '--space-gutter': 'clamp(1.25rem, 2.2vw, 3rem)',
  '--r-1': '0.25rem',
  '--r-2': '0.375rem',
  '--r-3': '0.5rem',
  '--r-4': '0.625rem',
  '--shadow-1': '0 1px 0 rgba(0, 0, 0, 0.03)',
  '--shadow-2': 'var(--jet-theme-shadow-secondary)',
  '--shadow-pop': 'var(--jet-theme-shadow)',
  '--shadow-hover': '0 0.125rem 0.5rem rgba(0, 0, 0, 0.06)',
  '--shadow-lifted': '0 0.375rem 1.25rem rgba(0, 0, 0, 0.06)',
  '--ring-focus': '0 0 0 0.1875rem var(--accent-soft)',
  '--ring-active': '0 0 0 0.125rem var(--accent-soft)',
  '--ring-ok': '0 0 0 0.1875rem var(--ok-bg)',
  '--ring-warn': '0 0 0 0.1875rem var(--warn-bg)',
  '--ring-err': '0 0 0 0.1875rem var(--err-bg)',
  '--ring-info': '0 0 0 0.1875rem var(--info-bg)',
  '--shadow-sticky-top': '0 -0.25rem 0.75rem rgba(0, 0, 0, 0.04)',
  '--shadow-fab': '0 0.375rem 1rem rgba(0, 0, 0, 0.12), 0 0.125rem 0.375rem rgba(0, 0, 0, 0.08)',
  '--z-dev-tools': '9999',
  '--topbar-h': '3rem',
  '--sidebar-w': '14.75rem',
  '--row-h': '2.25rem',
  '--pad-y': '0.5rem',
  '--layout-menu-bg': 'var(--jet-theme-bg-container)',
  '--layout-menu-padding': '0.5rem 0',
  '--layout-menu-item-height': '2rem',
  '--layout-menu-item-radius': '0',
  '--layout-menu-item-active-bg': 'transparent',
  '--layout-menu-item-active-color': 'var(--primary-color)',
  '--layout-menu-item-active-line': 'var(--primary-color)',
  '--layout-menu-search-bg': 'var(--jet-theme-bg-container)',
  '--layout-menu-search-border': 'var(--jet-theme-border-secondary)',
  '--chrome-bg': 'var(--bg)',
  '--chrome-elev': 'var(--bg-elev)',
  '--chrome-sunken': 'var(--bg-sunken)',
  '--chrome-hover': 'var(--bg-hover)',
  '--chrome-line': 'var(--line)',
  '--chrome-line-strong': 'var(--line-strong)',
  '--chrome-ink-1': 'var(--ink-1)',
  '--chrome-ink-2': 'var(--ink-2)',
  '--chrome-ink-3': 'var(--ink-3)',
  '--chrome-ink-4': 'var(--ink-4)',
  '--chrome-active-bg': 'transparent',
  '--chrome-active-ink': 'var(--chrome-ink-1)',
  '--chrome-active-line': 'var(--accent)',
  '--chrome-nav-font-size': 'var(--fs-14)',
  '--chrome-nav-font-weight': '400',
  '--chrome-active-font-weight': '500',
  '--chrome-brand-font-weight': '600',
  '--chrome-label-font-weight': '600',
  '--chrome-control-radius': 'var(--r-2)',
  '--chrome-popover-radius': 'var(--r-3)',
  '--ind-general': 'var(--ink-2)',
  '--ind-general-banner': 'var(--bg-sunken)',
  '--ind-general-mark': 'var(--bg-sunken)',
  '--ambient-hero': 'linear-gradient(135deg, #eef4ff, #f5f3ff, #fdf2f8)',
  '--ambient-cool': 'linear-gradient(135deg, #eef4ff, #f5f3ff)',
  '--ambient-warm': 'linear-gradient(135deg, #f5f3ff, #fdf2f8)',
  '--code-dark-bg': '#0F172A',
  '--code-dark-fg-1': '#E2E8F0',
  '--code-dark-fg-2': '#CBD5E1',
  '--code-dark-fg-3': '#94A3B8',
  '--code-dark-line': 'rgb(255 255 255 / 0.06)',
  '--code-dark-hover': 'rgb(255 255 255 / 0.08)'
}

const themeCssVarNames = new Set<ThemeStyleCssVarName>(Object.keys(defaultThemeCssVars) as ThemeStyleCssVarName[])

Object.values(themeStyleTokens).forEach((token) => {
  Object.keys(token.cssVars || {}).forEach((name) => {
    themeCssVarNames.add(name as ThemeStyleCssVarName)
  })
})

const getInitialThemeStyle = () => {
  try {
    return normalizeThemeStyle(localStorage.getItem(THEME_STYLE_KEY))
  } catch {
    return DEFAULT_THEME_STYLE
  }
}

const pxToRem = (px: number) => `${px / 16}rem`

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
  const primaryColor = normalizeThemeColor(color) || normalizeThemeColor(token.colorPrimary)
  let themeColor = ''
  const primaryStateColors = getThemeStylePrimaryStateColors(themeStyle, primaryColor)
  const primaryScale1 = normalizeThemeColor(token.cssVars?.['--primary-color-1'])
    || normalizeThemeColor(token.cssVars?.['--jet-theme-primary-soft'])
    || normalizeThemeColor(token.cssVars?.['--accent-soft'])
  const primaryScale2 = normalizeThemeColor(token.cssVars?.['--primary-color-2'])
    || normalizeThemeColor(token.cssVars?.['--jet-theme-primary-2'])
  const textColor = token.colorText
  const textColorSecondary = token.colorTextSecondary
  const textColorDisabled = token.cssVars?.['--text-color-disabled']
    || token.cssVars?.['--jet-theme-text-disabled']
    || token.colorTextSecondary
    || '#9CA3AF'

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
    rootStyle.setProperty('--jet-theme-border', token.colorBorder)
    rootStyle.setProperty('--jet-theme-border-secondary', token.colorBorderSecondary)
    // rootStyle.setProperty('--jet-theme-radius', pxToRem(token.borderRadius))
    // rootStyle.setProperty('--jet-theme-radius-lg', pxToRem(token.borderRadiusLG || token.borderRadius))
    // rootStyle.setProperty('--jet-theme-radius-sm', pxToRem(token.borderRadiusSM || token.borderRadius))
    rootStyle.setProperty('--jet-theme-shadow', token.boxShadow || 'none')
    rootStyle.setProperty('--jet-theme-shadow-secondary', token.boxShadowSecondary || 'none')
    rootStyle.setProperty('--jet-theme-font-family', token.fontFamily || 'AliRegular, sans-serif')

    themeCssVarNames.forEach((name) => {
      const value = defaultThemeCssVars[name]
      if (value === undefined) {
        rootStyle.removeProperty(name)
      } else {
        rootStyle.setProperty(name, value)
      }
    })

    rootStyle.setProperty('--text-color', textColor)
    rootStyle.setProperty('--text-color-secondary', textColorSecondary)
    rootStyle.setProperty('--text-color-disabled', textColorDisabled)
    rootStyle.setProperty('--jet-theme-text-title', 'var(--text-color)')
    rootStyle.setProperty('--jet-theme-text', 'var(--text-color)')
    rootStyle.setProperty('--jet-theme-text-secondary', 'var(--text-color-secondary)')
    rootStyle.setProperty('--jet-theme-text-description', 'var(--text-color-secondary)')
    rootStyle.setProperty('--jet-theme-text-disabled', 'var(--text-color-disabled)')

    themeColor = applyThemeColor(primaryColor, {
      hover: primaryStateColors.colorPrimaryHover,
      active: primaryStateColors.colorPrimaryActive,
      soft: primaryScale1,
      scale1: primaryScale1,
      scale2: primaryScale2
    })

    Object.entries(token.cssVars || {}).forEach(([name, value]) => {
      rootStyle.setProperty(name, value)
    })
  } else {
    themeColor = applyThemeColor(primaryColor, {
      hover: primaryStateColors.colorPrimaryHover,
      active: primaryStateColors.colorPrimaryActive,
      soft: primaryScale1,
      scale1: primaryScale1,
      scale2: primaryScale2
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
