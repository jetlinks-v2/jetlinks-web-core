<template>
  <div
    ref="rootRef"
    v-bind="rootAttrs()"
    class="equal-height-columns"
    :class="[attrs.class, {
      'equal-height-columns--collapsed': isCollapsed,
      'equal-height-columns--single': !showLeft,
      'equal-height-columns--resizable': resizable,
    }]"
    :style="[attrs.style as StyleValue, rootStyle()]"
  >
    <div v-if="showLeft" ref="leftPaneRef" class="equal-height-columns__pane equal-height-columns__pane--left" :style="leftStyle">
      <header v-if="hasLeftHeader()" class="equal-height-columns__header" :style="{ minHeight: `${headerHeight}px` }">
        <div ref="leftHeaderContent" class="equal-height-columns__row-content">
        <PanelCollapseButton v-if="collapsible && usesLeftToggle()" ref="toggleRef" class="equal-height-columns__header-toggle"
          :collapsed="isCollapsed" :label="toggleText" :aria-controls="controlledIds()" @toggle="toggleCollapse" />
        <div v-if="hasLeftHeader()" v-show="!isCollapsed" :id="headerId" class="equal-height-columns__header-content"
          :inert="isCollapsed ? true : undefined" :aria-hidden="isCollapsed ? true : undefined"><slot name="left-header" /></div>
        </div>
      </header>
      <div v-if="$slots['left-toolbar'] || $slots['right-toolbar']" v-show="!isCollapsed" class="equal-height-columns__tools" :style="{ minHeight: `${toolbarHeight}px` }">
        <div v-if="$slots['left-toolbar']" ref="leftToolbarContent" class="equal-height-columns__row-content"><slot name="left-toolbar" /></div>
      </div>
      <div v-show="!isCollapsed" :id="bodyId" class="equal-height-columns__body"
        :inert="isCollapsed ? true : undefined" :aria-hidden="isCollapsed ? true : undefined"><slot name="left" /></div>
    </div>
    <PanelResizeHandle v-if="resizable && showLeft && !isCollapsed && measuredLeftWidth > 0" ref="resizeRef"
      class="equal-height-columns__resize" :style="{ justifySelf: 'center', marginLeft: 0 }" side="left"
      :model-value="resizedWidth ?? measuredLeftWidth" :container="rootRef" :limits="panelLimits"
      :aria-label="$t('components.EqualHeightColumns.resize')" :aria-controls="controlledIds()" @update:model-value="resizeLeft" />
    <div ref="rightPaneRef" class="equal-height-columns__pane equal-height-columns__pane--right" :style="rightStyle" tabindex="-1">
      <header v-if="hasToolbar()" class="equal-height-columns__toolbar" :style="{ minHeight: `${headerHeight}px` }">
        <div ref="rightHeaderContent" class="equal-height-columns__row-content">
        <PanelCollapseButton v-if="showLeft && collapsible && !usesLeftToggle()" ref="toggleRef" class="equal-height-columns__header-toggle"
          :collapsed="isCollapsed" :label="toggleText" :aria-controls="controlledIds()" @toggle="toggleCollapse" />
        <div class="equal-height-columns__toolbar-content"><slot name="right-header" /></div>
        </div>
      </header>
      <div v-if="$slots['left-toolbar'] || $slots['right-toolbar']" class="equal-height-columns__tools" :style="{ minHeight: `${toolbarHeight}px` }">
        <div v-if="$slots['right-toolbar']" ref="rightToolbarContent" class="equal-height-columns__row-content"><slot name="right-toolbar" /></div>
      </div>
      <div class="equal-height-columns__main"><slot name="right" /></div>
    </div>
  </div>
</template>

<script setup lang="ts" name="EqualHeightColumns">
import { computed, nextTick, onBeforeUpdate, ref, useAttrs, useId, useSlots, watch, watchEffect, type CSSProperties, type StyleValue } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import PanelResizeHandle from '../PanelResizeHandle/index.vue'
import PanelCollapseButton from '../PanelCollapseButton/index.vue'
import { useColumnCollapse } from './useColumnCollapse'
import { providePaneRows, usePaneRow } from '../SplitterPane/usePaneRows'

type SizeValue = number | string

defineOptions({
  name: 'EqualHeightColumns',
  inheritAttrs: false,
})

const attrs = useAttrs()
const slots = useSlots()
// useSlots 的键由渲染更新；每次读取，避免把动态插槽形态缓存为初次结果。
const hasToolbar = () => !!slots['right-header']
const hasLeftHeader = () => !!slots['left-header']
const usesLeftToggle = () => !hasToolbar()
const hasCollapseHost = ref(hasLeftHeader() || hasToolbar())
const bodyId = `column-body-${useId()}`
const headerId = `${bodyId}-header`
const controlledIds = () => hasLeftHeader() ? `${bodyId} ${headerId}` : bodyId
const { t: $t } = useI18n()
const leftPaneRef = ref<HTMLElement>()
const rootRef = ref<HTMLElement>()
const rightPaneRef = ref<HTMLElement>()
const resizeRef = ref<InstanceType<typeof PanelResizeHandle>>()
const resizedWidth = ref<number>()
const initialWidth = ref<number>()

