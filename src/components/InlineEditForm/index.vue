<template>
  <div class="inline-edit-form">
    <section v-for="group in groups" :key="group.key" class="inline-edit-form__section" :aria-label="group.title">
      <h3 v-if="group.title">{{ group.title }}</h3>
      <div class="inline-edit-form__grid">
        <InlineEditField v-for="field in group.fields" :key="field.key" ref="fields" :field="field" :mode="mode" :disabled="disabled" :busy="busy" :submit="submit" :messages="messages" @change="(key, value) => emit('change', key, value)" @cancel="emit('cancel', $event)" @focus="emit('focus', $event)">
          <template v-if="$slots.editor" #editor="scope"><slot name="editor" v-bind="scope" /></template>
          <template v-if="$slots.display" #display="scope"><slot name="display" v-bind="scope" /></template>
        </InlineEditField>
      </div>
    </section>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, type PropType } from 'vue'
import InlineEditField from './InlineEditField.vue'
import type { InlineEditGroup, InlineEditMessages, InlineEditSubmit } from './types'
defineProps({
  groups: { type: Array as PropType<InlineEditGroup[]>, required: true },
  mode: { type: String as PropType<'detail' | 'form'>, default: 'detail' },
  disabled: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  messages: { type: Object as PropType<InlineEditMessages>, required: true },
  submit: { type: Function as PropType<InlineEditSubmit>, default: undefined },
})
const emit = defineEmits<{ (event: 'change', key: string, value: unknown): void; (event: 'focus' | 'cancel', key: string): void }>()
const fields = ref<InstanceType<typeof InlineEditField>[]>([])
/** Open a related field through the same permission and pending guards as a user click. */
function editField(key: string) { fields.value.find(field => field.$props.field.key === key)?.begin() }
defineExpose({ editField })
</script>

<style scoped>
.inline-edit-form { min-width: 0; }
.inline-edit-form__section + .inline-edit-form__section { margin-top: var(--space-6); }
.inline-edit-form__section h3 { margin: 0 0 var(--space-4); color: var(--jet-theme-text-title); font-size: var(--fs-14); font-weight: 500; }
.inline-edit-form__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-5) var(--space-6); }
@media (max-width: 48rem) { .inline-edit-form__grid { grid-template-columns: minmax(0, 1fr); } }
</style>
