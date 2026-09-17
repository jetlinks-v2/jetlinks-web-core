<template>
  <Teleport :to="teleportTarget" :disabled="!isTargetReady">
    <div class="page-chrome" :class="{ 'page-chrome--flush': flush }">
      <slot />
    </div>
  </Teleport>
</template>

<script setup lang="ts" name="PageChrome">
import { computed, onMounted, shallowRef } from 'vue'
import { usePageChromeTarget } from '@jetlinks-web-core/layout/hooks/usePageChromeTarget'

/**
 * 页面头部（返回按钮、卡片切换、页签等）容器：把内容送到布局壳层预留的
 * `ContentPanel` 之外的插槽位。
 *
 * 使用 `Teleport` 而非注册渲染函数，是为了保留页面自身的 provide/inject 与 scoped 样式。
 * 目标元素在父级挂载阶段才写入 ref，所以这里在 `onMounted` 读取；拿不到目标时
 * `Teleport` 保持 `disabled`，内容原地渲染，页面在非壳层环境下也不会丢内容。
 */
defineProps({
  /**
   * `true` 时头部与面板贴合：壳层闭合两者间距，并把面板左上角拉平。
   * 用于 `SlantedTabs` 这类"页签就是面板顶栏"的头部；返回按钮这类独立头部保持默认。
   */
  flush: {
    type: Boolean,
    default: false,
  },
})

const injectedTarget = usePageChromeTarget()
const targetElement = shallowRef<HTMLElement | null>(null)
const isTargetReady = computed(() => !!targetElement.value)
const teleportTarget = computed<string | HTMLElement>(() => targetElement.value ?? 'body')

onMounted(() => {
  targetElement.value = injectedTarget?.value ?? null
})
</script>

<style scoped lang="less">
.page-chrome {
  min-width: 0;
  flex: 0 0 auto;
}
</style>
