import { modules } from '@jetlinks-web-core/utils/modules'
import type {
  ContentPanelOverride,
  ContentPanelOverrides,
} from '@jetlinks-web-core/types/content-panel'

/**
 * 代码侧「页面是否由布局壳层套 `ContentPanel`」的声明表。
 *
 * 为什么不用路由 `meta.contentPanel`：菜单驱动的路由，其 meta 由后端菜单数据生成
 * （`utils/menu.ts` 的 `handleRoute` → `handleMeta`），而菜单只在初始化流程
 * （`views/init-home` 的 `updateMenus`）推送一次。把开关写进 `baseMenu.json` 的结果是
 * **每改一个页面都要重新初始化菜单**，升级不友好。
 *
 * 这里把声明挪到代码侧：模块在自己的 `index.ts` 里实现 `getContentPanelOverrides()`。
 */
const overrides = new Map<string, ContentPanelOverride>()

let collected = false

/** 惰性收集一次。`modules()` 走 `import.meta.glob(..., { eager: true })`，是同步的。 */
const collect = () => {
  if (collected) return
  collected = true

  Object.values(modules()).forEach((item) => {
    const declared: ContentPanelOverrides | undefined =
      item.default.getContentPanelOverrides?.()

    if (!declared) return

    Object.entries(declared).forEach(([key, value]) => {
      if (!key || value === undefined) return
      overrides.set(key, value)
    })
  })
}

/**
 * 按页面标识取代码侧声明。
 *
 * 传入的 keys 是同一页面可能出现的多种标识（路由 `name`、匹配记录的 `name` / `path` /
 * `meta.componentCode`）。菜单若配了 `routeName`，路由 `name` 就不等于菜单 `code`，
 * 多留几个别名可以避免「声明了却没生效」这种排查成本很高的问题。
 */
export const resolveContentPanelOverride = (
  keys: readonly (string | undefined | null)[],
): ContentPanelOverride | undefined => {
  collect()

  for (const key of keys) {
    if (!key) continue
    const hit = overrides.get(key)
    if (hit !== undefined) return hit
  }

  return undefined
}
