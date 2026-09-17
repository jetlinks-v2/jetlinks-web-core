import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { RouteContentPanelMeta } from '@jetlinks-web-core/router/types'

/**
 * 布局级内容面板的默认开关：**默认开启**。
 *
 * 布局壳层统一给每个路由页面套 `ContentPanel`，页面不需要自己包裹。
 * 页面里原有的 `ContentPanel` 由各模块逐个删除替换；壳层不去猜测页面内容，
 * 因为壳层是跨路由常驻的，任何按页面内容推断的状态都会带到下一个页面。
 */
export const DEFAULT_CONTENT_PANEL_ENABLED = true

export interface ResolvedRouteContentPanel {
  /** 布局壳层是否包裹面板。 */
  enabled: boolean
  /** 面板内边距，单位为 px；未声明时为 `undefined`，由 `ContentPanel` 自身默认值兜底。 */
  padding?: number
  /** 面板标题。 */
  title?: string
  /** `false` 时保留留白与圆角，但背景透明。 */
  background: boolean
}

const isPanelMetaObject = (value: unknown): value is RouteContentPanelMeta => (
  typeof value === 'object' && value !== null
)

/**
 * 归一化路由 meta 中的 `contentPanel`。
 *
 * 与 `RouteMeta.layoutClassName` 保持一致的取值规则：沿 `route.matched` 由深到浅，
 * 取第一条真正声明了 `contentPanel` 的记录，避免父级布局路由覆盖叶子页面。
 */
export const resolveRouteContentPanel = (
  matched: readonly { meta?: { contentPanel?: boolean | RouteContentPanelMeta } }[],
): ResolvedRouteContentPanel => {
  const declared = [...matched]
    .reverse()
    .find(record => record.meta?.contentPanel !== undefined)
    ?.meta?.contentPanel

  if (declared === undefined) {
    return { enabled: DEFAULT_CONTENT_PANEL_ENABLED, background: true }
  }

  if (typeof declared === 'boolean') {
    return { enabled: declared, background: true }
  }

  if (!isPanelMetaObject(declared)) {
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

export const useRouteContentPanel = () => {
  const route = useRoute()

  return computed<ResolvedRouteContentPanel>(() => resolveRouteContentPanel(route.matched))
}
