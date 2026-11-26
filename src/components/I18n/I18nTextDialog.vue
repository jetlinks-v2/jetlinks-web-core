<template>
  <component :is="mobile ? Drawer : Modal" :open="visible" :title="title"
    v-bind="mobile ? { placement: 'bottom', height: 'auto', bodyStyle: { maxHeight: '65dvh', overflow: 'auto' } } : { width: textarea ? 600 : 440, centered: true }"
    :mask-closable="false" destroy-on-close @cancel="editor?.cancel()" @close="editor?.cancel()" @after-open-change="$event && editor?.focus()">
    <I18nTextEditor ref="editor" v-bind="props" :actions="mobile" :role="mobile ? 'dialog' : undefined" :aria-label="mobile ? title : undefined" :aria-modal="mobile || undefined" @update:visible="emit('update:visible', $event)" @confirm="emit('confirm', $event)" />
    <template #footer><div v-if="!mobile" class="i18n-text-dialog__actions"><Button type="text" @click="editor?.cancel()">{{ t('I18n.cancel') }}</Button><Button type="primary" @click="editor?.confirm()">{{ t('I18n.apply') }}</Button></div></template>
  </component>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { Button, Drawer, Modal } from 'ant-design-vue'
import I18nTextEditor from './I18nTextEditor.vue'
import type { I18nTextDialogProps, I18nTextMessages } from './types'
const props = withDefaults(defineProps<I18nTextDialogProps>(), { data: () => ({}), maxLength: 200, textarea: false })
const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'confirm', value: I18nTextMessages): void
}>()
const narrow = useMediaQuery('(max-width: 600px)')
const mobile = ref(narrow.value)
// 保持当前编辑器实例，下一次打开时再按可用宽度选择容器。
watch([() => props.visible, narrow], ([, value], [wasOpen]) => { if (!wasOpen) mobile.value = value }, { flush: 'sync' })
const { t } = useI18n()
const editor = ref<InstanceType<typeof I18nTextEditor>>()
</script>
<style scoped>
.i18n-text-dialog__actions { display:flex; justify-content:flex-end; gap:var(--space-2); padding-bottom:env(safe-area-inset-bottom); }
@media (pointer:coarse),(max-width:600px) { .i18n-text-dialog__actions :deep(.ant-btn) { min-width:44px; min-height:44px; } }
</style>
