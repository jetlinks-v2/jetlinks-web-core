/**
 * 页面级内容面板的声明类型。
 *
 * 判断「某个路由页面是否由布局壳层套 `ContentPanel`」的依据只来自代码侧：
 * 模块在自己的 `index.ts` 里实现 `getContentPanelOverrides()`，返回本模块的页面清单。
 *
 * 为什么不用路由 `meta.contentPanel`：菜单驱动的路由，其 meta 由后端菜单数据生成
 * （`utils/menu.ts` 的 `handleRoute` → `handleMeta`），而菜单只在初始化流程推送一次。
 * 把开关放在菜单里意味着**每改一个页面都要重新初始化菜单**，升级不友好。
 */

/** 单个页面的内容面板配置。 */
export interface ContentPanelConfig {
  /** `false` 表示布局壳层不包裹面板，由页面自绘背景。 */
  enabled?: boolean
  /** 覆盖面板内边距，单位为 px。 */
  padding?: number
  /** 面板标题。 */
  title?: string
  /** `false` 保留面板留白与圆角，但背景透明、去掉模糊与阴影。 */
  background?: boolean
}

/** 单个页面的覆盖声明：`false` 等价于 `{ enabled: false }`。 */
export type ContentPanelOverride = boolean | ContentPanelConfig

/**
 * 页面清单：键可以是路由 `name`（菜单配的 `code`）或路由 `path`。
 *
 * 解析时会用「路由 name / 匹配记录的 name / path / componentCode」多别名去匹配，
 * 避免菜单配了 `routeName` 导致 `name !== code` 时声明静默失效。
 */
export type ContentPanelOverrides = Record<string, ContentPanelOverride>
