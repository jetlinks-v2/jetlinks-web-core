<template>
  <span ref="root" v-bind="$attrs" class="inline-edit-surface" :class="{ 'inline-edit-surface--static': !$slots.display }">
    <span v-if="$slots.display" class="inline-edit-surface__display" :class="{ 'is-hidden': active() }" :inert="active() || undefined" :aria-hidden="active() || undefined"><slot name="display" :content-id="contentId" /></span>
  </span>
    <Teleport to="body" :disabled="!$slots.display">
      <div :id="contentId" ref="layer" v-show="active() || !$slots.display" class="inline-edit-surface__layer" :class="{ 'is-active':active(), 'is-ready':ready, 'is-floating':active() && floating }" :style="active() ? style : undefined" :inert="active() && !ready || undefined" :aria-hidden="active() && !ready || undefined" role="group" :aria-label="label" tabindex="-1">
        <div ref="content" class="inline-edit-surface__content"><slot /></div>
      </div>
    </Teleport>
</template>
<script setup lang="ts">
import { ref, useId, useSlots } from 'vue'
import { useInlineEditSurface } from './useInlineEditSurface'
defineOptions({ inheritAttrs:false })
const props = withDefaults(defineProps<{ open?: boolean; label?: string }>(), { open:false })
const slots = useSlots(), contentId = `inline-edit-surface-${useId()}`
const root = ref<HTMLElement>(), layer = ref<HTMLElement>(), content = ref<HTMLElement>()
const active = () => props.open && !!slots.display
const { floating, ready, style } = useInlineEditSurface({ open:active, hasDisplay:() => !!slots.display, root, layer, content })
</script>
<style scoped>
.inline-edit-surface,.inline-edit-surface__display { display:inline-flex; align-items:center; min-width:0; max-width:100%; }
.inline-edit-surface__display.is-hidden { opacity:0; pointer-events:none; }
.inline-edit-surface--static { display:none; }
.inline-edit-surface__layer:not(.is-active),.inline-edit-surface__layer:not(.is-active) > .inline-edit-surface__content { display:contents; }
.inline-edit-surface__layer.is-active { position:fixed; z-index:1000; box-sizing:border-box; max-height:calc(100vh - 32px); overflow:auto; opacity:0; pointer-events:none; background:var(--jet-theme-bg-container); }
.inline-edit-surface__layer.is-ready { opacity:1; pointer-events:auto; }
.inline-edit-surface__layer.is-floating { padding:8px; border:1px solid var(--line); border-radius:var(--r-2); box-shadow:var(--shadow-2,0 4px 16px rgb(0 0 0 / 12%)); }
.inline-edit-surface__layer.is-active > .inline-edit-surface__content { width:max-content; max-width:calc(100vw - 52px); }
</style>
