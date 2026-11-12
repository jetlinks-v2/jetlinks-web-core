<template>
  <PlatformSettingRow :field="fieldKey" :icon="icon" :active="active" :class="{ 'platform-text-setting--button': editButton }">
    <InlineEditForm ref="editor" :groups="groups" :mode="mode" :disabled="disabled" :busy="busy" :messages="messages" :submit="saveField" @change="changed" @cancel="emit('cancel', fieldKey)">
      <template v-if="$slots.display" #display="scope"><slot name="display" v-bind="scope" /></template>
    </InlineEditForm>
    <p v-if="mode === 'detail' && failure" class="setting-failure" role="alert">{{ failure }}</p>
    <template v-if="$slots.action || showEditButton" #action>
      <a-button v-if="showEditButton" class="setting-edit-button" :disabled="busy" @click="edit">{{ t('PlatformSettings.modify') }}</a-button>
      <slot name="action" />
    </template>
  </PlatformSettingRow>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { InlineEditForm, type InlineEditGroup, type InlineEditSubmit } from '../InlineEditForm'
import PlatformSettingRow from './PlatformSettingRow.vue'
import { sectionProps } from './sectionProps'
import type { PropType } from 'vue'
import type { PlatformSettingKey, PlatformSettingsPatch } from './types'
const props = defineProps({ ...sectionProps, fieldKey: { type: String as PropType<PlatformSettingKey>, required: true }, label: { type: String, required: true }, hint: String, icon: { type: String, required: true }, active: Boolean, editButton: Boolean })
const emit = defineEmits<{ change: [patch: PlatformSettingsPatch]; cancel: [key: PlatformSettingKey] }>()
const { t } = useI18n()
const editor = ref<InstanceType<typeof InlineEditForm>>()
const failure = ref('')
const showEditButton = computed(() => props.editButton && props.mode === 'detail' && !props.disabled)
const groups = computed<InlineEditGroup[]>(() => [{ key: props.fieldKey, fields: [{
  key: props.fieldKey, label: props.label, hint: props.hint, value: props.model[props.fieldKey], initialValue: props.saved[props.fieldKey],
  error: props.errors?.[props.fieldKey], fullWidth: true, maxLength: props.fieldKey === 'title' ? 64 : undefined,
  editTrigger: props.editButton ? 'manual' : 'value',
}] }])
const messages = computed(() => ({ save: t('PlatformSettings.save'), cancel: t('PlatformSettings.cancel'), empty: t('PlatformSettings.notConfigured'), saving: t('PlatformSettings.saving'), failed: t('PlatformSettings.saveFailed') }))
const changed = (_key: string, value: unknown) => { failure.value = ''; emit('change', { [props.fieldKey]: String(value ?? '') }) }
const saveField: InlineEditSubmit = async (_key, value) => {
  const result = await props.submit({ [props.fieldKey]: String(value ?? '') })
  failure.value = result.ok ? '' : result.error || t('PlatformSettings.saveFailed')
  return result
}
const edit = () => editor.value?.editField(props.fieldKey)
defineExpose({ edit })
</script>
<style scoped>
.setting-failure { margin: var(--space-1) 0 0; color: var(--jet-theme-error); font-size: var(--fs-12); }
.setting-edit-button { min-width: 4rem; }
.platform-text-setting--button :deep(.inline-edit-field__value), .platform-text-setting--button :deep(.inline-edit-field__editor .ant-input) { font-size: var(--fs-16); font-weight: 600; }
</style>
