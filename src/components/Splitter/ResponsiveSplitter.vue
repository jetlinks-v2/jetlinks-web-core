<template>
  <div ref="workspaceRef" class="responsive-splitter" :class="{ 'is-compact': compact, 'is-vertical': orientation === 'vertical' }">
    <PanelResizeHandle v-if="compact" ref="edgeRef" class="responsive-splitter__edge" :style="{ margin: 0, width: '100%', height: '100%' }"
      :orientation="orientation" side="left" :container="workspaceRef" :model-value="0" :limits="{ min: 0, max: drawerExtent, initial: 0, contentMin: 0 }"
      collapsed :inert="overlayOpen || undefined" :aria-controls="startId" :aria-label="t('components.Splitter.dragToExpand')"
      @expand="setCollapsed(false)" @drag="drag($event, drawerExtent)" />
    <Splitter :collapsed="inlineCollapsed" :size="preferredSize" :resizable="resizable && !compact" :collapse-on-drag="collapseOnDrag"
      :orientation="orientation" :default-size="defaultSize" :min="min" :max="max" :end-min="endMin" :resize-label="resizeLabel" :inert="drawerShown || undefined"
      class="responsive-splitter__layout" @update:collapsed="setCollapsed" @update:size="rememberSize">
      <template #start><div ref="inlineTarget" class="responsive-splitter__target" /></template>
      <template #end><slot name="end" :collapsed="visibleCollapsed" :toggle="toggle" :compact="compact" :overlay-open="overlayOpen" :start-id="startId" /></template>
    </Splitter>
    <Drawer :open="drawerShown" :mask="overlayOpen" force-render :destroy-on-close="false" :get-container="false" :autofocus="false"
      :placement="orientation === 'vertical' ? 'top' : 'left'" :width="orientation === 'horizontal' ? drawerExtent : undefined" :height="orientation === 'vertical' ? drawerExtent : undefined"
      :content-wrapper-style="drawerStyle" :root-style="{ position: 'absolute' }" :body-style="{ padding: 0, minHeight: 0 }"
      :closable="false" @close="close()">
      <div class="responsive-splitter__dialog" role="dialog" :aria-label="panelTitle || t('components.Splitter.panel')" :aria-modal="false" :aria-hidden="!overlayOpen || undefined" :inert="!overlayOpen || undefined">
        <header class="responsive-splitter__heading"><strong>{{ panelTitle || t('components.Splitter.panel') }}</strong><Button type="text" :aria-label="t('components.Splitter.close')" @click="close()"><CloseOutlined /></Button></header>
        <div ref="drawerTarget" class="responsive-splitter__target" />
      </div>
    </Drawer>
    <Teleport v-if="navigationTarget" :to="navigationTarget"><div :id="startId" class="responsive-splitter__content"><slot name="start" :close="close" :compact="compact" /></div></Teleport>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type CSSProperties } from 'vue'
