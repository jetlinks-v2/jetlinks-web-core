<template>
  <span class="input-editable" :class="[`input-editable--${size}`, { 'input-editable--text': trigger === 'text', 'input-editable--has-action': !!$slots.action, 'input-editable--multiline': textarea }]" :style="textStyle" @focusout="blur">
    <span class="input-editable__value" :class="{ 'is-editing': isEdit }" :aria-hidden="isEdit || undefined">
      <button v-if="textarea" ref="triggerRef" type="button" class="input-editable__text inline-edit-trigger" :disabled="disabled || isEdit || submitting" :aria-label="label" @click="startEdit"><span class="input-editable__paragraph">{{ _value || placeholder || $t('comm.table.empty') }}</span></button>
      <j-ellipsis v-else>
        <button type="button" class="input-editable__text inline-edit-trigger" :disabled="disabled || isEdit || submitting" :aria-label="label" @click="startEdit">
          {{ _value || placeholder || $t('comm.table.empty') }}
        </button>
      </j-ellipsis>
    </span>
    <span v-if="isEdit" class="input-editable__control inline-edit-surface" :aria-disabled="disabled || submitting || undefined" :aria-invalid="error ? true : undefined">
      <a-textarea v-if="textarea" ref="inputRef" v-model:value="_value" :bordered="false" :maxlength="maxLength" :placeholder="placeholder" :disabled="disabled || submitting" :status="error ? 'error' : undefined" :aria-label="label" @keydown="keydown" />
      <a-input v-else ref="inputRef" v-model:value="_value" :bordered="false" :size="size" :maxLength="maxLength"
        @press-enter="!$event.isComposing && submit()" @keydown="keydown" :disabled="disabled || submitting" :status="error ? 'error' : undefined" :aria-label="label" />
    </span>
    <span v-if="$slots.action" class="input-editable__action"><slot name="action" :value="_value" :editing="isEdit" :cancel="() => cancel(false)" /></span>
    <a-button v-else-if="trigger === 'icon'" class="input-editable__action" :class="{ 'input-editable__action--hidden': disabled || isEdit }" type="link"
      :disabled="disabled || isEdit" :tabindex="disabled || isEdit ? -1 : 0" :aria-label="label || $t('Editable.edit')" @click="startEdit" size="small">
      <AIcon type="EditOutlined" />
    </a-button>
    <a-typography-text v-if="isEdit && error" class="input-editable__error" type="danger" role="alert">{{ error }}</a-typography-text>
    <span v-if="textarea && isEdit" class="input-editable__footer">
      <a-button size="small" :disabled="submitting" @click="cancel()">{{ $t('Editable.cancel') }}</a-button>
      <a-button type="primary" size="small" :loading="submitting" :disabled="disabled" @click="submit">{{ $t('Editable.save') }}</a-button>
    </span>
  </span>
</template>

<script setup lang="ts">
import { nextTick, ref, watch, type CSSProperties } from 'vue'
const props = withDefaults(defineProps<{
  value?: string
  disabled?: boolean
  maxLength?: number
  textarea?: boolean
  placeholder?: string
  textStyle?: CSSProperties
  size?: 'small' | 'middle' | 'large'
  trigger?: 'icon' | 'text'
  label?: string
  error?: string
  /** 返回 false 保留编辑态，由调用方提供字段错误。 */
  save?: (value: string) => boolean | Promise<boolean>
}>(), { value: '', disabled: false, textarea: false, textStyle: () => ({}), size: 'middle', trigger: 'icon', error: '' })
const emit = defineEmits<{ (event: 'update:value' | 'change', value: string): void }>()
defineSlots<{ action?: (scope: { value: string; editing: boolean; cancel: () => void }) => unknown }>()
const _value = ref('')
const isEdit = ref(false)
const submitting = ref(false)
const inputRef = ref<{ focus(options?: FocusOptions): void }>()
const triggerRef = ref<HTMLButtonElement>()

function restoreFocus() {
  if (props.textarea) void nextTick(() => triggerRef.value?.focus({ preventScroll: true }))
}

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
  if (value === props.value) { isEdit.value = false; restoreFocus(); return }
  submitting.value = true
  try {
    // Enter 随后可能触发失焦，提交期间只接受首次操作。
    if (props.save && !await props.save(value)) return
    isEdit.value = false
    emit('update:value', value)
    emit('change', value)
    restoreFocus()
  } finally {
    submitting.value = false
  }
}

async function blur(event: FocusEvent) {
  if (props.textarea) return
  const scope = event.currentTarget as HTMLElement
  if (scope.contains(event.relatedTarget as Node | null)) return
  await nextTick()
  if (!scope.contains(scope.ownerDocument.activeElement)) await submit()
}

function cancel(returnFocus = true) {
  if (submitting.value) return
  _value.value = props.value
  isEdit.value = false
  if (returnFocus) restoreFocus()
}

function keydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    cancel()
  } else if (props.textarea && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    void submit()
  }
}

watch(() => props.value, value => { _value.value = value }, { immediate: true })
watch(() => props.disabled, disabled => { if (disabled) cancel(false) })
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
.input-editable--multiline { display:grid; width:100%; grid-template-rows:auto; align-items:start }
.input-editable--multiline .input-editable__value { grid-area:1/1; display:block; height:auto; min-height:var(--input-editable-height); max-height:var(--inline-edit-max-height,16rem); white-space:pre-wrap; overflow:auto }
.input-editable--multiline .input-editable__text { display:flex; align-items:flex-start; width:100%; min-height:var(--input-editable-height); line-height:inherit; white-space:pre-wrap; overflow-wrap:anywhere }
.input-editable__paragraph { width:100%; min-width:0 }
.input-editable__paragraph::after { content:'\200b' }
.input-editable--multiline .input-editable__control { position:relative; inset:auto; grid-area:1/1; width:100%; max-width:100%; height:auto; min-height:0; align-self:stretch; overflow:hidden }
.input-editable--multiline :deep(textarea.ant-input) { position:absolute; inset:0; display:block; height:100%; line-height:inherit; resize:none; overflow:auto }
.input-editable--multiline .input-editable__action { grid-column:2; grid-row:1 }
.input-editable__footer { grid-column:1 / -1; display:flex; justify-content:flex-end; gap:var(--space-2,8px); padding-top:var(--space-2,8px) }
</style>
<style src="./inline-edit.css" />
