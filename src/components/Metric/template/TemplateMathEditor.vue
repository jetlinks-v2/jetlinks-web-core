<template>
  <section  class="formula-editor" :aria-label="t(conditions ? 'conditionExpression' : 'formula')">
    <div class="formula-editor__surface">
      <div v-if="!hideMode" class="formula-editor__mode">
        <a-button type="text" size="small" :disabled="disabled || invalid || forceSource || mode === 'source' && !canVisualize" :aria-label="t(mode === 'visual' ? 'editExpression' : 'backToFormula')" :title="mode === 'source' && !canVisualize ? t('advancedFormulaHint') : undefined" @mousedown.prevent @click="changeMode(mode === 'visual' ? 'source' : 'visual')"><AIcon :type="mode === 'visual' ? 'CodeOutlined' : 'FunctionOutlined'" />{{ t(mode === 'visual' ? 'editExpression' : 'backToFormula') }}</a-button>
      </div>
    <div ref="canvas" class="formula-editor__canvas" @pointerdown.capture="chooseAtPoint" @pointermove="previewAtPoint" @keyup="previewSelection" @pointerleave="clearPreview" @focusout="clearPreview">
      <div v-show="mode === 'visual'" ref="host" class="formula-editor__field" @click.self="focusFormula" @scroll="closeReferences()" />
      <a-textarea v-if="mode === 'source'" class="formula-editor__source" :value="sourceText" :disabled="disabled" :bordered="false"
        :aria-label="t('advancedExpression')" @update:value="updateSource" @focus="remember" @click="remember" @keyup="remember" @select="remember" />
      <span v-if="referenceFrame || hoverFrame" :class="referenceFrame ? 'formula-editor__active-reference' : 'formula-editor__hover-reference'" :style="referenceFrame || hoverFrame" aria-hidden="true" />
      <a-select v-if="referenceSelection || sourcePickerOpen" ref="referencePicker" class="formula-editor__picker" :style="pickerStyle"
        :value="undefined" :open="true" show-search :options="referenceOptions" option-filter-prop="label"
        popup-class-name="formula-editor__reference-menu" :dropdown-align="{offset:[0,-1]}"
        :placeholder="t('chooseVariable')" :aria-label="t('chooseVariable')" :not-found-content="t('noVariable')"
        :get-popup-container="popupContainer" @select="chooseReference"
        @dropdown-visible-change="referenceVisibilityChanged" @keydown.esc.stop.prevent="closeReferences(true)">
        <template #suffixIcon><AIcon type="SearchOutlined" /></template>
        <template #option="option"><TemplateReference :metric-id="references[option.value]?.metricId"><SelectOption :label="option.label" :icon="option.icon" :description="option.description" /></TemplateReference></template>
      </a-select>
      <ExpressionFunctionMenu v-if="functionSelection" class="formula-editor__function-picker" :style="pickerStyle" :functions="availableFunctions" :selected-id="functionSelection.id" @choose="chooseFunction" @close="closeReferences(true)" />
    </div>
    <div class="formula-editor__toolbar">
      <div class="formula-editor__actions">
      <span class="formula-editor__symbol" :title="t('calculationFormula')" :aria-label="t('calculationFormula')" role="img"><AIcon type="FunctionOutlined" /></span>
      <a-button type="text" size="small" :disabled="disabled || mode === 'visual' && (!ready || !canInsertValue) || !references.length" :aria-label="t('insertVariable')" @mousedown.prevent @click="openReferences()"><AIcon type="FieldStringOutlined" />{{ t('formulaVariables') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
      <template v-if="mode === 'visual'">
        <a-dropdown :trigger="['click']" :disabled="disabled || !ready" :get-popup-container="popupContainer">
          <a-button type="text" size="small" :disabled="disabled || !ready || !canInsertValue" :aria-label="t('insertValue')" @mousedown.prevent="refreshInsertion"><AIcon type="NumberOutlined" />{{ t('value') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
          <template #overlay><a-menu @click="chooseLiteral"><a-menu-item v-for="item in literalValues" :key="item.key" :disabled="item.disabled"><SelectOption :icon="item.icon" :label="item.label" :description="item.description" /></a-menu-item></a-menu></template>
        </a-dropdown>
        <a-dropdown :open="functionMenuOpen" :trigger="['click']" :disabled="disabled || !ready" :get-popup-container="popupContainer" @open-change="functionMenuOpen=$event">
          <a-button type="text" size="small" :disabled="disabled || !ready || !canInsertValue" :aria-label="t('insertFunction')" @mousedown.prevent="refreshInsertion"><AIcon type="FunctionOutlined" />{{ t('formulaFunctions') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
          <template #overlay><ExpressionFunctionMenu :functions="availableFunctions" :error="functionsError" @choose="chooseFunction" @retry="refreshFunctions" @close="closeReferences(true)"><template #error>{{ t('functionCatalogRetry') }}</template></ExpressionFunctionMenu></template>
        </a-dropdown>
        <a-dropdown v-if="conditions" :trigger="['click']" :disabled="disabled || !ready" :get-popup-container="popupContainer">
          <a-button type="text" size="small" :disabled="disabled || !ready" :aria-label="t('conditionOperators')" @mousedown.prevent="refreshInsertion"><AIcon type="BranchesOutlined" />{{ t('formulaConditions') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
          <template #overlay><a-menu @click="chooseConditionOperator"><a-menu-item key="branch" :disabled="!canAddBranch && !canInsertValue"><SelectOption icon="BranchesOutlined" :label="t(canAddBranch ? 'addFormulaBranch' : 'conditionalFunction')" :description="t('enterFormulaBranch')" /></a-menu-item><a-menu-divider /><a-menu-item v-for="(item, index) in conditionOperators" :key="index" :disabled="item.disabled"><SelectOption icon="BranchesOutlined" :label="item.label" :description="t(item.hint)" /></a-menu-item></a-menu></template>
        </a-dropdown>
      </template>
      <slot name="tools" />
      </div>
      <div v-if="mode === 'visual'" class="formula-editor__operators"><a-button v-for="item in operators" :key="item.label" type="text" size="small" :disabled="disabled || !ready || item.disabled" @mousedown.prevent @click="insert(item)">{{ item.label }}</a-button></div>
      <div v-if="$slots['view-tools']" class="formula-editor__view-tools"><slot name="view-tools" /></div>
    </div>
    </div>
    <div class="formula-editor__footer">
      <p class="formula-editor__feedback" :class="{ 'formula-editor__error': invalid || loadError }" :role="invalid || loadError ? 'alert' : undefined" :title="feedback">{{ feedback }}</p>
      <a-popover v-if="mode === 'visual' && ready && !disabled" :trigger="['hover','focus','click']" :title="t('formulaEditingHelp')" :get-popup-container="popupContainer"><template #content><ul class="formula-editor__hints"><li v-for="key in conditions ? ['formulaBranchesHint','formulaReplaceHint','formulaNavigateHint','formulaUndoHint'] : ['formulaReplaceHint','formulaNavigateHint','formulaUndoHint']" :key="key">{{ t(key) }}</li></ul></template><a-button class="formula-editor__help" type="text" size="small" :aria-label="t('formulaEditingHelp')"><AIcon type="InfoCircleOutlined" /></a-button></a-popover>
    </div>
  </section>
</template>
<script setup lang="ts">
import SelectOption from '../../SelectOption/index.vue'
import ExpressionFunctionMenu from '../../Expression/ExpressionFunctionMenu.vue'
import TemplateReference from './TemplateReference.vue'
import { useTemplateMathEditor, type FormulaChange } from './useTemplateMathEditor'
import type { ExpressionFunction, StructuredExpression } from '../../Expression/types'
import type { ExpressionResultLabel } from '../../Expression/editor'
import type { FormulaReference } from './formula'
const props=defineProps<{modelValue:string;tree?:StructuredExpression;references:FormulaReference[];disabled?:boolean;conditions?:boolean;functions?:ExpressionFunction[];functionsError?:boolean;forceSource?:boolean;hideMode?:boolean;empty?:boolean;resultLabels?:ExpressionResultLabel[]}>()
const emit=defineEmits<{(event:'change',value:FormulaChange):void;(event:'invalid',value:boolean):void;(event:'retryFunctions'):void}>()
const {t,host,canvas,referencePicker,mode,invalid,ready,canVisualize,sourceText,referenceSelection,functionSelection,functionMenuOpen,referenceFrame,hoverFrame,sourcePickerOpen,pickerStyle,referenceOptions,popupContainer,referenceVisibilityChanged,closeReferences,chooseReference,chooseAtPoint,previewAtPoint,previewSelection,clearPreview,availableFunctions,refreshFunctions,feedback,loadError,operators,conditionOperators,literalValues,chooseLiteral,changeMode,updateSource,remember,focusFormula,insert,openReferences,chooseFunction,chooseConditionOperator,canInsertValue,refreshInsertion,canAddBranch,addBranch}=useTemplateMathEditor(props,emit)
</script>
<style src="./template-math.css" scoped />
