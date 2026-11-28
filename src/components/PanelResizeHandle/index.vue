<template>
  <div class="panel-resize-handle" :class="[attrs.class, { 'is-dragging': dragging, 'is-vertical': orientation === 'vertical', 'is-collapsed': collapsed, 'is-pointer-focused': pointerFocused }]" :style="attrs.style as StyleValue">
    <div v-bind="separatorAttrs()" class="panel-resize-handle__separator" role="separator" tabindex="0"
      :aria-orientation="orientation === 'vertical' ? 'horizontal' : 'vertical'"
      :aria-label="accessibleLabel()" :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="size"
      @pointerdown="startPointer" @pointermove="move" @pointerup="finish" @pointercancel="cancel" @lostpointercapture="cancel"
      @click="activate" @dblclick="reset()" @keydown="onKeydown" @blur="pointerFocused = false" />
  </div>
</template>
<script setup lang="ts">
import { ref, useAttrs, type StyleValue } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePanelResize } from './usePanelResize'
import type { PanelResizeDragEvent } from './types'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue: number; container?: HTMLElement; side?: 'left' | 'right'; orientation?: 'horizontal' | 'vertical'; collapsed?: boolean; limits?: { min?: number; max?: number; contentMin?: number; initial?: number } }>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: number): void
  (event: 'drag', value: PanelResizeDragEvent): void
  (event: 'expand'): void
}>()
const attrs = useAttrs()
const { t } = useI18n()
const accessibleLabel = () => typeof attrs['aria-label'] === 'string' && attrs['aria-label'] ? attrs['aria-label'] : t('components.PanelResizeHandle.resize')
const separatorAttrs = () => Object.fromEntries(Object.entries(attrs).filter(([key]) => !['class', 'style'].includes(key)))
const { min, max, size, dragging, hasDragged, start, move, finish, cancel, reset, setSize, grow, shrink } = usePanelResize(props, value => emit('update:modelValue', value), event => emit('drag', event))
const pointerFocused = ref(false)
function activate() {
  if (props.collapsed && !hasDragged.value) emit('expand')
}
function startPointer(event: PointerEvent) {
  pointerFocused.value = true
  start(event)
}
function onKeydown(event: KeyboardEvent) {
  pointerFocused.value = false
  const forward = props.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
  const backward = props.orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
  if (![forward, backward, 'Home', 'End', 'Escape', 'Enter', ' '].includes(event.key)) return
  event.preventDefault()
  if (event.key === forward) props.side === 'left' ? grow() : shrink()
  else if (event.key === backward) props.side === 'left' ? shrink() : grow()
  else if (event.key === 'Home') setSize(min.value)
  else if (event.key === 'End') setSize(max.value)
  else if (event.key === 'Escape') cancel()
  else if (props.collapsed) emit('expand')
  else reset()
}
</script>
<style scoped>
.panel-resize-handle { grid-column:2; grid-row:1; align-self:stretch; justify-self:start; position:relative; width:12px; margin-left:-6px; z-index:2 }
.panel-resize-handle__separator { height:100%; cursor:col-resize; touch-action:none; user-select:none; outline:none }
.panel-resize-handle__separator::after { content:''; position:absolute; left:50%; top:0; bottom:0; width:1px; transform:translateX(calc(-50% + var(--panel-resize-line-offset, 0px))); background:var(--line) }
.panel-resize-handle.is-collapsed .panel-resize-handle__separator::after { display:none }
.panel-resize-handle__separator::before { content:''; position:absolute; z-index:1; top:50%; left:50%; transform:translate(-50%,-50%); width:2px; height:20px; border-radius:1px; background:var(--ink-3,var(--ink-2)); opacity:0; transition:opacity var(--motion-duration-fast,0.15s) var(--motion-ease-standard,ease) }
.panel-resize-handle:hover .panel-resize-handle__separator::before,.panel-resize-handle:not(.is-pointer-focused):has(:focus-visible) .panel-resize-handle__separator::before,.panel-resize-handle.is-dragging .panel-resize-handle__separator::before { opacity:1 }
.panel-resize-handle:not(.is-pointer-focused) .panel-resize-handle__separator:focus-visible::before,.panel-resize-handle.is-dragging .panel-resize-handle__separator::before { background:var(--accent) }
.panel-resize-handle:not(.is-pointer-focused) .panel-resize-handle__separator:focus-visible::before { box-shadow:0 0 0 1px var(--accent) }
.panel-resize-handle.is-vertical { grid-column:1; grid-row:2; align-self:start; justify-self:stretch; width:auto; height:12px; margin-left:0; margin-top:-6px }
.is-vertical .panel-resize-handle__separator { width:100%; cursor:row-resize }
.is-vertical .panel-resize-handle__separator::after { top:50%; left:0; right:0; bottom:auto; width:auto; height:1px; transform:translateY(calc(-50% + var(--panel-resize-line-offset, 0px))) }
.is-vertical .panel-resize-handle__separator::before { width:20px; height:2px }
@media (hover:none) { .panel-resize-handle__separator::before { opacity:1 } }
@media (prefers-reduced-motion:reduce) { .panel-resize-handle__separator::before { transition:none } }
</style>
