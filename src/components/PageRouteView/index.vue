<template>
  <component
    :is="routeLoading.loadingComponent"
    v-if="showRouteLoading && routeLoading.visible && routeLoading.loadingComponent"
    :class="{ 'page-route-loading-overlay': routeLoading.overlay }"
  />
  <RouterView
    v-if="shouldRenderRouteContent"
    v-slot="{ Component }"
  >
    <PageRouteSkeleton
      v-if="showRouteLoading && routeLoading.visible && !routeLoading.overlay && !Component"
      :variant="skeletonVariant"
    />
    <Suspense v-else>
      <component
        :is="Component"
        v-if="Component"
      />
      <template #fallback>
        <template v-if="!routeLoading.overlay">
          <component
            :is="activeRouteLoadingComponent"
            v-if="activeRouteLoadingComponent"
          />
          <PageRouteSkeleton
            v-else
            :variant="skeletonVariant"
          />
        </template>
      </template>
    </Suspense>
  </RouterView>
</template>

<script setup lang="ts" name="PageRouteView">
import PageRouteSkeleton from '../PageRouteSkeleton/index.vue'
import { useRouteLoadingStore } from '@jetlinks-web-core/store/route-loading'

type RouteSkeletonVariant = 'content' | 'layout'

const props = withDefaults(defineProps<{
  showRouteLoading?: boolean
  skeletonVariant?: RouteSkeletonVariant
}>(), {
  showRouteLoading: true,
  skeletonVariant: 'content'
})

const routeLoading = useRouteLoadingStore()
const route = useRoute()
const shouldRenderRouteContent = computed(() => (
  !props.showRouteLoading
  || !routeLoading.visible
  || !routeLoading.loadingComponent
  || routeLoading.overlay
))

// afterEach 会先结束导航 pending，当前路由 meta 继续为异步后代保留同一个 fallback。
const activeRouteLoadingComponent = computed(() => (
  routeLoading.loadingComponent || route.meta.routeLoadingComponent
))
</script>

<style scoped lang="less">
.page-route-loading-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
}
</style>
