# Theme Configuration Guide

This directory documents how to add a theme style for the JetLinks shell.
The runtime entry is still `src/utils/theme-config.ts`.

## Add a Theme

1. Add a new item to `styleTokens` in `src/utils/theme-config.ts`.
2. Keep the object typed by `ThemeStyleToken`; missing required Ant Design token fields must fail TypeScript.
3. Provide Ant Design seed/map token fields first. Only fields accepted by Ant Design Vue should be written at the top level.
4. Add `layout` only when the theme needs shell layout differences.
5. Add `cssVars` for shell and custom page variables. Do not put Ant Design Vue token fields in `cssVars`.

```ts
newTheme: {
  label: '新主题',
  colorPrimary: '#1677FF',
  colorInfo: '#1677FF',
  colorSuccess: '#52C41A',
  colorWarning: '#FAAD14',
  colorError: '#FF4D4F',
  colorBgBase: '#FFFFFF',
  colorBgLayout: '#F5F5F5',
  colorBgContainer: '#FFFFFF',
  colorBgElevated: '#FFFFFF',
  colorTextBase: '#000000',
  colorText: '#1A1A1A',
  colorTextSecondary: '#6B7280',
  colorBorder: '#D9D9D9',
  colorBorderSecondary: '#F0F0F0',
  borderRadius: 6,
  borderRadiusLG: 8,
  borderRadiusSM: 4,
  boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08)',
  boxShadowSecondary: '0 2px 8px rgba(0, 0, 0, 0.06)'
}
```

## Menu Variants

`layout.menuVariant` controls the visual shell menu variant.

| Variant | Behavior |
| --- | --- |
| `classic` | Existing menu style. This is the default when no variant is set. |
| `compact-search` | Compact white menu with a search input and left active indicator. |

Use `compact-search` when a theme should match the second menu style:

```ts
layout: {
  menuVariant: 'compact-search',
  showMenuSearch: true,
  siderWidth: 224
}
```

The search input is visual-only. It does not filter menu data.

## Layout CSS Variables

Menu variants are styled through CSS variables in `cssVars`.
Set only the variables that differ from the defaults.

```ts
cssVars: {
  '--layout-menu-bg': '#FFFFFF',
  '--layout-menu-padding': '0.5rem 0.625rem',
  '--layout-menu-item-height': '2rem',
  '--layout-menu-item-radius': '0.375rem',
  '--layout-menu-item-active-bg': '#F1F2F4',
  '--layout-menu-item-active-color': '#1D1F24',
  '--layout-menu-item-active-line': 'var(--jet-theme-primary)',
  '--layout-menu-search-bg': '#F6F7F9',
  '--layout-menu-search-border': '#E6E7EB'
}
```

`applyThemeStyle()` writes default values for these variables before applying the active theme. This prevents variables from one theme leaking into another when users switch themes.

## Typography And Spacing Tokens

Text color tokens follow the product typography rules:

| Usage | Token | Value |
| --- | --- | --- |
| 标题以及主要文本 | `--jet-theme-text-title`, `--jet-theme-text`, `--ink-1` | `#1A1A1A` |
| 次要文字 / 文本描述 | `--jet-theme-text-secondary`, `--jet-theme-text-description`, `--ink-2` | `#6B7280` |
| 辅助文字 / 禁用 | `--jet-theme-text-disabled`, `--ink-3`, `--ink-4` | `#9CA3AF` |

Font size tokens keep `0.75rem` (12px) as the minimum. Prefer semantic aliases in page code:

| Usage | Token | Value |
| --- | --- | --- |
| 特殊强调标题 | `--fs-display`, `--fs-h1` | `1.5rem` |
| 板块内容标题 | `--fs-h2` | `1.375rem` |
| 特殊标题 / 自定义标题 | `--fs-h3` | `1.125rem` |
| 文案标题 / 弹窗标题 | `--fs-h4` | `1rem` |
| 主要内容文字 / 按钮文字 / 导航文字 | `--fs-body` | `0.875rem` |
| 提示文字 / 标签文字 / 次要文字 | `--fs-meta`, `--fs-label`, `--fs-tiny` | `0.75rem` |

Spacing tokens use a 0.25rem (4px) scale. Prefer `--space-*` instead of ad hoc pixel values, and keep newly added spacing values as multiples of 4.

## Consistency Contract

`ThemeStyleToken` separates three responsibilities:

- Ant Design Vue token fields: required top-level fields such as `colorPrimary`, `colorBgContainer`, `colorText`, `borderRadius`, and `boxShadow`.
- JetLinks shell layout: optional `layout`, for menu variants and shell size decisions.
- CSS variables: optional `cssVars`, for JetLinks design primitives and shell-only variables.

`App.vue` passes only `pickAntdToken(themeStyleToken)` to Ant Design Vue. This prevents non-AntDV fields such as `label`, `layout`, or `cssVars` from being treated as component theme tokens.

`applyThemeStyle()` resets all known theme CSS variables before applying the selected theme. If a variable exists only in one theme, switching away from that theme removes it unless a default value is defined in `defaultThemeCssVars`.

Allowed `cssVars` names are constrained by `ThemeStyleCssVarName`. Prefer existing families:

- `--jet-theme-*` for JetLinks public theme variables.
- `--layout-*` for shell menu layout.
- `--chrome-*`, `--canvas`, `--bg`, `--line`, `--ink-*`, `--accent*` for existing design primitives.
- `--space-*`, `--fs-*`, `--r-*`, `--shadow-*`, `--ring-*` for shared primitive scales.

## Less Variable Migration

Runtime theme styles must not depend on Less compile-time theme variables. Use the JetLinks CSS variables instead:

| Legacy Less variable | Runtime variable |
| --- | --- |
| `@primary-color` | `var(--jet-theme-primary, #1677FF)` |
| `@primary-color-hover` | `var(--jet-theme-primary-hover, #4096FF)` |
| `@primary-color-active` | `var(--jet-theme-primary-active, #0958D9)` |
| `@primary-2` or weak primary backgrounds | `var(--jet-theme-primary-soft, #E6F4FF)` |

For old Ant Design CSS variables, prefer JetLinks first and keep Ant Design as a fallback:

```css
color: var(--jet-theme-primary, var(--ant-color-primary, #1677FF));
background: var(--info-bg, var(--ant-color-info-bg, #E6F4FF));
```

## Rules

- Do not put API requests or menu filtering in theme config.
- Do not mix Ant Design Vue token names into `cssVars`.
- Do not add new `@primary-color` usages for runtime theme styles.
- Prefer CSS variables over theme-specific selectors for JetLinks shell and page primitives.
- Add a new `menuVariant` only when CSS variables cannot describe the visual difference.
- Keep `styleTokens` as the runtime source of truth, even if theme files are split later.
