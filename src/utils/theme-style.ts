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
  | '--canvas'
  | '--bg'
  | '--bg-elev'
  | '--bg-sunken'
  | '--bg-hover'
  | '--line'
  | '--line-strong'
  | '--ink-1'
  | '--ink-2'
  | '--ink-3'
  | '--ink-4'
  | '--accent'
  | '--accent-ink'
  | '--accent-soft'
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
  '--canvas': 'var(--jet-theme-bg-layout)',
  '--bg': 'var(--jet-theme-bg-container)',
  '--bg-elev': 'var(--jet-theme-bg-elevated)',
  '--bg-sunken': 'color-mix(in srgb, var(--jet-theme-text) 4%, var(--jet-theme-bg-container))',
  '--bg-hover': 'color-mix(in srgb, var(--jet-theme-text) 6%, var(--jet-theme-bg-container))',
  '--line': 'var(--jet-theme-border-secondary)',
  '--line-strong': 'color-mix(in srgb, var(--jet-theme-border) 72%, var(--jet-theme-text) 8%)',
  '--ink-1': 'var(--jet-theme-text)',
  '--ink-2': 'var(--jet-theme-text-secondary)',
  '--ink-3': 'color-mix(in srgb, var(--jet-theme-text-secondary) 74%, transparent)',
  '--ink-4': 'color-mix(in srgb, var(--jet-theme-text-secondary) 52%, transparent)',
  '--accent': 'var(--jet-theme-primary)',
  '--accent-ink': '#FFFFFF',
  '--accent-soft': 'var(--jet-theme-primary-soft)',
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
  '--info': 'var(--jet-theme-primary)',
  '--info-bg': 'color-mix(in srgb, var(--jet-theme-primary) 10%, var(--jet-theme-bg-container))',
  '--info-line': 'color-mix(in srgb, var(--jet-theme-primary) 22%, var(--jet-theme-bg-container))',
  '--font-sans': 'var(--jet-theme-font-family)',
  '--font-cjk': 'var(--jet-theme-font-family)',
  '--font-mono': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  '--lh-tight': '1.15',
  '--lh-snug': '1.35',
  '--lh-normal': '1.5',
  '--lh-relaxed': '1.65',
  '--lh-loose': '1.8',
  '--fs-9': '9px',
  '--fs-9-5': '9.5px',
  '--fs-10': '10px',
  '--fs-10-5': '10.5px',
  '--fs-11': '11px',
  '--fs-11-5': '11.5px',
  '--fs-12': '12px',
  '--fs-12-5': '12.5px',
  '--fs-13': '13px',
  '--fs-13-5': '13.5px',
  '--fs-14': '14px',
  '--fs-15': '15px',
  '--fs-16': '16px',
  '--fs-17': '17px',
  '--fs-18': '18px',
  '--fs-19': '19px',
  '--fs-20': '20px',
  '--fs-22': '22px',
  '--fs-24': '24px',
  '--fs-26': '26px',
  '--fs-28': '28px',
  '--fs-tiny': 'var(--fs-9-5)',
  '--fs-pill': 'var(--fs-10-5)',
  '--fs-meta': 'var(--fs-11)',
  '--fs-body': 'var(--fs-12)',
  '--fs-label': 'var(--fs-13)',
  '--fs-h4': 'var(--fs-14)',
  '--fs-h3': 'var(--fs-16)',
  '--fs-h2': 'var(--fs-18)',
  '--fs-h1': 'var(--fs-22)',
  '--fs-display': 'var(--fs-26)',
  '--space-1': '2px',
  '--space-2': '4px',
  '--space-3': '6px',
  '--space-4': '8px',
  '--space-5': '10px',
  '--space-6': '12px',
  '--space-7': '14px',
  '--space-8': '16px',
  '--space-9': '20px',
  '--space-10': '24px',
  '--space-11': '32px',
  '--space-12': '40px',
  '--space-13': '48px',
  '--space-section': '64px',
  '--space-page': '96px',
  '--space-gutter': 'clamp(20px, 2.2vw, 48px)',
  '--r-1': '4px',
  '--r-2': '6px',
  '--r-3': '8px',
  '--r-4': '10px',
  '--shadow-1': '0 1px 0 rgba(0, 0, 0, 0.03)',
  '--shadow-2': 'var(--jet-theme-shadow-secondary)',
  '--shadow-pop': 'var(--jet-theme-shadow)',
  '--shadow-hover': '0 2px 8px rgba(0, 0, 0, 0.06)',
  '--shadow-lifted': '0 6px 20px rgba(0, 0, 0, 0.06)',
  '--ring-focus': '0 0 0 3px var(--accent-soft)',
  '--ring-active': '0 0 0 2px var(--accent-soft)',
  '--ring-ok': '0 0 0 3px var(--ok-bg)',
  '--ring-warn': '0 0 0 3px var(--warn-bg)',
  '--ring-err': '0 0 0 3px var(--err-bg)',
  '--ring-info': '0 0 0 3px var(--info-bg)',
  '--shadow-sticky-top': '0 -4px 12px rgba(0, 0, 0, 0.04)',
  '--shadow-fab': '0 6px 16px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)',
  '--z-dev-tools': '9999',
  '--topbar-h': '48px',
  '--sidebar-w': '236px',
  '--row-h': '36px',
  '--pad-y': '8px',
  '--layout-menu-bg': 'var(--jet-theme-bg-container)',
  '--layout-menu-padding': '6px 0',
  '--layout-menu-item-height': '40px',
  '--layout-menu-item-radius': '0',
  '--layout-menu-item-active-bg': 'transparent',
  '--layout-menu-item-active-color': 'var(--jet-theme-primary)',
  '--layout-menu-item-active-line': 'var(--jet-theme-primary)',
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
  '--chrome-nav-font-size': 'var(--fs-13)',
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

    themeCssVarNames.forEach((name) => {
      const value = defaultThemeCssVars[name]
      if (value === undefined) {
        rootStyle.removeProperty(name)
      } else {
        rootStyle.setProperty(name, value)
      }
    })

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
