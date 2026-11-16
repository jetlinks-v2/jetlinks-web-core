<template>
  <div
    :class="['page-route-skeleton', `page-route-skeleton--${variant}`]"
    aria-hidden="true"
  >
    <LayoutSkeleton v-if="variant === 'layout'" />
    <ContentSkeleton v-else />
  </div>
</template>

<script setup lang="ts">
import ContentSkeleton from './ContentSkeleton.vue'
import LayoutSkeleton from './LayoutSkeleton.vue'

defineOptions({ name: 'PageRouteSkeleton' })

type SkeletonVariant = 'content' | 'layout'

withDefaults(defineProps<{
  variant?: SkeletonVariant
}>(), {
  variant: 'content'
})
</script>

<style lang="less" src="./style.less"></style>
