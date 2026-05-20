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

## 暂不替换与待确认变量

| Token | Decision |
| --- | --- |
| `--jet-theme-primary-hover` | Keep as compatibility or map to a dedicated hover token later. Do not map it to `--primary-color-2`. |
| `--primary-color-hover` | Existing compatibility token written by `theme-color.ts`; keep until hover naming is confirmed. |
| `--jet-theme-primary-3`, `--jet-theme-primary-4`, `--jet-theme-primary-5` | Keep as compatibility color scales until the full primary scale is defined. |
| `--ink-5` | Low-frequency weak text or divider helper. Confirm the concrete semantic use before replacing. |
| `--color-jet-*` | Tailwind `@theme` mapping layer. Do not treat as a primary migration target in this pass. |
| `--radius-jet*` | Tailwind `@theme` mapping layer. Do not treat as a primary migration target in this pass. |
| `--shadow-jet*` | Tailwind `@theme` mapping layer. Do not treat as a primary migration target in this pass. |

## 后续实施规则

When continuing module migration, keep this order:

1. Keep `jetlinks-web-core/src/utils/theme-style.ts`, `jetlinks-web-core/src/utils/theme-config.ts`, `jetlinks-web-core/src/utils/theme-color.ts`, and `jetlinks-web-core/src/style.css` aligned.
2. Replace references in `jetlinks-web-core` and `modules/*` after runtime sources expose the new variables.
3. Prefer the new variables in new code.
4. Keep old variables as aliases during the transition unless a later cleanup task explicitly removes them.
5. Run a search before and after module replacement:

```bash
rg "--jet-theme-primary|--accent|--info|--jet-theme-text|--ink-" jetlinks-web-core modules
```

6. Run the core build after code replacement:

```bash
pnpm -F jetlinks-web-core build
```

## 本轮落地与验证

- `jetlinks-web-core/src/style.css` now defines the new primary and text variables as static defaults, with legacy variables kept as aliases.
- `jetlinks-web-core/src/utils/theme-color.ts` now writes the new primary variables first, then writes legacy primary variables for compatibility.
- `jetlinks-web-core/src/utils/theme-style.ts` now resets known variables, writes concrete text tokens through the new names, and keeps old text tokens as aliases.
- `jetlinks-web-core/src/utils/theme-config.ts` now uses the new token names for the AI theme and maps old token names back to them where they are part of the migration table.
- `jetlinks-web-core/src/utils/theme-config/README.md` now recommends the new token names for theme authoring.
- Verified that hover tokens are not mapped to `--primary-color-2`.
- Verified with:

```bash
pnpm -F jetlinks-web-core build
```
