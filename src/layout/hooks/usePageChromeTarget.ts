import { inject, provide, type InjectionKey, type Ref } from 'vue'

/**
 * 壳层为「面板外页面头部」预留的容器元素。
 *
 * 传元素本身而不是选择器：页面侧要 `Teleport` 到这个节点，而挂载期祖先元素可能
 * 还没连到 `document`，选择器会查不到；元素引用在挂载阶段就已经可用。
 */
export type PageChromeTarget = Ref<HTMLElement | null>

const PAGE_CHROME_TARGET_KEY: InjectionKey<PageChromeTarget> = Symbol('page-chrome-target')

/** 由壳层内容区（`RouteContentSurface`）调用。 */
export const providePageChromeTarget = (target: PageChromeTarget) => {
  provide(PAGE_CHROME_TARGET_KEY, target)
}

/**
 * 由页面侧的 `PageChrome` 调用。
 *
 * 返回 `undefined` 表示当前页面不在带内容区的布局壳层内（例如 BlankLayout 或全屏页），
 * 此时 `PageChrome` 原地渲染，不丢内容。
 */
export const usePageChromeTarget = () => inject(PAGE_CHROME_TARGET_KEY, undefined)
