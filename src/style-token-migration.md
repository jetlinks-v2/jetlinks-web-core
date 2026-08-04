# Style Token Migration

This file records the naming migration for JetLinks UI style tokens.
The core runtime token sources now expose the new variables and keep the old variables as aliases.
Business module references are still being migrated gradually.

## 命名规范

Theme color tokens should use the product-level `--primary-color` family:

| Usage | New token |
| --- | --- |
| 主主题色 | `--primary-color` |
| 主题浅色色阶 1 | `--primary-color-1` |
| 主题浅色色阶 2 | `--primary-color-2` |
| 主题激活态 | `--primary-color-active` |

Text color tokens should use a three-level text family:

| Usage | New token |
| --- | --- |
| 标题以及主要文本 | `--text-color` |
| 次要文字 / 文本描述 | `--text-color-secondary` |
| 辅助文字 / 禁用文字 | `--text-color-disabled` |

## 主题色映射

| New token | Replaces old tokens | Notes |
| --- | --- | --- |
| `--primary-color` | `--jet-theme-primary`, `--accent`, `--info` | Main brand/action color. |
| `--primary-color-1` | `--jet-theme-primary-1`, `--jet-theme-primary-soft`, `--accent-soft`, `--info-bg` | Weak primary background or first light scale. |
| `--primary-color-2` | `--jet-theme-primary-2` | Second light primary scale. It does not mean hover. |
| `--primary-color-active` | `--jet-theme-primary-active` | Active/pressed primary state. |

Core runtime status: `style.css`, `theme-style.ts`, `theme-config.ts`, and `theme-color.ts` expose these new variables.
`--primary-color-1` keeps the weak primary background visual used by previous soft tokens.

## 文字色映射

| New token | Replaces old tokens | Notes |
| --- | --- | --- |
| `--text-color` | `--jet-theme-text`, `--jet-theme-text-title`, `--ink-1` | Primary readable text and title text. |
| `--text-color-secondary` | `--jet-theme-text-secondary`, `--jet-theme-text-description`, `--ink-2` | Secondary text and descriptive text. |
| `--text-color-disabled` | `--jet-theme-text-disabled`, `--ink-3`, `--ink-4` | Helper, placeholder, disabled, and weak text. |

Core runtime status: `style.css`, `theme-style.ts`, and `theme-config.ts` expose these new variables and keep the old text tokens as aliases.

## 值源与首帧契约

Token values follow one direction:

1. `jetlinks-web-core/src/utils/theme-config.ts` is the runtime value source for `light`, `dark`, and `ai`.
2. `jetlinks-web-core/src/utils/theme-style.ts` owns the complete reset set used before a theme override is applied. Every theme-dependent variable must be registered there so switching themes cannot retain a stale value.
3. `jetlinks-web-core/src/style.css` mirrors the `light` runtime values as the static first-frame fallback. It must not introduce a second palette.

When a shared value changes, update the runtime value source, reset set, and static fallback in the same change. Theme-specific colors may differ, but geometry and semantic names stay stable.

## 圆角双层契约

The semantic radius scale is fixed and theme-independent:

| Token | Value | Usage |
| --- | --- | --- |
| `--r-1` | `4px` | Small controls and subtle corners. |
| `--r-2` | `6px` | Default controls. |
| `--r-3` | `8px` | Menu items and compact containers. |
| `--r-4` | `10px` | Larger surfaces. |
| `--r-pill` | `999px` | Pills, badges, and fully rounded tracks only. |

`--r-4` is not a pill token. The AI theme follows the same `4/6/8/10px` scale and uses `--r-pill` for pill semantics.

The legacy public contract remains separate:

| Legacy token | Preserved value |
| --- | --- |
| `--jet-theme-radius-sm` | `10px` |
| `--jet-theme-radius` | `12px` |
| `--jet-theme-radius-lg` | `14px` |

The Tailwind `--radius-jet*` mapping continues to point to those legacy tokens. Do not redirect `--r-1..4` to `--jet-theme-radius*`; doing so would turn a semantic scale migration into a site-wide radius change.

## Menu 与 Chrome 契约

The project workspace uses a shared full-canvas background contract. `--layout-workspace-bg` keeps the canvas geometry stable while allowing each theme to supply its own wash: light uses the Figma-aligned `#F4F7FB` base with broad blue washes at the top-right and bottom-left, dark layers low-opacity blue washes over the dark canvas, and AI layers low-opacity purple and cyan washes over the AI canvas. The runtime source, reset set, and first-frame fallback must stay synchronized under the value-source contract above.

The project runtime now uses the shared `BasicLayoutPage` and server-returned menus. The shared `--layout-menu-item-active-line-width: 2px` contract remains available to layouts or secondary navigation that explicitly render an active line; it does not require every first-level menu to show one.

