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
        <a-select
          v-model:value="selectedFormat"
          :loading="loading"
          :options="availableOptions"
          :placeholder="locale.selectFormat"
          show-search
          :filter-option="filterOption"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'
import { queryModelFormatTags, type ModelFormatTag } from '@jetlinks-web-core/api/modelConfig'

interface FormatOption {
  label: string
  value: string
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
  }
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', value: string): void
}>()

const loading = ref(false)
const selectedFormat = ref<string>()
const formatTags = ref<ModelFormatTag[]>([])

const availableOptions = computed<FormatOption[]>(() => {
  const existing = new Set(props.existingFormats)
  return formatTags.value
    .filter(item => item?.id && !existing.has(item.id))
    .map(item => ({
      label: item.name ? `${item.name} (${item.id})` : item.id,
      value: item.id
    }))
})

watch(() => props.open, (open) => {
  if (open) {
    selectedFormat.value = undefined
    loadFormatTags()
  }
})

async function loadFormatTags() {
  loading.value = true
  try {
    const resp = await queryModelFormatTags()
    formatTags.value = Array.isArray(resp?.result) ? resp.result : []
  } finally {
    loading.value = false
  }
}

function filterOption(input: string, option?: FormatOption) {
  return String(option?.label || '').toLowerCase().includes(input.toLowerCase())
}

function confirm() {
  if (!selectedFormat.value) {
    onlyMessage(props.locale.selectFormat, 'warning')
    return
  }
  emit('confirm', selectedFormat.value)
}
</script>
