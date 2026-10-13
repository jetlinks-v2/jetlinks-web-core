<template>
  <div
    v-bind="rootAttrs"
    class="equal-height-columns"
    :class="[attrs.class, {
      'equal-height-columns--collapsed': isCollapsed,
      'equal-height-columns--single': !showLeft,
    }]"
    :style="[attrs.style, rootStyle]"
  >
    <div v-if="showLeft" class="equal-height-columns__pane equal-height-columns__pane--left" :style="leftStyle">
      <slot name="left" />
    </div>
    <div class="equal-height-columns__pane equal-height-columns__pane--right" :style="rightStyle">
      <slot name="right" />
    </div>
    <a-button
      v-if="showLeft && collapsible"
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
    /** 是否显示左列，默认 true；隐藏时右列铺满容器且不显示折叠按钮 */
    showLeft?: boolean
  }>(),
  {
    height: '100%',
    gap: 'var(--space-8)',
    leftWidth: '15rem',
    rightWidth: '1fr',
    align: 'stretch',
    collapsible: true,
    showLeft: true,
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

const toGridTrack = (value: SizeValue, collapsed = false) => {
  if (collapsed) {
    // 保留弹性轨道类型，避免 fr 与 0px 之间无法插值而在动画中途跳变。
    return typeof value === 'string' && value.trim().endsWith('fr') ? '0fr' : '0px'
  }

  return toCssValue(value)
}

const rootStyle = computed<Record<string, string>>(() => ({
  '--equal-height-columns-height': toCssValue(props.height),
  // 收起时同时去掉左列宽度和列间距，右列才能真正占满整行
  '--equal-height-columns-gap': isCollapsed.value ? '0px' : toCssValue(props.gap),
  '--equal-height-columns-align': props.align,
  '--equal-height-columns-left-width': toGridTrack(props.leftWidth, isCollapsed.value),
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
  --equal-height-columns-transition: 0.2s cubic-bezier(0.23, 1, 0.32, 1);
  position: relative;
  display: grid;
  width: 100%;
  height: var(--equal-height-columns-height);
  min-height: 0;
  gap: 0;
  align-items: var(--equal-height-columns-align);
  /* 将间距作为独立轨道，按钮和分割线可直接居中，百分比间距也由容器宽度解析。 */
  grid-template-columns: minmax(0, var(--equal-height-columns-left-width)) var(--equal-height-columns-gap) minmax(0, var(--equal-height-columns-right-width));
  /* 收起前后保留相同轨道类型，布局、间距和按钮位移使用同一段过渡。 */
  transition: grid-template-columns var(--equal-height-columns-transition);
}

/* 中缝分割线随间距轨道同步移动，不单独叠加位移过渡。 */
.equal-height-columns::before {
  content: '';
  grid-area: 1 / 2 / 2 / 3;
  justify-self: center;
  align-self: stretch;
  width: var(--jet-theme-stroke-width);
  background: #eceff3;
  pointer-events: none;
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
  grid-area: 1 / 3 / 2 / 4;
}

/* 隐藏左列时改为单列，覆盖自定义列宽并移除中缝占位。 */
.equal-height-columns--single {
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}

.equal-height-columns--single::before {
  content: none;
}

.equal-height-columns--single .equal-height-columns__pane--right {
  grid-area: 1 / 1 / 2 / 2;
}

.equal-height-columns__toggle {
  --equal-height-columns-toggle-width: 1.375rem;
  --equal-height-columns-toggle-height: 1.5rem;
  /* 绝对定位参照间距轨道，left: 50% 直接跟随中缝，无需观察尺寸后二次过渡。 */
  position: absolute;
  grid-area: 1 / 2 / 2 / 3;
  top: 50%;
  left: 50%;
  z-index: 5;
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
    transform var(--equal-height-columns-transition),
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
  border-radius: 0 var(--r-3) var(--r-3) 0;
  transform: translateY(-50%);
	border-left: none;
}

@media (prefers-reduced-motion: reduce) {
  .equal-height-columns {
    transition: none;
  }

  .equal-height-columns__toggle {
    transition:
      color var(--motion-duration-fast) var(--motion-ease-standard),
      border-color var(--motion-duration-fast) var(--motion-ease-standard);
  }
}
</style>
