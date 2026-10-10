<script setup lang="ts">
import { toRefs, useSlots } from 'vue'
import { isNullaryTermType } from '../Search/Filter/setting'
import { isConditionGroup } from './utils'
import ConditionEditorPanel from './ConditionEditorPanel.vue'
import FieldSelectPanel from './FieldSelectPanel.vue'
import type { ConditionFilterTerm } from './types'
import type { ConditionTokenView } from './useConditionFilter'

const props = defineProps<{ term: ConditionFilterTerm; index: number; view: ConditionTokenView }>()
const slots = useSlots()
const {
  resolvedPlaceholder, logicOptions, logicCompactLabelMap, editorMode,
  editingTermKey, fieldKeyword, valueKeyword, operatorPanelTermKey,
  valuePanelTermKey, valuePanelOpenVersion, fieldOptions, activeFieldOption,
  getTermKey, getTermColumn, getTermTypeOptions, isPopupValueTerm,
  getFieldLabel, getGroupLabel, isTermTypeSelected, isLogicTypeSelected,
  getTermTypeReadableText, getTermTypeShortText, getTermTypeTooltip, getValuePlaceholder,
  getValueTooltip, setValueDraft, getValuePanelKeyword, getDisplayValueLabel,
  fieldPanelVisible, startFieldEdit, startValueEdit, onSelectField,
  onChangeLogic, onTermTypeChange, onApplyPanelValue, onFieldOptionHover,
  onTokenKeydown, onFieldInput, onFieldBlur, onFieldKeydown,
  onValueInput, onOperatorChipMouseDown, onValueBlur, onValueKeydown,
  onFieldPanelOpenChange, onOperatorPanelOpenChange, onValuePanelOpenChange, onClearTermValue,
  disabled, openFieldPanel, openValuePanel,
} = toRefs(props.view)
</script>
<template>
<div
  class="condition-filter__term"
  :class="{ 'condition-filter__term--or': index && (term.type || 'and') === 'or' }"
  :data-term-key="getTermKey(term)"