import { useElementSize, useMediaQuery } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { Button, Drawer } from 'ant-design-vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import Splitter from './index.vue'
import PanelResizeHandle from '../PanelResizeHandle/index.vue'
import { useResponsivePanel } from './useResponsivePanel'
const props = withDefaults(defineProps<{
  orientation?: 'horizontal' | 'vertical'
  size?: number
  defaultSize?: number | string
  min: number
  endMin: number
  max?: number
  resizable?: boolean
  collapseOnDrag?: boolean
  collapsed?: boolean
  resizeLabel?: string
  panelTitle?: string
}>(), { orientation: 'horizontal', defaultSize: '30%', max: Infinity, resizable: true, collapseOnDrag: false, collapsed: undefined })
const emit = defineEmits<{
  (event: 'update:collapsed', value: boolean): void
  (event: 'update:size' | 'resize', value: number): void
}>()
const { t } = useI18n()
const workspaceRef = ref<HTMLElement>(), inlineTarget = ref<HTMLElement>(), drawerTarget = ref<HTMLElement>()
const edgeRef = ref<InstanceType<typeof PanelResizeHandle>>()
const startId = `responsive-pane-${useId()}`
const { width, height } = useElementSize(workspaceRef)
const coarse = useMediaQuery('(pointer: coarse)')
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const extent = computed(() => props.orientation === 'vertical' ? height.value : width.value)
const compact = computed(() => extent.value > 0 && extent.value < props.min + props.endMin + (coarse.value ? 24 : 12))
const localPreference = ref(props.collapsed ?? false)
const preference = computed({ get: () => props.collapsed ?? localPreference.value, set: value => {
  if (props.collapsed === undefined) localPreference.value = value
  emit('update:collapsed', value)
} })
watch(() => props.collapsed, value => { if (value !== undefined) localPreference.value = value })
const { collapsed: visibleCollapsed, inlineCollapsed, overlayOpen, revealSize, drag, toggle, setCollapsed, close: dismiss } = useResponsivePanel(preference, compact)
const drawerShown = computed(() => overlayOpen.value || (revealSize.value ?? 0) > 0)
const localSize = ref<number>()
const preferredSize = computed(() => props.size ?? localSize.value)
const drawerExtent = computed(() => Math.min(Math.max(0, extent.value - 44), Math.max(props.min, preferredSize.value ?? 0, props.orientation === 'vertical' ? 240 : 280)))
const drawerStyle = computed<CSSProperties>(() => ({
  ...(props.orientation === 'vertical' ? { height: `${drawerExtent.value}px` } : { width: `${drawerExtent.value}px` }),
  transform: overlayOpen.value ? undefined : `${props.orientation === 'vertical' ? 'translateY' : 'translateX'}(${(revealSize.value ?? 0) - drawerExtent.value}px)`,
  transition: revealSize.value !== undefined || !overlayOpen.value || reducedMotion.value ? 'none' : undefined,
}))
const navigationTarget = computed(() => compact.value ? drawerTarget.value : inlineTarget.value)
function rememberSize(value: number) {
  if (compact.value) return
  if (props.size === undefined) localSize.value = value
  emit('update:size', value); emit('resize', value)
}
let returnFocus: HTMLElement | undefined
function edgeFocus() { return edgeRef.value?.$el?.querySelector('[role="separator"]') as HTMLElement | undefined }
function close(target?: HTMLElement) {
  if (target) returnFocus = target
  dismiss()
}
watch(overlayOpen, async (open, previous, onCleanup) => {
  let current = true
  onCleanup(() => { current = false })
  const document = workspaceRef.value?.ownerDocument
  if (open) returnFocus = workspaceRef.value?.querySelector('.ant-drawer')?.contains(document?.activeElement ?? null)
    ? edgeFocus() : document?.activeElement as HTMLElement | undefined
  await nextTick()
  if (!current) return
  if (open) drawerTarget.value?.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled), [tabindex="0"]')?.focus({ preventScroll: true })
  else if (previous && document && (document.activeElement === document.body || workspaceRef.value?.contains(document.activeElement))) returnFocus?.focus({ preventScroll: true })
})
watch(revealSize, async (value, previous) => {
  if (value !== undefined || previous === undefined || overlayOpen.value) return
  await nextTick()
  const document = workspaceRef.value?.ownerDocument
  if (document && (document.activeElement === document.body || workspaceRef.value?.querySelector('.ant-drawer')?.contains(document.activeElement))) edgeFocus()?.focus({ preventScroll: true })
})
watch(compact, async narrow => {
  const active = workspaceRef.value?.ownerDocument.activeElement as HTMLElement | undefined
  const fromInline = active && inlineTarget.value?.contains(active)
  const fromDrawer = active && drawerTarget.value?.contains(active)
  await nextTick()
  if (narrow && fromInline) edgeFocus()?.focus({ preventScroll: true })
  else if (!narrow && fromDrawer && active?.ownerDocument.activeElement === active?.ownerDocument.body) {
    if (!preference.value) active?.focus({ preventScroll: true })
    else returnFocus?.focus({ preventScroll: true })
  }
})
watch(() => props.orientation, () => { localSize.value = undefined; dismiss() })
defineExpose({ toggle, close, collapsed: visibleCollapsed, compact, startId })
</script>
<style scoped>
.responsive-splitter { position:relative; display:grid; grid-template:minmax(0,1fr) / minmax(0,1fr); height:100%; min-height:0; min-width:0; overflow:hidden; }
.responsive-splitter.is-compact { grid-template-columns:12px minmax(0,1fr); }
.responsive-splitter.is-compact.is-vertical { grid-template:12px minmax(0,1fr) / minmax(0,1fr); }
.responsive-splitter__layout { grid-area:1/1/2/2; min-width:0; }
.is-compact:not(.is-vertical) > .responsive-splitter__layout { grid-column:2; }
.is-compact.is-vertical > .responsive-splitter__layout { grid-row:2; }
.responsive-splitter__edge { grid-area:1/1/2/2; }
.responsive-splitter__target,.responsive-splitter__content { height:100%; min-height:0; overflow:auto; }
.responsive-splitter__dialog { display:flex; flex-direction:column; height:100%; min-height:0; }
.responsive-splitter__dialog > .responsive-splitter__target { flex:1; }
.responsive-splitter__heading { display:flex; flex:none; align-items:center; justify-content:space-between; gap:8px; padding:8px 12px; border-bottom:1px solid var(--line); }
.responsive-splitter__heading :deep(.ant-btn) { min-width:32px; height:32px; padding:0; }
@media(pointer:coarse) {
  .responsive-splitter.is-compact:not(.is-vertical) { grid-template-columns:24px minmax(0,1fr); }
  .responsive-splitter.is-compact.is-vertical { grid-template-rows:24px minmax(0,1fr); }
  .responsive-splitter__heading :deep(.ant-btn) { min-width:44px; height:44px; }
}
</style>
