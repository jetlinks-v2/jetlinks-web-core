<template>
  <div class="input-editable">
    <div v-if="!isEdit" style="display: flex; align-items: center; gap: 0.5rem">
      <j-ellipsis>
        <button v-if="trigger === 'text'" type="button" class="input-editable__text" :style="textStyle" :disabled="disabled" :aria-label="label" @click="startEdit">
          {{ _value || $t('comm.table.empty') }}
        </button>
        <span v-else :style="textStyle">
          {{ _value || $t('comm.table.empty') }}
        </span>
      </j-ellipsis>
      <a-button v-if="trigger === 'icon'" type="link" @click="startEdit" size="small" :disabled="disabled" :aria-label="label">
        <AIcon type="EditOutlined"/>
      </a-button>
    </div>
    <a-input v-else ref="inputRef" v-model:value="_value" :maxLength="maxLength" @blur="submit" @pressEnter="submit" @keydown.esc.stop="cancel" :disabled="disabled || submitting" :status="error ? 'error' : undefined" :aria-label="label" />
    <a-typography-text v-if="isEdit && error" type="danger" role="alert">{{ error }}</a-typography-text>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch, type CSSProperties, type PropType } from 'vue'
const props = defineProps({
  value: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  maxLength: {
    type: Number,
    default: undefined
  },
  textStyle: {
    type: Object as PropType<CSSProperties>,
    default: () => ({})
  },
  trigger: { type: String as PropType<'icon' | 'text'>, default: 'icon' },
  label: { type: String, default: undefined },
  error: { type: String, default: '' },
  /** 可选异步提交；返回 false 保留编辑态，由调用方提供字段错误。 */
  save: { type: Function as PropType<(value: string) => boolean | Promise<boolean>>, default: undefined },
})
const emit = defineEmits(['update:value', 'change'])

const _value = ref('')
const isEdit = ref(false)
const submitting = ref(false)
const inputRef = ref<{ focus: () => void }>()

async function startEdit() {
  if (props.disabled || submitting.value) return
  _value.value = props.value
  isEdit.value = true
  await nextTick()
  inputRef.value?.focus()
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

function cancel() {
  if (submitting.value) return
  _value.value = props.value
  isEdit.value = false
}

watch(() => props.value, (newVal) => {
  _value.value = newVal
}, {
  immediate: true
})
</script>

<style scoped>
.input-editable { min-width: 0; }
.input-editable__text { padding: 0; border: 0; background: transparent; font: inherit; color: inherit; text-align: start; cursor: pointer; }
.input-editable__text:disabled { cursor: default; }
.input-editable__text:focus-visible { outline: 2px solid var(--jet-theme-primary); outline-offset: 3px; }
</style>

