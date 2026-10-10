<script setup lang="ts" name="ConditionFilter">
import type { PropType } from 'vue'
import { useSlots } from 'vue'
import ConditionTermToken from './ConditionFilterTerm.vue'
import FieldSelectPanel from './FieldSelectPanel.vue'
import { useConditionFilter } from './useConditionFilter'
import type {
  ConditionFilterChangePayload, ConditionFilterCommonField, ConditionFilterExpose,
  ConditionFilterField, ConditionFilterLegacySearchPayload, ConditionFilterTerm,
} from './types'
import type { SearchItem } from '../Search/Filter/typing'

const props = defineProps({
  fields: {
    type: Array as PropType<ConditionFilterField[]>,
    default: () => [],
  },
  columns: {
    type: Array as PropType<SearchItem[]>,
    default: () => [],
  },
  modelValue: {
    type: Array as PropType<ConditionFilterTerm[]>,
    default: () => [],
  },
  where: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  commonFields: {
    type: Array as PropType<ConditionFilterCommonField[]>,
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: ConditionFilterTerm[]): void
  (e: 'update:where', value: string): void
  (e: 'change', value: ConditionFilterChangePayload): void
  (e: 'search', value: ConditionFilterLegacySearchPayload): void
}>()

const slots = useSlots()
const {
  rootRef,
  termsModel,
  exposeApi,
  tokenView,
  editorMode,
  resolvedPlaceholder,
  fieldPanelVisible,
  fieldOptions,
  activeFieldOption,
  fieldKeyword,
  hasAnyTerms,
  onShellClick,
  getTermKey,
  onFieldPanelOpenChange,
  onTailBlur,
  onTailActivate,
  onTailFocus,
  onTailInput,
  onTailKeydown,
  onFieldOptionHover,
  onSelectField,
  onClearAll,
  triggerSearch,
  onApplyPanelValue,
  onValuePanelOpenChange,
  onRemoveTerm,
  startValueEdit,
  onValueInput,
  onValueKeydown
} = useConditionFilter(props, emit)
defineExpose<ConditionFilterExpose>(exposeApi)
</script>

<template>
  <div class="condition-filter" :class="{ 'condition-filter--disabled': disabled }">
    <div ref="rootRef" class="condition-filter__shell" @click="onShellClick">
      <div class="condition-filter__content">
        <ConditionTermToken
          v-for="(term, index) in termsModel"
          :key="getTermKey(term) || `${term.column}-${index}`"
          :term="term" :index="index" :view="tokenView"
        >
          <template v-if="slots['value-editor']" #value-editor="slotProps">
            <slot name="value-editor" v-bind="slotProps" />
          </template>
        </ConditionTermToken>

        <a-dropdown
          v-if="!disabled && editorMode === 'tail'"
          :open="fieldPanelVisible"
          trigger="click"
          placement="bottomLeft"
          @openChange="onFieldPanelOpenChange"
        >
          <div class="condition-filter__tail" @click.stop>
            <span class="condition-filter__tail-prefix" aria-hidden="true">
              <AIcon type="PlusOutlined" />
            </span>
            <input
              key="tail"
              class="condition-filter__text-input condition-filter__text-input--tail"
              :value="fieldKeyword"
              :placeholder="resolvedPlaceholder"
              data-condition-focusable="true"
              @blur="onTailBlur"
              @click="onTailActivate"
              @focus="onTailFocus"
              @input="onTailInput"
              @keydown="onTailKeydown"
            />
          </div>
          <template #overlay>
            <FieldSelectPanel
              :fields="fieldOptions"
              :active-key="activeFieldOption?.dataIndex"
              :keyword="fieldKeyword"
              :showSearch="false"
              @hover="onFieldOptionHover"
              @select="onSelectField"
            />
          </template>
        </a-dropdown>

        <span
          v-else-if="disabled && !termsModel.length"
          class="condition-filter__placeholder"
        >
          {{ resolvedPlaceholder }}
        </span>
      </div>

      <div v-if="!disabled" class="condition-filter__actions" @click.stop>
        <button
          class="condition-filter__action condition-filter__action--clear"
          type="button"
          :disabled="!hasAnyTerms"
          @click="onClearAll"
        >
          <AIcon type="CloseCircleOutlined" />
        </button>
        <span class="condition-filter__action-divider" aria-hidden="true" />
        <button
          class="condition-filter__action condition-filter__action--search"
          type="button"
          @mousedown.prevent
          @click="triggerSearch"
        >
          <AIcon type="SearchOutlined" />
        </button>
      </div>
    </div>
  </div>

</template>

<!-- All selectors use the condition-filter namespace, shared with token overlays. -->
<style lang="less" src="./condition-filter.less" />
