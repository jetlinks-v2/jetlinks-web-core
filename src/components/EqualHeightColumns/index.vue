<template>
  <div
    ref="layoutRef"
    v-bind="rootAttrs"
    class="equal-height-columns"
    :class="[attrs.class, {
      'equal-height-columns--collapsible': showLeft && collapsible,
      'equal-height-columns--collapsed': isCollapsed,
      'equal-height-columns--single': !showLeft,
    }]"
    :style="[attrs.style, rootStyle]"
  >
    <div v-if="showLeft" ref="leftPaneRef" class="equal-height-columns__pane equal-height-columns__pane--left" :style="leftStyle">
      <slot name="left" />
    </div>
    <div class="equal-height-columns__pane equal-height-columns__pane--right" :style="rightStyle">
      <slot name="right" />
    </div>
    <div v-if="showLeft && collapsible" ref="anchorRef" class="equal-height-columns__toggle-anchor" />
    <Teleport
      v-if="showLeft && collapsible"
      :to="toggleHost || 'body'"
      :disabled="!toggleHost"
    >
      <div ref="layerRef" class="equal-height-columns__toggle-layer" :style="togglePosition">
        <a-button
          class="equal-height-columns__toggle"
          :class="{ 'equal-height-columns__toggle--collapsed': isCollapsed }"
          :title="toggleText"
          :aria-label="toggleText"
          :aria-expanded="!isCollapsed"
          @click="toggleCollapse"
        >
          <AIcon :type="isCollapsed ? 'RightOutlined' : 'LeftOutlined'" />
        </a-button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts" name="EqualHeightColumns">
import { computed, ref, useAttrs, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import { useColumnToggle } from './useColumnToggle'

type SizeValue = number | string

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()
const { t: $t } = useI18n()
const { layoutRef, leftPaneRef, anchorRef, layerRef, toggleHost, togglePosition } = useColumnToggle()

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
 * 收起后左列轨道与列间距一起归零，按钮贴齐外层面板（无面板时为容器）左边缘。
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
.equal-height-columns,
.equal-height-columns__toggle-layer {
  --equal-height-columns-toggle-height: 2rem;
}

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
  background: var(--line-strong);
  pointer-events: none;
}

/* 展开按钮朝向右列的一侧敞开，分割线在按钮高度内留出缺口。 */
.equal-height-columns--collapsible:not(.equal-height-columns--collapsed)::before {
  background: linear-gradient(
    to bottom,
    var(--line-strong) 0 calc(50% - var(--equal-height-columns-toggle-height) / 2),
    transparent 0 calc(50% + var(--equal-height-columns-toggle-height) / 2),
    var(--line-strong) 0
  );
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

.equal-height-columns__toggle-anchor {
  grid-area: 1 / 2 / 2 / 3;
  align-self: center;
  height: 0;
  pointer-events: none;
}

/* 挂载到面板后使用实测坐标；没有面板时仍由间距轨道承载。 */
.equal-height-columns__toggle-layer {
  position: absolute;
  grid-area: 1 / 2 / 2 / 3;
  top: 50%;
  left: 50%;
  z-index: 5;
  width: 0;
  height: 0;
  pointer-events: none;
}

.equal-height-columns__toggle {
  --equal-height-columns-toggle-width: 0.8rem;
  position: absolute;
  top: 0;
  left: 0;
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
  border-radius: var(--r-1) 0 0 var(--r-1);
  box-shadow: var(--shadow-1);
  cursor: pointer;
  pointer-events: auto;
  transition:
    transform var(--equal-height-columns-transition),
    color var(--motion-duration-fast) var(--motion-ease-standard),
    border-color var(--motion-duration-fast) var(--motion-ease-standard);
}

/* 分割线位于列间距中点；让按钮右边缘与它重合，避免在左栏边缘留下空隙。 */
.equal-height-columns__toggle:not(.equal-height-columns__toggle--collapsed) {
  transform: translate(-100%, -50%);
  border-right: none;
}

.equal-height-columns__toggle:hover {
  color: var(--accent);
  border-color: var(--accent);
}

/*
 * 收起后抵消组件与面板之间的留白，无面板时偏移量为零；沿用与轨道相同的过渡。
 */
.equal-height-columns__toggle--collapsed {
  border-radius: 0 var(--r-1) var(--r-1) 0;
  transform: translate(calc(0px - var(--equal-height-columns-edge-offset, 0px)), -50%);
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
