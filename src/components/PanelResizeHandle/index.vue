<template>
  <div class="panel-resize-handle" :class="[attrs.class, { 'is-dragging': dragging, 'is-controls-open': controlsOpen }]" :style="attrs.style as StyleValue">
    <div v-bind="separatorAttrs()" class="panel-resize-handle__separator" role="separator" tabindex="0" aria-orientation="vertical"
      :aria-label="accessibleLabel()" :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="size"
      @pointerdown="start" @pointermove="move" @pointerup="finish" @pointercancel="cancel" @lostpointercapture="cancel"
      @dblclick="reset()" @keydown.left.prevent="side === 'left' ? shrink() : grow()" @keydown.right.prevent="side === 'left' ? grow() : shrink()"
      @keydown.home.prevent="setSize(min)" @keydown.end.prevent="setSize(max)" @keydown.esc.prevent="cancel()" />
    <a-popover v-model:open="controlsOpen" trigger="click" placement="right">
      <a-button ref="controlsRef" class="panel-resize-handle__controls" type="text" size="small" :aria-label="accessibleLabel()"
        :title="accessibleLabel()" :aria-expanded="controlsOpen" :aria-controls="controlsId" @keydown.esc.prevent.stop="closeControls"><AIcon type="MoreOutlined" /></a-button>
      <template #content>
        <div :id="controlsId" class="panel-resize-handle__actions" role="group" :aria-label="accessibleLabel()" @keydown.esc.prevent.stop="closeControls">
          <a-button size="small" :disabled="size <= min" @click="shrink">{{ t('components.PanelResizeHandle.shrink') }}</a-button>
          <a-button size="small" :disabled="size >= max" @click="grow">{{ t('components.PanelResizeHandle.grow') }}</a-button>
          <a-button size="small" @click="reset">{{ t('components.PanelResizeHandle.reset') }}</a-button>
        </div>
      </template>
    </a-popover>
  </div>
</template>
<script setup lang="ts">
import { nextTick, ref, useAttrs, useId, type StyleValue } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePanelResize } from './usePanelResize'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue: number; container?: HTMLElement; side?: 'left' | 'right'; limits?: { min?: number; max?: number; contentMin?: number; initial?: number } }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: number): void }>()
const attrs = useAttrs()
const { t } = useI18n()
const controlsId = `panel-resize-${useId()}`
const accessibleLabel = () => typeof attrs['aria-label'] === 'string' && attrs['aria-label'] ? attrs['aria-label'] : t('components.PanelResizeHandle.resize')
const separatorAttrs = () => Object.fromEntries(Object.entries(attrs).filter(([key]) => !['class', 'style'].includes(key)))
const { min, max, size, dragging, controlsOpen, start, move, finish, cancel, reset, setSize, grow, shrink } = usePanelResize(props, value => emit('update:modelValue', value))
const controlsRef = ref<{ $el?: HTMLButtonElement }>()
function closeControls() {
  controlsOpen.value = false
  void nextTick(() => controlsRef.value?.$el?.focus({ preventScroll: true }))
}
</script>
<style scoped>
.panel-resize-handle { grid-column:2; grid-row:1; align-self:stretch; justify-self:start; position:relative; width:10px; margin-left:-5px; z-index:2 }
.panel-resize-handle__separator { height:100%; cursor:col-resize; touch-action:none; user-select:none; outline:none }
.panel-resize-handle__separator::after { content:''; position:absolute; left:4px; top:0; bottom:0; width:1px; background:var(--line-2,var(--line)) }
.panel-resize-handle__separator::before { content:''; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:3px; height:24px; border-radius:2px; background:var(--ink-2); opacity:0; transition:opacity 120ms ease }
.panel-resize-handle:hover .panel-resize-handle__separator::before,.panel-resize-handle:has(:focus-visible) .panel-resize-handle__separator::before,.panel-resize-handle.is-dragging .panel-resize-handle__separator::before { opacity:1 }
.panel-resize-handle:hover .panel-resize-handle__separator::after { background:var(--line-strong,var(--line)) }
.panel-resize-handle__separator:focus-visible::after,.panel-resize-handle.is-dragging .panel-resize-handle__separator::after { background:var(--accent) }
.panel-resize-handle__separator:focus-visible { outline:1px solid var(--accent); outline-offset:-2px }
.panel-resize-handle__controls.ant-btn { position:absolute; top:var(--space-3,12px); left:50%; transform:translateX(-50%); width:24px; height:24px; padding:0; color:var(--ink-2); border:0; background:var(--bg-elev,var(--bg)); opacity:0; pointer-events:none; transition:opacity 120ms ease }
.panel-resize-handle:hover .panel-resize-handle__controls,.panel-resize-handle:has(:focus-visible) .panel-resize-handle__controls,.panel-resize-handle.is-controls-open .panel-resize-handle__controls { opacity:1; pointer-events:auto }
.panel-resize-handle__controls.ant-btn:hover { color:var(--accent) }
.panel-resize-handle__actions { display:flex; flex-wrap:wrap; gap:var(--space-2,8px) }
@media (hover:none) { .panel-resize-handle__controls.ant-btn { opacity:1; pointer-events:auto } }
@media (prefers-reduced-motion:reduce) { .panel-resize-handle__separator::before,.panel-resize-handle__controls.ant-btn { transition:none } }
</style>
