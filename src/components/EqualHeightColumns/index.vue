<template>
  <div
    v-bind="rootAttrs"
    class="equal-height-columns"
    :class="[attrs.class, { 'equal-height-columns--collapsed': isCollapsed }]"
    :style="[attrs.style, rootStyle]"
  >
    <div class="equal-height-columns__pane equal-height-columns__pane--left" :style="leftStyle">
      <slot name="left" />
    </div>
    <div class="equal-height-columns__pane equal-height-columns__pane--right" :style="rightStyle">
      <slot name="right" />
    </div>
    <a-button
      v-if="collapsible"
      class="equal-height-columns__toggle"
      :title="toggleText"
      :aria-label="toggleText"
      :aria-expanded="!isCollapsed"
      @click="toggleCollapse"
    >
      <DoubleRightOutlined v-if="isCollapsed" />
      <DoubleLeftOutlined v-else />
    </a-button>
  </div>
</template>

<script setup lang="ts" name="EqualHeightColumns">
import type { CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import { DoubleLeftOutlined, DoubleRightOutlined } from '@ant-design/icons-vue'

type SizeValue = number | string

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()
const { t: $t } = useI18n()

const props = withDefaults(
  defineProps<{
    height?: SizeValue
    gap?: SizeValue
    leftWidth?: SizeValue
    rightWidth?: SizeValue
    align?: CSSProperties['alignItems']
    /** 是否显示左列展开/收起按钮 */
    collapsible?: boolean
  }>(),
  {
    height: '100%',
    gap: 'var(--space-8)',
    leftWidth: '15rem',
    rightWidth: '1fr',
    align: 'stretch',
    collapsible: true,
  }
)

const emit = defineEmits<{
  (event: 'collapse-change', collapsed: boolean): void
}>()

const isCollapsed = ref(false)

const toggleText = computed(() => (
  isCollapsed.value
    ? $t('components.EqualHeightColumns.expand')
    : $t('components.EqualHeightColumns.collapse')
))

/**
 * 切换左列展开状态。
 *
 * 收起后左列轨道与列间距一起归零，按钮由左列右边缘回落到容器左边缘；展开时恢复传入的 leftWidth / gap。
 */
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  emit('collapse-change', isCollapsed.value)
}

const toCssValue = (value: SizeValue) => typeof value === 'number' ? `${value}px` : value

const toGridTrack = (value: SizeValue) => {
  if (typeof value === 'number') {
    return `${value}px`
  }

  return value
}

const rootStyle = computed<Record<string, string>>(() => ({
  '--equal-height-columns-height': toCssValue(props.height),
  // 收起时同时去掉左列宽度和列间距，右列才能真正占满整行
  '--equal-height-columns-gap': isCollapsed.value ? '0px' : toCssValue(props.gap),
  '--equal-height-columns-align': props.align,
  '--equal-height-columns-left-width': isCollapsed.value ? '0px' : toGridTrack(props.leftWidth),
  '--equal-height-columns-right-width': toGridTrack(props.rightWidth),
}))

const paneStyle = computed<CSSProperties>(() => ({
  minHeight: 'var(--equal-height-columns-height)',
}))

const rootAttrs = computed(() => {
  return Object.fromEntries(
    Object.entries(attrs).filter(([key]) => !['class', 'style'].includes(key))
  )
})

const leftStyle = paneStyle
const rightStyle = paneStyle
</script>

<style scoped>
.equal-height-columns {
	position: relative;
  display: grid;
  width: 100%;
  height: var(--equal-height-columns-height);
  min-height: 0;
  gap: var(--equal-height-columns-gap);
  align-items: var(--equal-height-columns-align);
  grid-template-columns: minmax(0, var(--equal-height-columns-left-width)) minmax(0, var(--equal-height-columns-right-width));
  /* grid-template-columns 即使由 var 驱动也能插值，展开/收起因此可以平滑过渡；
     非长度轨道（如 1fr）不可插值时会自动退化成瞬时切换，不会报错或错位。 */
  transition:
    grid-template-columns 0.2s ease,
    column-gap 0.2s ease;
}

/*
 * 中缝分割线。
 * 做法：占用左列单元格、靠右对齐，再向右平移半个列间距，正好落在两栏缝隙的正中；
 * 这样只需知道 gap，不依赖 leftWidth 的单位（rem / px / % 都能用）。
 * 观感：颜色取主题次级边框色（--jet-theme-border-secondary，浅色与深色各自适配），
 * 并做上下各 12% 的渐隐，弱化成「一条缝」而不是一条通到底的硬边框；仍足以提示两栏边界。
 */
.equal-height-columns::before {
  content: '';
  grid-area: 1 / 1 / 2 / 2;
  justify-self: end;
  align-self: stretch;
  width: var(--jet-theme-stroke-width);
  /* 位移与 column-gap 同步过渡，展开/收起时线始终贴着缝隙正中，不会先跳到列边缘 */
  transform: translateX(calc(var(--equal-height-columns-gap) / 2));
  background: #eceff3;
  pointer-events: none;
  transition: transform 0.2s ease;
}

/* 左列收起后两栏贴合，中缝已无意义，分割线随之消失。 */
.equal-height-columns--collapsed::before {
  background: none;
}

.equal-height-columns__pane {
  min-width: 0;
  min-height: 0;
  height: 100%;
  /* 约束子项高度，让左侧筛选等面板能内部滚动 */
  overflow: hidden;
}

/* 两栏显式落在同一行。 */
.equal-height-columns__pane--left {
  grid-area: 1 / 1 / 2 / 2;
}

.equal-height-columns__pane--right {
  grid-area: 1 / 2 / 2 / 3;
}

.equal-height-columns__toggle {
  --equal-height-columns-toggle-width: 1.375rem;
  --equal-height-columns-toggle-height: 1.5rem;
  /* 绝对定位到中缝：left 是分割线位置，向左回退自身宽度后右边缘恰好贴住分割线。 */
  position: fixed;
  top: 50%;
  left: calc(var(--equal-height-columns-left-width) + var(--equal-height-columns-gap));
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--equal-height-columns-toggle-width);
  height: var(--equal-height-columns-toggle-height);
  padding: 0;
  font-size: var(--fs-12);
  color: var(--ink-2);
  border: var(--jet-theme-stroke-width) solid var(--line-strong);
  /* 右侧贴合左列边缘，贴住的一侧不留圆角，视觉上像挂在面板边上 */
  border-radius: var(--r-3) 0 0 var(--r-3);
  box-shadow: var(--shadow-1);
  cursor: pointer;
  transition:
    left 0.2s ease,
    transform 0.2s ease,
    border-radius 0.2s ease,
    color var(--motion-duration-fast) var(--motion-ease-standard),
    border-color var(--motion-duration-fast) var(--motion-ease-standard);
}

/* 分割线位于列间距中点；让按钮右边缘与它重合，避免在左栏边缘留下空隙。 */
.equal-height-columns:not(.equal-height-columns--collapsed) .equal-height-columns__toggle {
  transform: translate(-100%, -50%);
	border-right: none;
}

.equal-height-columns__toggle:hover {
  color: var(--accent);
  border-color: var(--accent);
}

/*
 * 收起后按钮贴容器左边缘，改为左侧不留圆角。
 * 位移量与列宽收缩使用同一时长和缓动，两者叠加后按钮从「左列右边缘」连续滑到「容器左边缘」，不会跳变。
 */
.equal-height-columns--collapsed .equal-height-columns__toggle {
  left: 0;
  border-radius: 0 var(--r-3) var(--r-3) 0;
  transform: translateY(-50%);
	border-left: none;
}
</style>
