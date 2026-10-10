<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import ConditionOptionPanel from './ConditionOptionPanel.vue'
import ValueItem from '../Search/Filter/ValueItem.vue'
import type { ConditionFilterSubmitOptions, ConditionFilterTerm } from './types'
import { useConditionEditorPanel } from './useConditionEditorPanel'

const props = defineProps({
  column: {
    type: String,
    default: undefined,
  },
  term: {
    type: Object as PropType<ConditionFilterTerm | undefined>,
    default: undefined,
  },
  keyword: {
    type: String,
    default: '',
  },
})

const emit = defineEmits<{
  (e: 'apply', value: ConditionFilterTerm, options?: ConditionFilterSubmitOptions): void
  (e: 'draft-change', value?: ConditionFilterTerm): void
}>()

const { t: $t } = useI18n()
const {
  title, termType, currentColumn, draftValue, isOptionPanelMode, isTextMembershipMode,
  hideTitle, panelWidth, optionPanelValue, valueItemValue, optionPanelOptions, resolvedOptionPanelConfig,
  textValues, setDraftValue, onValueItemUpdate, onSubmit, onConfirmKeydown,
} = useConditionEditorPanel(props, (value, options) => emit('apply', value, options))
</script>

<template>
  <div class="condition-editor-panel" :class="{ 'condition-editor-panel--compact': hideTitle }" :style="{ width: panelWidth }" @keydown="onConfirmKeydown">
    <div v-if="!hideTitle" class="condition-editor-panel__title">{{ $t('components.ConditionFilter.editor.title', { title }) }}</div>
    <div class="condition-editor-panel__body">
      <slot
        name="value"
        :field="currentColumn"
        :term="term"
        :column="column"
        :termType="termType"
        :value="draftValue"
        :setValue="setDraftValue"
        :submit="onSubmit"
      >
        <ConditionOptionPanel
          v-if="isOptionPanelMode"
          :value="optionPanelValue"
          :keyword="keyword"
          :options="optionPanelOptions"
          :config="resolvedOptionPanelConfig"
          @update:value="setDraftValue"
          @submit="onSubmit"
        />
        <a-select
          v-else-if="isTextMembershipMode"
          :value="textValues"
          mode="tags"
          :open="false"
          :show-arrow="false"
          :placeholder="$t('components.ConditionFilter.editor.textValues')"
          :aria-label="title"
          style="width: 100%"
          @change="onValueItemUpdate"
          @keydown.enter.stop
        />
        <ValueItem
          v-else
          :value="valueItemValue"
          :column="column"
          :termType="termType"
          :show-action="false"
          embedded
          @update:value="onValueItemUpdate"
        />
      </slot>
    </div>
  </div>
</template>

<style scoped lang="less">
.condition-editor-panel {
  padding: var(--space-3);
  background: var(--color-jet-bg-elevated);
  border: 1px solid var(--color-jet-border-secondary);
  border-radius: var(--radius-jet-lg);
  box-shadow: var(--jet-theme-shadow);

  &--compact {
    padding: var(--space-2);
  }

  &__title {
    margin-bottom: 0.625rem;
    color: var(--color-jet-text-title);
    font-size: var(--fs-14);
    font-weight: 600;
    line-height: 1.375rem;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
}</style>
