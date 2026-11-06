<template>
  <span class="input-editable" :class="`input-editable--${size}`" :style="textStyle">
    <span class="input-editable__value" :class="{ 'is-editing': isEdit }" :aria-hidden="isEdit || undefined">
      <j-ellipsis>
        <span :role="disabled || isEdit ? undefined : 'button'" :tabindex="disabled || isEdit ? undefined : 0" @click="start" @keydown.enter="start">
          {{ (isEdit ? value : _value) || placeholder || $t('comm.table.empty') }}
        </span>
      </j-ellipsis>
    </span>
    <a-input v-if="isEdit" class="input-editable__control" ref="input" v-model:value="_value" :size="size" :maxLength="maxLength" @blur="onBlur"
             @press-enter="onBlur" @keydown.esc.stop="cancel" :disabled="disabled"/>
    <a-button class="input-editable__action" :class="{ 'input-editable__action--hidden': disabled || isEdit }" type="link"
      :disabled="disabled || isEdit" :tabindex="disabled || isEdit ? -1 : 0" :aria-label="$t('Editable.edit')" @click="start" size="small">
      <AIcon type="EditOutlined"/>
    </a-button>
  </span>
</template>

<script setup lang="ts">
import { nextTick, ref, watch, type CSSProperties } from 'vue'
const props = withDefaults(defineProps<{
  value?: string; disabled?: boolean; maxLength?: number; placeholder?: string; textStyle?: CSSProperties; size?: 'small' | 'middle' | 'large'
}>(), { value: '', disabled: false, textStyle: () => ({}), size: 'middle' })
const emit = defineEmits<{ (event: 'update:value' | 'change', value: string): void }>()

const _value = ref('')
const isEdit = ref(false)
const input = ref<{ focus(): void }>()

const start = async () => {
  if (props.disabled) return
  _value.value = props.value
  isEdit.value = true
  await nextTick()
  input.value?.focus()
}
const cancel = () => {
  _value.value = props.value
  isEdit.value = false
}

const onBlur = () => {
  if (!isEdit.value) return
  isEdit.value = false
  if (!props.disabled && _value.value !== props.value) {
    emit('update:value', _value.value)
    emit('change', _value.value)
  }
}

watch(() => props.value, (newVal) => {
  _value.value = newVal
}, {
  immediate: true
})
watch(() => props.disabled, disabled => { if (disabled) cancel() })
</script>

<style scoped>
.input-editable { position:relative; display:inline-grid; grid-template-columns:minmax(0,auto) 24px; align-items:center; gap:var(--space-2,8px); min-width:0; max-width:100%; height:32px; font:inherit; vertical-align:middle }
.input-editable--small { height:24px }
.input-editable--large { height:40px }
.input-editable__value { display:flex; align-items:center; min-width:0; height:100%; overflow:hidden }
.input-editable__value.is-editing { visibility:hidden }
.input-editable__control { position:absolute; inset:0 32px 0 0; max-width:calc(100% - 32px) }
.input-editable__value :deep(.j-ellipsis) { width:100%; font:inherit; line-height:inherit }
.input-editable :deep(.ant-input) { min-width:0; width:100%; height:100%; font:inherit; padding-inline:0 }
.input-editable__action { width:24px; height:24px; padding:0 }
.input-editable__action--hidden { visibility:hidden }
</style>

