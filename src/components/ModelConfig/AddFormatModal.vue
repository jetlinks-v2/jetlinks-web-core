<template>
  <a-modal
    :open="open"
    :title="locale.addFormat"
    :ok-text="locale.confirm"
    :cancel-text="locale.cancel"
    :confirm-loading="confirmLoading"
    @ok="confirm"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical">
      <a-form-item :label="locale.format" required>
        <a-auto-complete
          v-model:value="selectedFormat"
          :loading="loading"
          :options="availableOptions"
          :placeholder="locale.selectFormat"
          :filter-option="filterOption"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'

interface FormatOption {
  label: string
  value: string
}

interface ModelFormatTag {
  id: string
  name?: string
}

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  existingFormats: {
    type: Array as PropType<string[]>,
    default: () => []
  },
  locale: {
    type: Object as PropType<Record<string, string>>,
    required: true
  },
  confirmLoading: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  formatTags: {
    type: Array as PropType<ModelFormatTag[]>,
    default: () => []
  }
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', value: string): void
}>()

const selectedFormat = ref<string>()

const availableOptions = computed<FormatOption[]>(() => {
  const existing = new Set(props.existingFormats)
  return props.formatTags
    .filter(item => item?.id && !existing.has(item.id))
    .map(item => ({
      label: item.name ? `${item.name} (${item.id})` : item.id,
      value: item.id
    }))
})

watch(() => props.open, (open) => {
  if (open) {
    selectedFormat.value = undefined
  }
})

function filterOption(input: string, option?: FormatOption) {
  return String(option?.label || '').toLowerCase().includes(input.toLowerCase())
}

function confirm() {
  const value = selectedFormat.value?.trim()
  if (!value) {
    onlyMessage(props.locale.selectFormat, 'warning')
    return
  }
  if (props.existingFormats.includes(value)) {
    onlyMessage(props.locale.selectFormat, 'warning')
    return
  }
  emit('confirm', value)
}
</script>
