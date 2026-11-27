<template>
  <span ref="rootRef" class="input-editable" :class="[`input-editable--${size}`, { 'input-editable--text': trigger === 'text', 'input-editable--has-action': !!$slots.action, 'input-editable--multiline': textarea }]" :style="textStyle" @focusout="blur">
  <a-popover v-if="textarea" :open="isEdit" :trigger="[]" placement="bottomRight">
    <template #content>
      <div ref="actionsRef" @keydown.esc.stop.prevent="cancel()">
        <a-typography-text v-if="currentError" class="input-editable__error" type="danger" role="alert">{{ currentError }}</a-typography-text>
        <div class="input-editable__footer">
          <a-button size="small" :disabled="submitting" @click="cancel()">{{ $t('Editable.cancel') }}</a-button>
          <a-button type="primary" size="small" :loading="submitting" :disabled="disabled" @click="submit()">{{ $t('Editable.save') }}</a-button>
        </div>
      </div>
    </template>
    <span class="input-editable__popup-anchor" aria-hidden="true" />
  </a-popover>
    <span class="input-editable__value" :class="{ 'is-editing': isEdit }" :aria-hidden="isEdit || undefined">
      <button v-if="textarea" ref="triggerRef" type="button" class="input-editable__text inline-edit-trigger" :disabled="disabled || isEdit || submitting" :aria-label="label" @click="startEdit"><span class="input-editable__paragraph">{{ _value || placeholder || $t('comm.table.empty') }}</span></button>
        <button v-else ref="triggerRef" type="button" class="input-editable__text inline-edit-trigger" :disabled="disabled || isEdit || submitting" :aria-label="label" @click="startEdit">
          {{ _value || placeholder || $t('comm.table.empty') }}
        </button>
    </span>
    <span v-if="isEdit" class="input-editable__control inline-edit-surface" :aria-disabled="disabled || submitting || undefined" :aria-invalid="currentError ? true : undefined">
      <a-textarea v-if="textarea" ref="inputRef" v-model:value="_value" :bordered="false" :maxlength="maxLength" :placeholder="placeholder" :disabled="disabled || submitting" :status="currentError ? 'error' : undefined" :aria-label="label" @keydown="keydown" />
      <a-input v-else ref="inputRef" v-model:value="_value" :bordered="false" :size="size" :maxLength="maxLength"
        @press-enter="!$event.isComposing && submit()" @keydown="keydown" :disabled="disabled || submitting" :status="currentError ? 'error' : undefined" :aria-label="label" />
    </span>
    <span v-if="$slots.action" class="input-editable__action"><slot name="action" :value="_value" :editing="isEdit" :cancel="() => cancel(false)" /></span>
    <a-button v-else-if="trigger === 'icon'" class="input-editable__action" :class="{ 'input-editable__action--hidden': disabled || isEdit }" type="link"
      :disabled="disabled || isEdit" :tabindex="disabled || isEdit ? -1 : 0" :aria-label="label || $t('Editable.edit')" @click="startEdit" size="small">
      <AIcon type="EditOutlined" />
    </a-button>
    <a-typography-text v-if="!textarea && isEdit && currentError" class="input-editable__error" type="danger" role="alert">{{ currentError }}</a-typography-text>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
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
const failure = ref('')
const currentError = computed(() => props.error || failure.value)
const { t } = useI18n()
const rootRef = ref<HTMLElement>()
const actionsRef = ref<HTMLElement>()
const inputRef = ref<{ focus(options?: FocusOptions): void }>()
const triggerRef = ref<HTMLButtonElement>()
let generation = 0

function restoreFocus() {
  void nextTick(() => {
    const target = triggerRef.value
    const document = target?.ownerDocument
    if (target && (!document || document.activeElement === document.body || rootRef.value?.contains(document.activeElement) || actionsRef.value?.contains(document.activeElement))) target.focus({ preventScroll: true })
  })
}

