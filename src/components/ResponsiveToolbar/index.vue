<template>
  <Teleport :to="dockTarget" :disabled="!docked">
  <div ref="root" v-bind="$attrs" class="responsive-toolbar" :class="{ 'is-stacked': stacked, 'is-docked': docked, 'is-undocked': !!referenceElement && !docked }">
    <div v-if="$slots.context" ref="context" class="responsive-toolbar__context" :class="{ 'is-hidden': !docked }" :inert="!docked || undefined" :aria-hidden="!docked || undefined"><slot name="context" /></div>
    <div v-if="$slots.leading" ref="leading" class="responsive-toolbar__leading"><slot name="leading" /></div>
    <div v-if="$slots.search" class="responsive-toolbar__search"><slot name="search" :stacked="stacked" /></div>
    <div v-if="$slots.actions" ref="actions" class="responsive-toolbar__actions"><slot name="actions" /></div>
    <div v-if="$slots.utilities" ref="utilities" class="responsive-toolbar__utilities" :class="{ 'is-hidden': !docked }" :inert="!docked || undefined" :aria-hidden="!docked || undefined"><slot name="utilities" /></div>
    <div v-if="$slots.selection" class="responsive-toolbar__selection"><slot name="selection" /></div>
  </div>
  </Teleport>
</template>
<script setup lang="ts">
import { computed, ref, toRef, useSlots, watch } from 'vue'
import { useElementSize } from '@vueuse/core'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ stackBelow?: number; dockTarget?: HTMLElement; referenceElement?: HTMLElement }>(), { stackBelow: 960 })
const emit = defineEmits<{ 'docked-change': [value: boolean] }>()
const slots = useSlots()
const root = ref<HTMLElement>()
const leading = ref<HTMLElement>(), actions = ref<HTMLElement>(), context = ref<HTMLElement>(), utilities = ref<HTMLElement>()
const { width } = useElementSize(root)
const { width: referenceWidth } = useElementSize(toRef(props, 'referenceElement'))
const { width: leadingWidth } = useElementSize(leading), { width: actionsWidth } = useElementSize(actions), { width: contextWidth } = useElementSize(context)
const { width: utilitiesWidth } = useElementSize(utilities)
const minimumWidth = computed(() => leadingWidth.value + actionsWidth.value + (slots.search ? 200 : 0) + 12 * Math.max(0, Number(!!slots.leading) + Number(!!slots.search) + Number(!!slots.actions) - 1))
const docked = computed(() => !!props.dockTarget && referenceWidth.value >= Math.max(props.stackBelow, minimumWidth.value + (slots.context ? contextWidth.value + 12 : 0) + (slots.utilities ? utilitiesWidth.value + 12 : 0)))
const stacked = computed(() => !docked.value && width.value < Math.max(props.stackBelow, minimumWidth.value))
watch(docked, value => emit('docked-change', value), { immediate: true })
</script>
<style scoped>
.responsive-toolbar { position:relative; z-index:10; display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; width:100%; min-width:0; container-type:inline-size; }
.responsive-toolbar.is-undocked { flex:none; padding:12px 16px; border-bottom:1px solid var(--line); box-sizing:border-box; }
.responsive-toolbar__context, .responsive-toolbar__leading, .responsive-toolbar__actions, .responsive-toolbar__utilities { display:flex; flex-wrap:wrap; align-items:center; gap:8px; min-width:0; }
.responsive-toolbar__context, .responsive-toolbar__utilities { flex:none; width:max-content; }
.responsive-toolbar__context.is-hidden, .responsive-toolbar__utilities.is-hidden { position:absolute; visibility:hidden; pointer-events:none; }
/* Keep measured groups at content width so wrapping cannot feed back into the docking decision. */
.responsive-toolbar__leading { flex:none; max-width:100%; }
.responsive-toolbar__search { flex:1; min-width:200px; }
.responsive-toolbar__actions { flex:none; max-width:100%; margin-inline-start:auto; }
.responsive-toolbar.is-stacked .responsive-toolbar__search { order:3; flex-basis:100%; min-width:0; }
.responsive-toolbar__selection { order:4; width:100%; min-width:0; }
@container (max-width:480px) { .responsive-toolbar__actions { margin-inline-start:0; } }
</style>
