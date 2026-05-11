# Theme Configuration Guide

This directory documents how to add a theme style for the JetLinks shell.
The runtime entry is still `src/utils/theme-config.ts`.

## Add a Theme

1. Add a new item to `styleTokens` in `src/utils/theme-config.ts`.
2. Keep the object typed by `ThemeStyleToken`.
3. Provide Ant Design seed/map token fields first.
4. Add `layout` only when the theme needs shell layout differences.
5. Add `cssVars` for shell and custom page variables.

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
  colorText: 'rgba(0, 0, 0, 0.88)',
  colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
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
  '--layout-menu-padding': '8px 10px',
  '--layout-menu-item-height': '32px',
  '--layout-menu-item-radius': '6px',
  '--layout-menu-item-active-bg': '#F1F2F4',
  '--layout-menu-item-active-color': '#1D1F24',
  '--layout-menu-item-active-line': 'var(--jet-theme-primary)',
  '--layout-menu-search-bg': '#F6F7F9',
  '--layout-menu-search-border': '#E6E7EB'
}
```

`applyThemeStyle()` writes default values for these variables before applying the active theme. This prevents variables from one theme leaking into another when users switch themes.

## Rules

- Do not put API requests or menu filtering in theme config.
- Prefer CSS variables over theme-specific selectors.
- Add a new `menuVariant` only when CSS variables cannot describe the visual difference.
- Keep `styleTokens` as the runtime source of truth, even if theme files are split later.
