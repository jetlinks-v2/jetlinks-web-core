import { computed } from 'vue'
import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'
import type { ContentPanelOverride } from '@jetlinks-web-core/types/content-panel'
import { resolveContentPanelOverride } from '../runtime/contentPanelOverrides'
import { useBasicLayoutVariant } from './useBasicLayoutVariant'
import type { BasicLayoutVariant } from '../runtime/layoutVariant'

/**
 * 项目布局下的内容面板默认开关：**默认开启**。
 *
 * 项目布局（`ProjectLayoutPage`）统一给每个路由页面套 `ContentPanel`；
 * 不想要的页面由模块在 `getContentPanelOverrides()` 里声明。
 */
export const DEFAULT_CONTENT_PANEL_ENABLED = true

/**
 * 允许布局壳层统一提供内容面板的布局变体：**只有项目布局**。
 *
 * - 租户端复用同一个 `BasicLayoutShell`，但保持引入内容面板之前的内容区结构，壳层不包裹面板；
 * - 应用端 `ApplicationLayoutPage` 的内容区不走统一面板，由该壳层自己决定。
 *
 * 因此「是否包裹面板」的判定入口只有这里，避免同一份能力在多个壳层各自漂移。
 */
export const CONTENT_PANEL_LAYOUT_VARIANTS: readonly BasicLayoutVariant[] = ['project']

export const isContentPanelLayout = (variant: BasicLayoutVariant) =>
  CONTENT_PANEL_LAYOUT_VARIANTS.includes(variant)

export interface ResolvedContentPanel {
  /** 布局壳层是否包裹面板。 */
  enabled: boolean
  /** 面板内边距，单位为 px；未声明时为 `undefined`，由 `ContentPanel` 自身默认值兜底。 */
  padding?: number
  /** 面板标题。 */
  title?: string
  /** `false` 时保留留白与圆角，但背景透明。 */
  background: boolean
}

const isPanelConfigObject = (value: unknown): value is Exclude<ContentPanelOverride, boolean> => (
  typeof value === 'object' && value !== null
)

/** 把「布尔 / 对象 / 未声明」三种输入归一成面板配置。 */
export const normalizeContentPanel = (
  declared: ContentPanelOverride | undefined,
): ResolvedContentPanel => {
  if (declared === undefined) {
    return { enabled: DEFAULT_CONTENT_PANEL_ENABLED, background: true }
  }

  if (typeof declared === 'boolean') {
    return { enabled: declared, background: true }
  }

  if (!isPanelConfigObject(declared)) {
    return { enabled: DEFAULT_CONTENT_PANEL_ENABLED, background: true }
  }

  return {
    enabled: declared.enabled ?? true,
    padding: typeof declared.padding === 'number' ? declared.padding : undefined,
    title: typeof declared.title === 'string' ? declared.title : undefined,
    // 面板保留时默认带背景；只有显式 `background: false` 才透明。
    background: declared.background !== false,
  }
}

type ContentPanelLookupMeta = { componentCode?: unknown }

/**
 * 收集一个页面可能出现的所有标识，供代码侧声明表匹配。
 *
 * 路由 `name` 才是菜单 `code` 的落点（`handleRoute`：`routeName || options.routeName || code`），
 * 另外补上匹配记录的 `name` / `path` / `meta.componentCode` 作为别名。
 */
export const getContentPanelLookupKeys = (route: RouteLocationNormalizedLoaded): string[] => {
  const keys: (string | undefined)[] = [
    typeof route.name === 'string' ? route.name : undefined,
    route.path,
  ]

  route.matched.forEach((record) => {
    if (typeof record.name === 'string') keys.push(record.name)
    if (record.path) keys.push(record.path)

    const componentCode = (record.meta as ContentPanelLookupMeta | undefined)?.componentCode
    if (typeof componentCode === 'string') keys.push(componentCode)
  })

  return keys.filter((key): key is string => !!key)
}

export const useRouteContentPanel = () => {
  const route = useRoute()
  const variant = useBasicLayoutVariant()

  return computed<ResolvedContentPanel>(() => {
    // 非项目布局直接退化为改造前的内容区结构，不解析任何声明，
    // 保证面板不会被别的壳层或页面上的配置意外打开。
    if (!isContentPanelLayout(variant.value)) {
      return { enabled: false, background: true }
    }

    return normalizeContentPanel(resolveContentPanelOverride(getContentPanelLookupKeys(route)))
  })
}
