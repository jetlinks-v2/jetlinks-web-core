<template>
  <div class="panel-resize-handle" :class="[attrs.class, { 'is-dragging': dragging, 'is-controls-open': controlsOpen, 'is-vertical': orientation === 'vertical' }]" :style="attrs.style as StyleValue">
    <a-popover :open="controlsOpen" trigger="click" :placement="orientation === 'vertical' ? 'bottom' : 'right'" @open-change="changeControls">
      <div ref="separatorRef" v-bind="separatorAttrs()" class="panel-resize-handle__separator" role="separator" tabindex="0"
        :aria-orientation="orientation === 'vertical' ? 'horizontal' : 'vertical'" aria-haspopup="dialog"
        :aria-label="accessibleLabel()" :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="size"
        @pointerdown="start" @pointermove="move" @pointerup="finish" @pointercancel="cancel" @lostpointercapture="cancel"
        @dblclick="reset()" @keydown="onKeydown" />
      <template #content>
        <div :id="controlsId" ref="actionsRef" class="panel-resize-handle__actions" role="dialog" :aria-label="accessibleLabel()" @keydown.esc.prevent.stop="closeControls">
          <a-button size="small" :disabled="size <= min" @click="shrink">{{ t('components.PanelResizeHandle.shrink') }}</a-button>
          <a-button size="small" :disabled="size >= max" @click="grow">{{ t('components.PanelResizeHandle.grow') }}</a-button>
          <a-button size="small" @click="reset">{{ t('components.PanelResizeHandle.reset') }}</a-button>
        </div>
      </template>
    </a-popover>
  </div>
</template>
<script setup lang="ts">
import { nextTick, ref, useAttrs, useId, watch, type StyleValue } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElementVisibility } from '@vueuse/core'
import { usePanelResize } from './usePanelResize'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue: number; container?: HTMLElement; side?: 'left' | 'right'; orientation?: 'horizontal' | 'vertical'; limits?: { min?: number; max?: number; contentMin?: number; initial?: number } }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: number): void }>()
const attrs = useAttrs()
const { t } = useI18n()
const controlsId = `panel-resize-${useId()}`
const accessibleLabel = () => typeof attrs['aria-label'] === 'string' && attrs['aria-label'] ? attrs['aria-label'] : t('components.PanelResizeHandle.resize')
const separatorAttrs = () => Object.fromEntries(Object.entries(attrs).filter(([key]) => !['class', 'style'].includes(key)))
const { min, max, size, dragging, controlsOpen, hasDragged, start, move, finish, cancel, reset, setSize, grow, shrink } = usePanelResize(props, value => emit('update:modelValue', value))
const separatorRef = ref<HTMLElement>()
const actionsRef = ref<HTMLElement>()
const actionsVisible = useElementVisibility(actionsRef)
let keyboardControls = false
function focusActions() {
  if (!keyboardControls || !controlsOpen.value || !actionsVisible.value || !actionsRef.value) return
  actionsRef.value.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
  keyboardControls = false
}
// Popover 延迟挂载并有显隐过渡，内容实际可见后再交付键盘焦点。
watch([actionsVisible, controlsOpen], focusActions, { flush: 'post' })
function changeControls(open: boolean) {
  // 拖动结束后的合成 click 不打开操作菜单。
  if (!open || !hasDragged.value) {
    keyboardControls = false
    controlsOpen.value = open
  }
}
function closeControls() {
  keyboardControls = false
  controlsOpen.value = false
  void nextTick(() => separatorRef.value?.focus({ preventScroll: true }))
}
function onKeydown(event: KeyboardEvent) {
  const forward = props.orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
  const backward = props.orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
  if (![forward, backward, 'Home', 'End', 'Escape', 'Enter', ' '].includes(event.key)) return
  event.preventDefault()
  if (event.key === forward) props.side === 'left' ? grow() : shrink()
  else if (event.key === backward) props.side === 'left' ? shrink() : grow()
  else if (event.key === 'Home') setSize(min.value)
  else if (event.key === 'End') setSize(max.value)
  else if (event.key === 'Escape') { cancel(); closeControls() }
  else if (controlsOpen.value) closeControls()
  else {
    keyboardControls = true
    controlsOpen.value = true
    void nextTick(focusActions)
  }
}
</script>
<style scoped>
.panel-resize-handle { grid-column:2; grid-row:1; align-self:stretch; justify-self:start; position:relative; width:12px; margin-left:-6px; z-index:2 }
.panel-resize-handle__separator { height:100%; cursor:col-resize; touch-action:none; user-select:none; outline:none }
.panel-resize-handle__separator::after { content:''; position:absolute; left:50%; top:0; bottom:0; width:1px; transform:translateX(-50%); background:var(--line-2,var(--line)) }
.panel-resize-handle__separator::before { content:''; position:absolute; z-index:1; top:50%; left:50%; transform:translate(-50%,-50%); width:2px; height:20px; border-radius:1px; background:var(--ink-3,var(--ink-2)); opacity:0; transition:opacity 120ms ease }
.panel-resize-handle:hover .panel-resize-handle__separator::before,.panel-resize-handle:has(:focus-visible) .panel-resize-handle__separator::before,.panel-resize-handle.is-dragging .panel-resize-handle__separator::before,.panel-resize-handle.is-controls-open .panel-resize-handle__separator::before { opacity:1 }
.panel-resize-handle:hover .panel-resize-handle__separator::after { width:2px; background:var(--accent-soft) }
.panel-resize-handle__separator:focus-visible::after,.panel-resize-handle.is-dragging .panel-resize-handle__separator::after { width:2px; background:var(--accent) }
.panel-resize-handle__separator:focus-visible { outline:1px solid var(--accent); outline-offset:-2px }
.panel-resize-handle__actions { display:flex; flex-wrap:wrap; gap:var(--space-2,8px) }
.panel-resize-handle.is-vertical { grid-column:1; grid-row:2; align-self:start; justify-self:stretch; width:auto; height:12px; margin-left:0; margin-top:-6px }
.is-vertical .panel-resize-handle__separator { width:100%; cursor:row-resize }
.is-vertical .panel-resize-handle__separator::after { top:50%; left:0; right:0; bottom:auto; width:auto; height:1px; transform:translateY(-50%) }
.is-vertical .panel-resize-handle__separator::before { width:20px; height:2px }
.is-vertical:hover .panel-resize-handle__separator::after,.is-vertical .panel-resize-handle__separator:focus-visible::after,.is-vertical.is-dragging .panel-resize-handle__separator::after { width:auto; height:2px }
@media (hover:none) { .panel-resize-handle__separator::before { opacity:1 } }
@media (prefers-reduced-motion:reduce) { .panel-resize-handle__separator::before { transition:none } }
</style>
