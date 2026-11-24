<template>
  <a-modal
    :open="visible"
    :title="title"
    :width="textarea ? 600 : 420"
    :mask-closable="false"
    :ok-text="$t('I18n.confirm')"
    :cancel-text="$t('I18n.cancel')"
    :confirm-loading="editor?.confirming"
    @cancel="editor?.cancel()"
    @ok="editor?.confirm()"
  >
    <I18nTextEditor ref="editor" v-bind="props" :actions="false" @update:visible="emit('update:visible', $event)" @confirm="emit('confirm', $event)" />
  </a-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import I18nTextEditor from './I18nTextEditor.vue'

const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  data?: Record<string, string>
  displayValue?: string
  maxLength?: number
  textarea?: boolean
}>(), {
  data: () => ({}),
  maxLength: 200,
  textarea: false,
})
const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'confirm', value: Record<string, string>): void
}>()
const editor = ref<InstanceType<typeof I18nTextEditor>>()
</script>