>
  <a-dropdown
    v-if="index"
    trigger="click"
    placement="bottomLeft"
  >
    <button
      class="condition-filter__chip condition-filter__chip--logic"
      type="button"
      :disabled="disabled"
      data-condition-focusable="true"
      @click.stop
      @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'logic')"
    >
      <span class="condition-filter__chip-text">{{ logicCompactLabelMap[term.type === 'or' ? 'or' : 'and'] }}</span>
    </button>
    <template #overlay>
      <div class="condition-filter__dropdown-panel" @mousedown.prevent>
        <button
          v-for="option in logicOptions"
          :key="option.value"
          class="condition-filter__dropdown-option condition-filter__chip condition-filter__chip--logic"
          :class="[
            { 'condition-filter__dropdown-option--active': isLogicTypeSelected(term, option.value) },
            option.value === 'or' ? 'condition-filter__chip--logic-or' : '',
          ]"
          type="button"
          @click.stop="onChangeLogic(index, option.value)"
        >
          <span class="condition-filter__chip-text">{{ option.label }}</span>
        </button>
      </div>
    </template>
  </a-dropdown>
  <div class="condition-filter__term-main">
    <template v-if="isConditionGroup(term)">
      <button
        class="condition-filter__chip condition-filter__chip--group"
        type="button"
        :disabled="disabled"
        data-condition-focusable="true"
        @click.stop
        @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'value')"
      >
        <span class="condition-filter__chip-text">{{ getGroupLabel(term) }}</span>
        <span
          class="condition-filter__chip-close"
          @click.stop="onClearTermValue(getTermKey(term))"
        >
          <AIcon type="CloseOutlined" />
        </span>
      </button>
    </template>
    <template v-else>
    <a-dropdown
      v-if="editorMode === 'field' && editingTermKey === getTermKey(term)"
      :open="fieldPanelVisible"
      trigger="click"
      placement="bottomLeft"
      @openChange="onFieldPanelOpenChange"
    >
      <div class="condition-filter__editor condition-filter__editor--field" @click.stop>
        <input
          :key="`field:${getTermKey(term)}`"
          class="condition-filter__text-input"
          :value="fieldKeyword"
          :placeholder="getFieldLabel(term.column) || resolvedPlaceholder"
          data-condition-focusable="true"
          @blur="onFieldBlur"
          @click="openFieldPanel()"
          @focus="openFieldPanel()"
          @input="onFieldInput"
          @keydown="onFieldKeydown"
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
    <button
      v-else
      class="condition-filter__chip condition-filter__chip--field"
      type="button"
      :disabled="disabled"
      data-condition-focusable="true"
      data-token-kind="field"
      @click.stop="startFieldEdit(getTermKey(term))"
      @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'field')"
    >
      <span class="condition-filter__chip-text">{{ getFieldLabel(term.column) }}</span>
    </button>
    <a-dropdown
      :open="operatorPanelTermKey === getTermKey(term)"
      trigger="click"
      placement="bottomLeft"
      @openChange="(visible: boolean) => onOperatorPanelOpenChange(getTermKey(term), visible)"
    >
      <a-tooltip :title="operatorPanelTermKey === getTermKey(term) ? undefined : getTermTypeTooltip(term.termType, getTermColumn(term)) || undefined">
        <button
          class="condition-filter__chip condition-filter__chip--operator"
          type="button"
          :disabled="disabled"
          data-condition-focusable="true"
          @mousedown="onOperatorChipMouseDown"
          @click.stop
          @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'operator')"
        >
          <span class="condition-filter__chip-text">{{ getTermTypeReadableText(term.termType, getTermColumn(term)) }}</span>
          <span
            v-if="isNullaryTermType(term.termType)"
            class="condition-filter__chip-close"
            @click.stop="onClearTermValue(getTermKey(term))"
          >
            <AIcon type="CloseOutlined" />
          </span>
        </button>
      </a-tooltip>
      <template #overlay>
        <div class="condition-filter__dropdown-panel" @mousedown.prevent>
          <!-- 按视口定位提示，避免窄容器的避让计算将提示挤回选项上。 -->
          <a-tooltip
            v-for="option in getTermTypeOptions(getTermColumn(term))"
            :key="option.value"
            :title="getTermTypeTooltip(option.value, getTermColumn(term)) || undefined"
            placement="left"
            :get-popup-container="(trigger: HTMLElement) => trigger.ownerDocument.body"
          >
            <button
              class="condition-filter__dropdown-option condition-filter__chip condition-filter__chip--operator"
              :class="{ 'condition-filter__dropdown-option--active': isTermTypeSelected(term, option.value) }"
              type="button"
              @click.stop="onTermTypeChange(getTermKey(term), option.value)"
            >
              <span class="condition-filter__dropdown-option-content">
                <span class="condition-filter__dropdown-option-title">
                  {{ getTermTypeReadableText(option.value, getTermColumn(term)) }}
                </span>
                <span v-if="getTermTypeShortText(option.value, getTermColumn(term))" class="condition-filter__dropdown-option-desc">
                  {{ getTermTypeShortText(option.value, getTermColumn(term)) }}
                </span>
              </span>
            </button>
          </a-tooltip>
        </div>
      </template>
    </a-dropdown>
    <template v-if="!isNullaryTermType(term.termType)">
      <div
        v-if="editorMode === 'value' && editingTermKey === getTermKey(term)"
        class="condition-filter__editor condition-filter__editor--value"
        @click.stop
      >
        <input
          :key="`value:${getTermKey(term)}`"
          class="condition-filter__text-input"
          :value="valueKeyword"
          :placeholder="getValuePlaceholder(term)"
          data-condition-focusable="true"
          @blur="onValueBlur"
          @input="onValueInput"
          @keydown="onValueKeydown"
        />
      </div>
      <a-dropdown
        v-else-if="isPopupValueTerm(getTermColumn(term), term.termType)"
        :open="valuePanelTermKey === getTermKey(term)"
        trigger="click"
        placement="bottomLeft"
        @openChange="(visible: boolean) => onValuePanelOpenChange(getTermKey(term), visible)"
      >
        <a-tooltip :title="getValueTooltip(term) || undefined">
          <button
            class="condition-filter__chip condition-filter__chip--value"
            :class="{ 'condition-filter__chip--placeholder': !getDisplayValueLabel(term) }"
            type="button"
            :disabled="disabled"
            data-condition-focusable="true"
            @click.stop="openValuePanel(getTermKey(term))"
            @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'value')"
          >
            <span class="condition-filter__chip-text">
              {{ getDisplayValueLabel(term) || getValuePlaceholder(term) }}
            </span>
            <span
              v-if="!disabled"
              class="condition-filter__chip-close"
              @click.stop="onClearTermValue(getTermKey(term))"
            >
              <AIcon type="CloseOutlined" />
            </span>
          </button>
        </a-tooltip>
        <template #overlay>
          <ConditionEditorPanel
            :key="`${getTermKey(term)}:${valuePanelOpenVersion}`"
            :column="term.column"
            :term="term"
            :keyword="getValuePanelKeyword(getTermKey(term))"
            @draft-change="(value) => setValueDraft(getTermKey(term), value)"
            @apply="(value, options) => onApplyPanelValue(getTermKey(term), value, options)"
          >
            <template v-if="slots['value-editor']" #value="slotProps">
              <slot
                name="value-editor"
                v-bind="{
                  ...slotProps,
                  panelKeyword: getValuePanelKeyword(getTermKey(term)),
                }"
              />
            </template>
          </ConditionEditorPanel>
        </template>
      </a-dropdown>
      <a-tooltip v-else :title="getValueTooltip(term) || undefined">
        <button
          class="condition-filter__chip condition-filter__chip--value"
          :class="{ 'condition-filter__chip--placeholder': !getDisplayValueLabel(term) }"
          type="button"
          :disabled="disabled"
          data-condition-focusable="true"
          @click.stop="startValueEdit(getTermKey(term))"
          @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'value')"
        >
          <span class="condition-filter__chip-text">
            {{ getDisplayValueLabel(term) || getValuePlaceholder(term) }}
          </span>
          <span
            v-if="!disabled"
            class="condition-filter__chip-close"
            @click.stop="onClearTermValue(getTermKey(term))"
          >
            <AIcon type="CloseOutlined" />
          </span>
        </button>
      </a-tooltip>
    </template>
    </template>
  </div>
</div>
</template>