async function startEdit() {
  if (props.disabled || submitting.value || isEdit.value) return
  const version = ++generation
  failure.value = ''
  _value.value = props.value
  isEdit.value = true
  await nextTick()
  if (version === generation) inputRef.value?.focus({ preventScroll: true })
}

async function submit(returnFocus = true) {
  if (!isEdit.value || props.disabled || submitting.value) return
  const value = _value.value
  if (value === props.value) { ++generation; isEdit.value = false; if (returnFocus) restoreFocus(); return }
  const version = ++generation
  submitting.value = true
  failure.value = ''
  try {
    // Enter 随后可能触发失焦，提交期间只接受首次操作。
    const accepted = props.save ? await props.save(value) : true
    if (version !== generation) return
    if (!accepted) { failure.value = t('Editable.saveFailed'); return }
    isEdit.value = false
    emit('update:value', value)
    emit('change', value)
    if (returnFocus) restoreFocus()
  } catch {
    if (version === generation) failure.value = t('Editable.saveFailed')
  } finally {
    if (version === generation) { ++generation; submitting.value = false }
  }
}

async function blur(event: FocusEvent) {
  if (props.textarea) return
  const scope = event.currentTarget as HTMLElement
  if (scope.contains(event.relatedTarget as Node | null)) return
  const version = generation
  await nextTick()
  if (version === generation && !scope.contains(scope.ownerDocument.activeElement)) await submit(false)
}

function cancel(returnFocus = true) {
  if (submitting.value) return
  ++generation
  _value.value = props.value
  isEdit.value = false
  failure.value = ''
  if (returnFocus) restoreFocus()
}

function keydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    cancel()
  } else if (!props.textarea && event.key === 'Enter') {
    event.preventDefault()
  } else if (props.textarea && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    void submit()
  }
}

watch(() => props.value, value => { _value.value = value }, { immediate: true })
watch(() => props.disabled, disabled => { if (disabled) cancel(false) })
watch(_value, () => { failure.value = '' })
onBeforeUnmount(() => { ++generation })
</script>

<style scoped>
.input-editable { --input-editable-height:32px; position:relative; display:inline-grid; grid-template-columns:minmax(0,auto) 24px; grid-template-rows:var(--input-editable-height); align-items:center; column-gap:var(--space-2,8px); min-width:0; max-width:min(100%,var(--inline-edit-max-width,100%)); font:inherit; vertical-align:middle }
.input-editable--small { --input-editable-height:24px }
.input-editable__popup-anchor { position:absolute; inset:0; pointer-events:none }
.input-editable--large { --input-editable-height:40px }
.input-editable--text:not(.input-editable--has-action) { grid-template-columns:minmax(0,auto) }
.input-editable__value { display:flex; align-items:center; min-width:0; height:100%; overflow:hidden; white-space:pre }
.input-editable__value.is-editing { visibility:hidden }
.input-editable__control { position:absolute; inset:0 32px auto 0; height:var(--input-editable-height); max-width:calc(100% - 32px) }
.input-editable--text:not(.input-editable--has-action) .input-editable__control { right:0; max-width:100% }
.input-editable :deep(.ant-input) { min-width:0; width:100%; height:100%; font:inherit; padding:0; border:0; border-radius:0; box-shadow:none }
.input-editable__text { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0; border:0; background:transparent; font:inherit; color:inherit; text-align:start; cursor:pointer }
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
.input-editable__footer { display:flex; justify-content:flex-end; gap:var(--space-2,8px) }
@media (pointer:coarse) {
  .input-editable { --input-editable-height:44px; grid-template-columns:minmax(0,auto) 44px; }
  .input-editable--text:not(.input-editable--has-action) { grid-template-columns:minmax(0,auto); }
  .input-editable__action,.input-editable__footer :deep(.ant-btn) { min-width:44px; min-height:44px; }
  .input-editable__control { inset-inline-end:52px; max-width:calc(100% - 52px); }
  .input-editable--multiline .input-editable__control { inset:auto; max-width:100%; }
}
</style>
<style src="./inline-edit.css" />
