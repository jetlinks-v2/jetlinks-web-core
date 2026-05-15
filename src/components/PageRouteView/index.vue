<template>
  <RouterView v-slot="{ Component }">
    <PageRouteSkeleton v-if="showRouteLoading && routeLoading.visible && !Component" />
    <Suspense v-else>
      <component
        :is="Component"
        v-if="Component"
      />
      <template #fallback>
        <PageRouteSkeleton />
      </template>
    </Suspense>
  </RouterView>
</template>

<script setup lang="ts" name="PageRouteView">
import PageRouteSkeleton from '../PageRouteSkeleton/index.vue'
import { useRouteLoadingStore } from '@jetlinks-web-core/store/route-loading'

defineProps({
  showRouteLoading: {
    type: Boolean,
    default: true
  }
})

const routeLoading = useRouteLoadingStore()
</script>
