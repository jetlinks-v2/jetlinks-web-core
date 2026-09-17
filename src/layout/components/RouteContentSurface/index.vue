<template>
  <div v-if="panel.enabled" class="route-content-surface route-content-surface--panel">
    <div ref="chromeElement" class="route-content-surface__chrome"></div>
    <ContentPanel
      class="route-content-surface__panel"
      fill
      :title="panel.title ?? ''"
      :padding="resolvedPadding"
      :background="panel.background"
    >
      <PageRouteView />
    </ContentPanel>
  </div>

  <!--
    面板关闭时保持与改造前完全一致的 DOM：只多一个空的面板外头部容器。
    该容器为空时 `display: none`，因此对既有页面零布局影响。
  -->
  <template v-else>
    <div ref="chromeElement" class="route-content-surface__chrome"></div>
    <PageRouteView />
  </template>
</template>

<script setup lang="ts" name="RouteContentSurface">
import { computed, ref } from 'vue'
import ContentPanel from '@jetlinks-web-core/components/ContentPanel/index.vue'
import PageRouteView from '@jetlinks-web-core/components/PageRouteView/index.vue'
import { useRouteContentPanel } from '../../hooks/useRouteContentPanel'
import { providePageChromeTarget } from '../../hooks/usePageChromeTarget'

/**
 * 布局壳层的路由内容区：统一给路由页面套 `ContentPanel`，并预留"面板外页面头部"容器。
 *
 * 项目端/租户端（`BasicLayoutShell`）与应用端（`ApplicationLayoutPage`）原本各自
 * 复刻同一段内容区结构，这里合并为唯一实现，避免第三处重复。
 *
 * 是否包裹**只由路由 `meta.contentPanel` 决定**，不去猜测页面里有没有 `ContentPanel`：
 * 壳层是跨路由常驻的，任何"按页面内容推断"的状态都会带到下一个页面上去。
 */
const panel = useRouteContentPanel()

/** 空值交给 `ContentPanel` 自身的默认内边距兜底。 */
const resolvedPadding = computed(() => panel.value.padding ?? 16)

// `ref` 必须由壳层持有再 provide，页面侧才能在挂载阶段拿到真实元素做 Teleport。
const chromeElement = ref<HTMLElement | null>(null)
providePageChromeTarget(chromeElement)
</script>

<style scoped lang="less">
.route-content-surface {
  &--panel {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--space-4);
  }

  /*
   * 贴合式头部（`<PageChrome flush>`，例如 SlantedTabs 充当面板顶栏）：
   * 闭合与面板的间距，并把面板左上角拉平，复刻"页签与面板连成一体"的既有视觉。
   * 用 `:has()` 纯 CSS 判断，不引入任何跨路由的组件状态。
   */
  &--panel:has(> .route-content-surface__chrome > .page-chrome--flush) {
    gap: 0;

    > .route-content-surface__panel {
      border-top-left-radius: 0;
    }
  }
}

.route-content-surface__chrome {
  flex: 0 0 auto;

  &:empty {
    display: none;
  }
}

.route-content-surface__panel {
  min-height: 0;
}
</style>
