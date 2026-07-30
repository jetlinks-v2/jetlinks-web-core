<template>
  <component
    :is="routeLoading.loadingComponent"
    v-if="showRouteLoading && routeLoading.visible && routeLoading.loadingComponent"
  />
  <RouterView
    v-else
    v-slot="{ Component }"
  >
    <PageRouteSkeleton
      v-if="showRouteLoading && routeLoading.visible && !Component"
      :variant="skeletonVariant"
    />
    <Suspense v-else>
      <component
        :is="Component"
        v-if="Component"
      />
      <template #fallback>
        <component
          :is="activeRouteLoadingComponent"
          v-if="activeRouteLoadingComponent"
        />
        <PageRouteSkeleton
          v-else
          :variant="skeletonVariant"
        />
      </template>
    </Suspense>
  </RouterView>
</template>

<script setup lang="ts" name="PageRouteView">
import PageRouteSkeleton from '../PageRouteSkeleton/index.vue'
import { useRouteLoadingStore } from '@jetlinks-web-core/store/route-loading'

type RouteSkeletonVariant = 'content' | 'layout'

withDefaults(defineProps<{
  showRouteLoading?: boolean
  skeletonVariant?: RouteSkeletonVariant
}>(), {
  showRouteLoading: true,
  skeletonVariant: 'content'
})

const routeLoading = useRouteLoadingStore()
const route = useRoute()

// afterEach 会先结束导航 pending，当前路由 meta 继续为异步后代保留同一个 fallback。
const activeRouteLoadingComponent = computed(() => (
  routeLoading.loadingComponent || route.meta.routeLoadingComponent
))
</script>
