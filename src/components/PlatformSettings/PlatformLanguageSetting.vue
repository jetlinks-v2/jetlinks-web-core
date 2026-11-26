<template>
  <PlatformSettingRow field="languages" icon="GlobalOutlined" :label="t('PlatformSettings.languages')" :description="t('PlatformSettings.languagesHint')">
    <a-select
      v-if="editing"
      class="platform-language-select"
      mode="multiple"
      allow-clear
      :aria-label="t('PlatformSettings.languages')"
      :value="value"
      :options="frontLanguageOptions"
      :disabled="disabled"
      :placeholder="defaultLabel"
      @update:value="emit('change', parseFrontLanguages($event))"
    />
    <span v-else>{{ selectedLabel }}</span>
  </PlatformSettingRow>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { defaultFrontLanguages, frontLanguageLabels, frontLanguageOptions, parseFrontLanguages, type FrontLanguage } from '../../locales/languageOptions'
import PlatformSettingRow from './PlatformSettingRow.vue'

const props = defineProps<{ value: FrontLanguage[]; editing: boolean; disabled: boolean }>()
const emit = defineEmits<{ change: [languages: FrontLanguage[]] }>()
const { t } = useI18n()
const format = (languages: readonly FrontLanguage[]) => languages.map(language => frontLanguageLabels[language]).join(' / ')
const defaultLabel = computed(() => t('PlatformSettings.languagesDefault', { languages: format(defaultFrontLanguages) }))
const selectedLabel = computed(() => props.value.length ? format(props.value) : defaultLabel.value)
</script>

<style scoped>
.platform-language-select { width: 100%; margin-top: var(--space-1); }
</style>
