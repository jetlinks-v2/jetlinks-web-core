<template>
  <div class="panel-resize-handle" :class="{ 'is-dragging': dragging }" role="separator" tabindex="0" aria-orientation="vertical"
    :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="size"
    @pointerdown="start" @pointermove="move" @pointerup="finish" @pointercancel="cancel" @lostpointercapture="finish"
    @dblclick="reset" @keydown.left.prevent="setSize(size + 16)" @keydown.right.prevent="setSize(size - 16)"
    @keydown.home.prevent="setSize(min)" @keydown.end.prevent="setSize(max)" @keydown.esc.prevent="cancel" />
</template>
<script setup lang="ts">
import { usePanelResize } from './usePanelResize'
const props = defineProps<{ modelValue: number; container?: HTMLElement; limits?: { min?: number; max?: number; contentMin?: number; initial?: number } }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: number): void }>()
const { min, max, size, dragging, start, move, finish, cancel, reset, setSize } = usePanelResize(props, value => emit('update:modelValue', value))
</script>
<style scoped>
.panel-resize-handle { grid-column:2; grid-row:1; align-self:stretch; justify-self:start; position:relative; width:10px; margin-left:-5px; z-index:2; cursor:col-resize; touch-action:none; user-select:none; outline:none }
.panel-resize-handle::after { content:''; position:absolute; left:4px; top:calc(50% - 20px); width:2px; height:40px; border-radius:2px; background:var(--line-2,var(--line)) }
.panel-resize-handle:hover::after,.panel-resize-handle:focus-visible::after,.panel-resize-handle.is-dragging::after { background:var(--accent); width:3px }
.panel-resize-handle:focus-visible { outline:1px solid var(--accent); outline-offset:-2px }
</style>