const props = withDefaults(
  defineProps<{
    height?: SizeValue
    gap?: SizeValue
    leftWidth?: SizeValue
    rightWidth?: SizeValue
    align?: CSSProperties['alignItems']
    /** 是否显示左列展开/收起按钮 */
    collapsible?: boolean
    /** 传入时由宿主管理折叠偏好，支持 v-model:collapsed。 */
    collapsed?: boolean
    /** 是否显示左列，默认 true；隐藏时右列铺满容器且不显示折叠按钮 */
    showLeft?: boolean
    /** 允许拖动分割线调整左列宽度；默认保留既有 CSS 轨道布局。 */
    resizable?: boolean
    resizeLimits?: { min?: number; max?: number; contentMin?: number }
    /** 正文内边距，默认 0 兼容已有自行留白的内容。 */
    padding?: SizeValue
  }>(),
  {
    height: '100%',
    gap: 'var(--space-8)',
    leftWidth: '15rem',
    rightWidth: '1fr',
    align: 'stretch',
    collapsible: true,
    collapsed: undefined,
    showLeft: true,
    resizable: false,
    padding: 0,
  }
)

const emit = defineEmits<{
  (event: 'update:collapsed', collapsed: boolean): void
  (event: 'collapse-change', collapsed: boolean): void
  (event: 'resize', width: number): void
}>()

const { isCollapsed, toggleRef, toggleCollapse } = useColumnCollapse({
  get collapsed() { return props.collapsed },
  get collapsible() { return props.collapsible && hasCollapseHost.value },
}, leftPaneRef, collapsed => {
  emit('update:collapsed', collapsed)
  emit('collapse-change', collapsed)
})

// 插槽键不响应式；更新前同步能力，避免回退模式留下无法恢复的隐藏正文。
onBeforeUpdate(() => {
  const next = hasLeftHeader() || hasToolbar()
  const toggle = toggleRef.value?.$el
  const returnFocus = !next && toggle?.contains(toggle.ownerDocument.activeElement)
  hasCollapseHost.value = next
  if (returnFocus) void nextTick(() => rightPaneRef.value?.focus({ preventScroll: true }))
})

const { width: measuredLeftWidth } = useElementSize(computed(() => props.resizable ? leftPaneRef.value : undefined))
const rows = providePaneRows(() => props.showLeft && !isCollapsed.value)
const leftHeaderContent = ref<HTMLElement>(), rightHeaderContent = ref<HTMLElement>()
const leftToolbarContent = ref<HTMLElement>(), rightToolbarContent = ref<HTMLElement>()
const headerHeight = usePaneRow('header', leftHeaderContent, rows)
usePaneRow('header', rightHeaderContent, rows)
const toolbarHeight = usePaneRow('toolbar', leftToolbarContent, rows)
usePaneRow('toolbar', rightToolbarContent, rows)
watchEffect(() => {
  if (resizedWidth.value === undefined && !isCollapsed.value && measuredLeftWidth.value > 0) initialWidth.value = measuredLeftWidth.value
})
watch(() => props.leftWidth, () => { resizedWidth.value = undefined })
const panelLimits = computed(() => ({ min: 160, max: 480, ...props.resizeLimits, initial: initialWidth.value }))
function resizeLeft(width: number) {
  resizedWidth.value = width
  emit('resize', width)
}
watch([isCollapsed, () => props.showLeft, () => props.resizable], () => {
  const handle = resizeRef.value?.$el as HTMLElement | undefined
  if ((isCollapsed.value || !props.showLeft || !props.resizable) && handle?.contains(handle.ownerDocument.activeElement)) {
    void nextTick(() => (toggleRef.value?.$el ?? rightPaneRef.value)?.focus({ preventScroll: true }))
  }
})

const toggleText = computed(() => (
  isCollapsed.value
    ? $t('components.EqualHeightColumns.expand')
    : $t('components.EqualHeightColumns.collapse')
))

const toCssValue = (value: SizeValue) => typeof value === 'number' ? `${value}px` : value

const toGridTrack = (value: SizeValue, collapsed = false) => {
  if (collapsed) {
    // 保留弹性轨道类型，避免 fr 与 0px 之间无法插值而在动画中途跳变。
    return typeof value === 'string' && value.trim().endsWith('fr') ? '0fr' : '0px'
  }

  return toCssValue(value)
}

const rootStyle = (): Record<string, string> => ({
  '--equal-height-columns-height': toCssValue(props.height),
  '--equal-height-columns-padding': toCssValue(props.padding),
  // 左侧入口保留自身顶行宽度；只有右工具栏入口时左列才完全归零。
  '--equal-height-columns-gap': isCollapsed.value ? '0px' : toCssValue(props.gap),
  '--equal-height-columns-align': props.align,
  '--equal-height-columns-left-width': isCollapsed.value && usesLeftToggle()
    ? 'var(--equal-height-columns-collapsed-width)' : toGridTrack(resizedWidth.value ?? props.leftWidth, isCollapsed.value),
  '--equal-height-columns-right-width': toGridTrack(props.rightWidth),
})

const paneStyle = computed<CSSProperties>(() => ({
  minHeight: 'var(--equal-height-columns-height)',
}))

const rootAttrs = () => {
  return Object.fromEntries(
    Object.entries(attrs).filter(([key]) => !['class', 'style'].includes(key))
  )
}

const leftStyle = paneStyle
const rightStyle = paneStyle
</script>

<style scoped src="./index.css" />
