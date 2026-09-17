<template>
  <section
    class="content-panel"
    :class="{
      'content-panel--fill': fill,
      'content-panel--no-background': !background,
    }"
    :style="{
      '--content-panel-padding': `${normalizedPadding}px`,
    }"
  >
    <a-flex v-if="showHeader" align="center" justify="space-between" class="content-panel__header">
      <div v-if="title || $slots.title" class="content-panel__title">
        <slot name="title">{{ title }}</slot>
      </div>
      <slot name="titleRightRender"></slot>
    </a-flex>
    <slot />
  </section>
</template>

<script setup lang="ts" name="ContentPanel">
import { computed, useSlots } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  padding: {
    type: Number,
    default: 16,
    validator: (value: number) => value >= 0,
  },
  /** 为 `false` 时保留留白与圆角，但背景透明、去掉模糊与阴影。 */
  background: {
    type: Boolean,
    default: true,
  },
  /** 为 `true` 时撑满父级 flex 列容器，供布局壳层统一包裹时使用。 */
  fill: {
    type: Boolean,
    default: false,
  },
})

const normalizedPadding = computed(() => Math.max(props.padding, 0))

const slots = useSlots()

/**
 * 历史行为：没有标题时仍保留标题区占位（仅剩 16px 下边距）。
 * 布局壳层统一包裹的面板（`fill`）不应带着空占位，否则每个页面顶部都会多出一段空白。
 */
const showHeader = computed(() => (
  !props.fill
  || !!props.title
  || !!slots.title
  || !!slots.titleRightRender
))
</script>

<style scoped>
.content-panel {
  box-sizing: border-box;
  gap: var(--panel-gap, var(--space-4));
  padding: var(--content-panel-padding);
  border-radius: var(--panel-radius, var(--r-6));
  background: rgba(255, 255, 255, 0.8);
  overflow: auto;
	backdrop-filter: blur(10px);
	//box-shadow: rgba(30, 118, 255, 0.13) 0 1px 16px 0;
  box-shadow: 0px 0px 50px 0px #7794CB1A;
  //border: 1px solid var(--jet-theme-border-color-1);
  height: 100%;
}

/*
 * 布局壳层统一包裹时：高度由 flex 列容器决定（避免 `height: 100%` 撑破壳层），
 * 并把插槽内容排成 flex 项，让需要撑满的页面用 `flex: 1 1 auto` 表达，
 * 而不是依赖百分比高度（壳层链路是 flex 定高，百分比不可靠）。
 */
.content-panel--fill {
  display: flex;
  height: auto;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  /* 页面根节点沿用块级时代的排布，间距由页面自己与标题区下边距承担。 */
  gap: 0;
}

.content-panel--fill > .content-panel__header {
  flex: 0 0 auto;
}

.content-panel--no-background {
  background: transparent;
  backdrop-filter: none;
  box-shadow: none;
}

.content-panel__header {
	margin-bottom: var(--space-4);
}
.content-panel__title {
  margin-bottom: 0;
  color: var(--ink-1);
  font-size: 18px;
  font-weight: 600;
  line-height: var(--lh-snug);
}
</style>