Figma node `4543:4144` maps to these geometry tokens:

| Token | Value |
| --- | --- |
| `--layout-workspace-bg` | Theme-specific full-canvas background; reset fallback is `var(--canvas)` |
| `--layout-menu-width` | `10.875rem` (`174px`) |
| `--layout-menu-collapsed-width` | `64px` (fixed fallback; Figma has no collapsed-state measurement) |
| `--layout-menu-padding-x` / `--layout-menu-padding-y` | `1rem` / `0.625rem` |
| `--layout-menu-item-height` / `--layout-menu-item-gap` | `2.25rem` / `0.25rem` |
| `--layout-menu-item-padding-x` / `--layout-menu-item-padding-y` | `0.5rem` / `0.5rem` |
| `--layout-menu-item-icon-size` | `1rem` |
| `--layout-menu-item-font-size` / `--layout-menu-item-line-height` | `0.875rem` / `1.25rem` |
| `--layout-menu-item-radius` | `var(--r-3)` |
| `--layout-menu-item-active-line-width` | `2px` |
| `--layout-menu-footer-height` | `2.625rem` |
| `--layout-menu-footer-padding-x` / `--layout-menu-footer-padding-y` | `0.75rem` / `0.625rem` |
| `--layout-menu-footer-icon-size` / `--layout-menu-footer-line-height` | `1rem` / `1.375rem` |

The light-theme active state uses `#1E72F0`, the weak `#E2EDFF` background with its Figma white overlay, and the `#E1EBF9` full border. Dark and AI themes keep the same geometry and use their theme-equivalent weak background, border, and accent colors. `--chrome-focus-ring` aliases the semantic `--ring-focus`; menu code should not create a separate raw focus shadow.

Existing `--layout-menu-search-*` and `--chrome-*` names remain the shared search/chrome contract. Composite tokens such as `--layout-menu-padding`, `--layout-menu-item-padding`, and `--layout-menu-footer-padding` are derived from their axis tokens so consumers can use either the shorthand or a single axis without duplicating dimensions.

`--layout-menu-width` is specific to the Figma-aligned project workspace menu. It does not alias or replace the broader `--sidebar-w` shell contract, which remains `14rem`; other layouts keep their existing width until they explicitly adopt the project-menu token.

`--layout-menu-bg` remains the current theme's container background for shared layouts. Project-specific transparent menu treatment should be expressed by the active route layout class or theme token override, not by a SaaS-local project shell.

`--chrome-header-height` is the fixed `56px` Figma header measurement. Responsive layout code may take the maximum of this token and an existing large-screen profile, but it must not convert the token itself to `rem` and inflate the 2K header.

## 浮层层级

| Token | Value | Usage |
| --- | --- | --- |
| `--z-modal` | `1000` | Business modal. |
| `--z-drawer` | `1100` | Custom drawer. |
| `--z-toast` | `1200` | Notification and toast. |
| `--z-dev-tools` | `9999` | Developer tools that must remain reachable. |

`--jet-z-index-custom-drawer` is a one-way compatibility alias to `--z-drawer`. New code must use `--z-drawer`; the semantic token must never point back to the legacy name.

The invalid name `--jet-theme-border-color` is not part of the compatibility layer. Existing references migrate to `--line` with `--jet-theme-border-secondary` as a local fallback; do not add an alias for the invalid name.

## 暂不替换与待确认变量

| Token | Decision |
| --- | --- |
| `--jet-theme-primary-hover` | Keep as compatibility or map to a dedicated hover token later. Do not map it to `--primary-color-2`. |
| `--primary-color-hover` | Existing compatibility token written by `theme-color.ts`; keep until hover naming is confirmed. |
| `--jet-theme-primary-3`, `--jet-theme-primary-4`, `--jet-theme-primary-5` | Keep as compatibility color scales until the full primary scale is defined. |
| `--ink-5` | Low-frequency weak text or divider helper. Confirm the concrete semantic use before replacing. |
| `--color-jet-*` | Tailwind `@theme` mapping layer. Do not treat as a primary migration target in this pass. |
| `--radius-jet*` | Tailwind `@theme` mapping for the preserved `10/12/14px` legacy radius contract. Do not map it to `--r-1..4`. |
| `--shadow-jet*` | Tailwind `@theme` mapping layer. Do not treat as a primary migration target in this pass. |

## 后续实施规则

When continuing module migration, keep this order:

