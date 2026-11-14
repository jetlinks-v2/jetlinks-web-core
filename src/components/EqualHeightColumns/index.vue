<template>
  <div
    ref="layoutRef"
    v-bind="rootAttrs"
    class="equal-height-columns"
    :class="[attrs.class, {
      'equal-height-columns--collapsible': showLeft && collapsible && !hasHeader,
      'equal-height-columns--header': hasHeader,
      'equal-height-columns--toolbar': hasToolbar,
      'equal-height-columns--collapsed': isCollapsed,
      'equal-height-columns--single': !showLeft,
    }]"
    :style="[attrs.style as StyleValue, rootStyle]"
  >
    <div v-if="showLeft" ref="leftPaneRef" class="equal-height-columns__pane equal-height-columns__pane--left" :style="leftStyle">
      <header v-if="slots['left-header']" class="equal-height-columns__header">
        <a-button v-if="collapsible && !hasToolbar" type="text" size="small" class="equal-height-columns__header-toggle"
          :title="toggleText" :aria-label="toggleText" :aria-expanded="!isCollapsed" :aria-controls="bodyId" @click="toggleCollapse">
          <AIcon :type="isCollapsed ? 'MenuUnfoldOutlined' : 'MenuFoldOutlined'" />
        </a-button>
        <div v-show="!isCollapsed" class="equal-height-columns__header-title"><slot name="left-header" /></div>
      </header>
      <div v-if="hasHeader" v-show="!isCollapsed" :id="bodyId" class="equal-height-columns__body"><slot name="left" /></div>
      <slot v-else name="left" />
    </div>
    <div class="equal-height-columns__pane equal-height-columns__pane--right" :class="{ 'equal-height-columns__pane--toolbar': hasToolbar }" :style="rightStyle">
      <header v-if="hasToolbar" class="equal-height-columns__toolbar">
        <a-button v-if="showLeft && collapsible" type="text" size="small" class="equal-height-columns__header-toggle"
          :title="toggleText" :aria-label="toggleText" :aria-expanded="!isCollapsed" :aria-controls="bodyId" @click="toggleCollapse">
          <AIcon :type="isCollapsed ? 'MenuUnfoldOutlined' : 'MenuFoldOutlined'" />
        </a-button>
        <div class="equal-height-columns__toolbar-content"><slot name="right-header" /></div>
      </header>
      <div v-if="hasToolbar" class="equal-height-columns__main"><slot name="right" /></div>
      <slot v-else name="right" />
    </div>
    <div v-if="showLeft && collapsible && !hasHeader" ref="anchorRef" class="equal-height-columns__toggle-anchor" />
    <Teleport
      v-if="showLeft && collapsible && !hasHeader"
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

<script setup lang="ts">
import { computed, ref, useAttrs, useId, useSlots, type CSSProperties, type StyleValue } from 'vue'
import { useI18n } from 'vue-i18n'
import { useColumnToggle } from './useColumnToggle'

type SizeValue = number | string

defineOptions({
  name: 'EqualHeightColumns',
  inheritAttrs: false,
})

const attrs = useAttrs()
const slots = useSlots()
const hasToolbar = computed(() => !!slots['right-header'])
const hasHeader = computed(() => !!slots['left-header'] || hasToolbar.value)
const bodyId = `column-body-${useId()}`
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
 * 工具栏模式在右侧提供入口，左列归零；左标题模式保留窄入口。
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
  '--equal-height-columns-left-width': isCollapsed.value && hasHeader.value && !hasToolbar.value
    ? 'var(--equal-height-columns-header-rail)' : toGridTrack(props.leftWidth, isCollapsed.value),
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

<style scoped src="./index.css" />
