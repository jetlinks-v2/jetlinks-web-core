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
    <button
      v-if="collapsible"
      class="equal-height-columns__toggle"
      type="button"
      :title="toggleText"
      :aria-label="toggleText"
      :aria-expanded="!isCollapsed"
      @click="toggleCollapse"
    >
      <DoubleRightOutlined v-if="isCollapsed" />
      <DoubleLeftOutlined v-else />
    </button>
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
    gap: 'var(--space-4)',
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

.equal-height-columns__pane {
  min-width: 0;
  min-height: 0;
  height: 100%;
  /* 约束子项高度，让左侧筛选等面板能内部滚动 */
  overflow: hidden;
}

/* 两栏显式落在同一行，按钮才能复用左列轨道叠放而不被挤到第二行。 */
.equal-height-columns__pane--left {
  grid-area: 1 / 1 / 2 / 2;
}

.equal-height-columns__pane--right {
  grid-area: 1 / 2 / 2 / 3;
}

.equal-height-columns__toggle {
  --equal-height-columns-toggle-width: 0.8rem;
  --equal-height-columns-toggle-height: 4rem;
  /* 与左列共享单元格：展开时贴左列右边缘，收起后左列宽度归零，再靠位移把按钮拉回容器左边缘。 */
  grid-area: 1 / 1 / 2 / 2;
  justify-self: end;
  align-self: center;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--equal-height-columns-toggle-width);
  height: var(--equal-height-columns-toggle-height);
  padding: 0;
  font-size: var(--fs-12);
  color: var(--ink-2);
  background: var(--bg);
  border: var(--jet-theme-stroke-width) solid var(--line-strong);
  /* 右侧贴合左列边缘，贴住的一侧不留圆角，视觉上像挂在面板边上 */
  border-radius: var(--r-2) 0 0 var(--r-2);
  box-shadow: var(--shadow-1);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-radius 0.2s ease,
    color var(--motion-duration-fast) var(--motion-ease-standard),
    border-color var(--motion-duration-fast) var(--motion-ease-standard);
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
  border-radius: 0 var(--r-2) var(--r-2) 0;
  transform: translateX(var(--equal-height-columns-toggle-width));
}
</style>
