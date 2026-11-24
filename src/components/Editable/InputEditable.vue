<template>
  <span class="input-editable" :class="[`input-editable--${size}`, { 'input-editable--text': trigger === 'text', 'input-editable--has-action': !!$slots.action }]" :style="textStyle" @focusout="blur">
    <span class="input-editable__value" :class="{ 'is-editing': isEdit }" :aria-hidden="isEdit || undefined">
      <j-ellipsis>
        <button type="button" class="input-editable__text inline-edit-trigger" :disabled="disabled || isEdit || submitting" :aria-label="label" @click="startEdit">
          {{ _value || placeholder || $t('comm.table.empty') }}
        </button>
      </j-ellipsis>
    </span>
    <span v-if="isEdit" class="input-editable__control inline-edit-surface" :aria-disabled="disabled || submitting || undefined" :aria-invalid="error ? true : undefined">
      <a-input ref="inputRef" v-model:value="_value" :bordered="false" :size="size" :maxLength="maxLength"
        @press-enter="!$event.isComposing && submit()" @keydown.esc.stop="!$event.isComposing && cancel()" :disabled="disabled || submitting" :status="error ? 'error' : undefined" :aria-label="label" />
    </span>
    <span v-if="$slots.action" class="input-editable__action"><slot name="action" :value="_value" :editing="isEdit" :cancel="cancel" /></span>
    <a-button v-else-if="trigger === 'icon'" class="input-editable__action" :class="{ 'input-editable__action--hidden': disabled || isEdit }" type="link"
      :disabled="disabled || isEdit" :tabindex="disabled || isEdit ? -1 : 0" :aria-label="label || $t('Editable.edit')" @click="startEdit" size="small">
      <AIcon type="EditOutlined" />
    </a-button>
    <a-typography-text v-if="isEdit && error" class="input-editable__error" type="danger" role="alert">{{ error }}</a-typography-text>
  </span>
</template>

<script setup lang="ts">
import { nextTick, ref, watch, type CSSProperties } from 'vue'
const props = withDefaults(defineProps<{
  value?: string
  disabled?: boolean
  maxLength?: number
  placeholder?: string
  textStyle?: CSSProperties
  size?: 'small' | 'middle' | 'large'
  trigger?: 'icon' | 'text'
  label?: string
  error?: string
  /** 返回 false 保留编辑态，由调用方提供字段错误。 */
  save?: (value: string) => boolean | Promise<boolean>
}>(), { value: '', disabled: false, textStyle: () => ({}), size: 'middle', trigger: 'icon', error: '' })
const emit = defineEmits<{ (event: 'update:value' | 'change', value: string): void }>()
defineSlots<{ action?: (scope: { value: string; editing: boolean; cancel: () => void }) => unknown }>()
const _value = ref('')
const isEdit = ref(false)
const submitting = ref(false)
const inputRef = ref<{ focus(options?: FocusOptions): void }>()

async function startEdit() {
  if (props.disabled || submitting.value) return
  _value.value = props.value
  isEdit.value = true
  await nextTick()
  inputRef.value?.focus({ preventScroll: true })
}

async function submit() {
  if (!isEdit.value || props.disabled || submitting.value) return
  const value = _value.value
  if (value === props.value) { isEdit.value = false; return }
  submitting.value = true
  try {
    // Enter 随后可能触发失焦，提交期间只接受首次操作。
    if (props.save && !await props.save(value)) return
    isEdit.value = false
    emit('update:value', value)
    emit('change', value)
  } finally {
    submitting.value = false
  }
}

async function blur(event: FocusEvent) {
  const scope = event.currentTarget as HTMLElement
  if (scope.contains(event.relatedTarget as Node | null)) return
  await nextTick()
  if (!scope.contains(scope.ownerDocument.activeElement)) await submit()
}

function cancel() {
  if (submitting.value) return
  _value.value = props.value
  isEdit.value = false
}

watch(() => props.value, value => { _value.value = value }, { immediate: true })
watch(() => props.disabled, disabled => { if (disabled) cancel() })
</script>

<style scoped>
.input-editable { --input-editable-height:32px; position:relative; display:inline-grid; grid-template-columns:minmax(0,auto) 24px; grid-template-rows:var(--input-editable-height); align-items:center; column-gap:var(--space-2,8px); min-width:0; max-width:min(100%,var(--inline-edit-max-width,100%)); font:inherit; vertical-align:middle }
.input-editable--small { --input-editable-height:24px }
.input-editable--large { --input-editable-height:40px }
.input-editable--text:not(.input-editable--has-action) { grid-template-columns:minmax(0,auto) }
.input-editable__value { display:flex; align-items:center; min-width:0; height:100%; overflow:hidden; white-space:pre }
.input-editable__value.is-editing { visibility:hidden }
.input-editable__control { position:absolute; inset:0 32px auto 0; height:var(--input-editable-height); max-width:calc(100% - 32px) }
.input-editable--text:not(.input-editable--has-action) .input-editable__control { right:0; max-width:100% }
.input-editable__value :deep(.j-ellipsis) { width:100%; font:inherit; line-height:inherit }
.input-editable :deep(.ant-input) { min-width:0; width:100%; height:100%; font:inherit; padding:0; border:0; border-radius:0; box-shadow:none }
.input-editable__text { padding:0; border:0; background:transparent; font:inherit; color:inherit; text-align:start; cursor:pointer }
.input-editable__text:disabled { cursor:default }
.input-editable__text:focus-visible { outline:2px solid var(--jet-theme-primary); outline-offset:3px }
.input-editable__action { width:24px; height:24px; padding:0 }
.input-editable__action--hidden { visibility:hidden }
.input-editable__error { grid-column:1 / -1; grid-row:2 }
</style>
<style src="./inline-edit.css" />