1. Keep `jetlinks-web-core/src/utils/theme-style.ts`, `jetlinks-web-core/src/utils/theme-config.ts`, `jetlinks-web-core/src/utils/theme-color.ts`, and `jetlinks-web-core/src/style.css` aligned.
2. Replace references in `jetlinks-web-core` and `modules/*` after runtime sources expose the new variables.
3. Prefer the new variables in new code.
4. Keep old variables as aliases during the transition unless a later cleanup task explicitly removes them.
5. Run a search before and after module replacement:

```bash
rg -- "--jet-theme-primary|--accent|--info|--jet-theme-text|--ink-" jetlinks-web-core modules
```

6. Run the core build after code replacement:

```bash
pnpm -F jetlinks-web-core build
```

## 别名删除条件

Compatibility aliases may be removed only when all of these conditions are met:

1. `rg` finds no production, test, documentation, or downstream package consumer of the legacy name.
2. Runtime theme writers, static fallbacks, Tailwind mappings, and published module examples all use the semantic name.
3. The removal is announced through the normal release/deprecation boundary; an unreleased in-branch implementation does not justify keeping a second alias direction.

For `--jet-z-index-custom-drawer`, migrate the existing custom drawer consumer first, then remove the alias only after the repository and downstream package check is clean. The `--jet-theme-radius*` and `--radius-jet*` contracts are broader public compatibility layers and are not candidates for opportunistic removal in a menu-style task.

## 本轮落地与验证

- `jetlinks-web-core/src/style.css` now defines the new primary and text variables as static defaults, with legacy variables kept as aliases.
- `jetlinks-web-core/src/utils/theme-color.ts` now writes the new primary variables first, then writes legacy primary variables for compatibility.
- `jetlinks-web-core/src/utils/theme-style.ts` now resets known variables, writes concrete text tokens through the new names, and keeps old text tokens as aliases.
- `jetlinks-web-core/src/utils/theme-config.ts` now uses the new token names for the AI theme and maps old token names back to them where they are part of the migration table.
- `jetlinks-web-core/src/utils/theme-config/README.md` now recommends the new token names for theme authoring.
- `style.css` mirrors the light-theme background layers, borders, typography line heights, shadows, focus/status rings, radius scale, menu/chrome values, and overlay levels to prevent a first-frame theme jump.
- `theme-style.ts` resets the complete menu/chrome/z-index contract before applying a theme; `theme-config.ts` supplies theme-specific state colors while keeping Figma geometry stable.
- `--r-pill` now carries pill semantics; `--r-4` remains the fourth `10px` radius step in every theme.
- `--r-1..4` use fixed pixel values, and the AI popover radius is aligned with light/dark, so responsive root-font scaling cannot change semantic corner geometry.
- Static/reset light `--ambient-*` values are aligned with the light runtime palette.
- Static/reset light accent helpers, brand-mark colors, and the `--space-0/card/card-lg` spacing aliases are aligned with the runtime value source.
- The four invalid `--jet-theme-border-color` references now consume the valid semantic line token instead of creating another legacy alias.
- Verified that hover tokens are not mapped to `--primary-color-2`.
- Figma file `ZkHES1ufCdNNaNbxCbHBRd` was readable. Root node `4543:4141` and sidebar node `4543:4144` were checked before finalizing the menu mapping.
- Focused Less compilation, undefined-variable/literal scans, and whitespace checks passed. The changed menu files contain no new raw hex color, bare z-index, isolated dimension, invalid variable, or CSS image-mask implementation:

```bash
pnpm exec lessc jetlinks-web-core/src/style/layout.less
git -C jetlinks-web-core diff --check
git -C modules/saas-manager-ui diff --check
```

- `pnpm exec vue-tsc --noEmit --pretty false -p jetlinks-web-core/tsconfig.json` does not pass the current workspace baseline. It reports 441 existing diagnostics in build plugins, Monaco integration, third-party declarations, and legacy Vue components; filtering the output to this task's changed TypeScript and Vue files reports no diagnostics.
- `pnpm --filter jetlinks-web-core build` passed in about 4 minutes 19 seconds. It retained existing unresolved runtime asset, mixed static/dynamic import, CSS comment, and large-chunk warnings.
- `pnpm --filter saas-manager-ui build` passed in about 1 minute 58 seconds. It retained the existing Rollup option, CSS comment, and large-chunk warnings.
- The authenticated project workspace at `http://localhost:9101/ht_device/#/system-setting/dashboard` was checked in Chrome at 1440x820. Light, dark, and AI themes, menu hover, search focus/filter/clear, expanded and collapsed sidebars, and secondary settings navigation were exercised. The rendered header was 56px high; sidebar widths were 174px and 64px; the brand mark was 24px; the selected primary item had no marker; and direct Header/Sider layers were transparent without divider shadows. The console contained no errors, only existing Vue/intlify warnings.
