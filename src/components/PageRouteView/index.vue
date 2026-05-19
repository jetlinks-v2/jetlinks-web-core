<template>
  <RouterView v-slot="{ Component }">
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
        <PageRouteSkeleton :variant="skeletonVariant" />
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
</script>
