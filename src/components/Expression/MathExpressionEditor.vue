<template>
  <ExpressionWorkspace v-slot="{expand,expanded}" :node="modelValue?.root || fallbackRoot" :context="context" editable stationary hide-heading>
  <section  class="formula-editor" :aria-label="t(conditions ? 'conditionExpression' : 'formula')">
    <div class="formula-editor__surface">
      <div v-if="source && !hideMode" class="formula-editor__mode">
        <a-button type="text" size="small" :disabled="disabled || invalid || forceSource || mode === 'source' && !canVisualize" :aria-label="t(mode === 'visual' ? 'editExpression' : 'backToFormula')" :title="mode === 'source' && !canVisualize ? t('advancedFormulaHint') : undefined" @mousedown.prevent @click="changeMode(mode === 'visual' ? 'source' : 'visual')"><AIcon :type="mode === 'visual' ? 'CodeOutlined' : 'FunctionOutlined'" />{{ t(mode === 'visual' ? 'editExpression' : 'backToFormula') }}</a-button>
      </div>
    <div ref="canvas" class="formula-editor__canvas" @pointerdown.capture="chooseAtPoint" @pointermove="previewAtPoint" @keyup="previewSelection" @pointerleave="clearPreview" @focusout="clearPreview">
      <div v-show="mode === 'visual'" ref="host" class="formula-editor__field" @click.self="focusFormula" @focusout="blurCommit" @scroll="closeReferences()" />
      <a-textarea v-if="mode === 'source'" class="formula-editor__source" :value="sourceText" :disabled="disabled" :bordered="false"
        :aria-label="t('advancedExpression')" @update:value="updateSource" @focus="remember" @click="remember" @keyup="remember" @select="remember" />
      <a-tooltip v-if="hoverHint" :open="true" :trigger="[]" placement="top" :get-popup-container="popupContainer" :overlay-style="{pointerEvents:'none'}">
        <template #title><div class="formula-editor__hint"><strong>{{ hoverHint.name }}<small v-if="hoverHint.type">{{ hoverHint.type }}</small></strong><span v-if="hoverHint.description">{{ hoverHint.description }}</span><span v-if="hoverHint.context">{{ hoverHint.context }}</span></div></template>
        <span class="formula-editor__hint-anchor" :style="hoverHint.style" aria-hidden="true" />
      </a-tooltip>
      <span v-if="referenceFrame || hoverFrame" :class="referenceFrame ? 'formula-editor__active-reference' : 'formula-editor__hover-reference'" :style="referenceFrame || hoverFrame" aria-hidden="true" />
      <a-select v-if="referenceSelection || sourcePickerOpen" ref="referencePicker" class="formula-editor__picker" :style="pickerStyle"
        :value="undefined" :open="true" show-search :options="referenceOptions" option-filter-prop="label"
        dropdown-class-name="formula-editor__reference-menu" :dropdown-match-select-width="false" :dropdown-align="{...popupAlign,offset:[0,-1]}"
        :placeholder="t('chooseVariable')" :aria-label="t('chooseVariable')" :not-found-content="t('noVariable')"
        :get-popup-container="popupContainer" @select="chooseReference(Number($event))"
        @dropdown-visible-change="referenceVisibilityChanged" @keydown.esc.capture.stop.prevent="closeReferences(true)">
        <template #suffixIcon><AIcon type="SearchOutlined" /></template>
        <template #option="option"><SelectOption :label="option.label" :icon="option.icon" :description="option.description" :title="option.description" /></template>
      </a-select>
      <ExpressionFunctionMenu v-if="functionSelection" class="formula-editor__function-picker" :style="pickerStyle" :functions="availableFunctions" :selected-id="functionSelection.id" @choose="chooseFunction" @close="closeReferences(true)" />
    </div>
    <div class="formula-editor__toolbar">
      <div class="formula-editor__actions">
      <span class="formula-editor__symbol" :title="t('calculationFormula')" :aria-label="t('calculationFormula')" role="img"><AIcon type="FunctionOutlined" /></span>
      <a-button type="text" size="small" :disabled="disabled || mode === 'visual' && (!ready || !canInsertValue) || !references.length" :aria-label="t('insertVariable')" @mousedown.prevent @click="openReferences()"><AIcon type="FieldStringOutlined" />{{ t('formulaVariables') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
      <template v-if="mode === 'visual'">
        <a-dropdown :key="'literal-'+expanded" :trigger="['click']" :disabled="disabled || !ready" :get-popup-container="popupContainer" :align="popupAlign">
          <a-button type="text" size="small" :disabled="disabled || !ready || !canInsertValue" :aria-label="t('insertValue')" @mousedown.prevent="refreshInsertion"><AIcon type="NumberOutlined" />{{ t('value') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
          <template #overlay><a-menu @click="chooseLiteral"><a-menu-item v-for="item in literalValues" :key="item.key" :disabled="item.disabled"><SelectOption :icon="item.icon" :label="item.label" :description="item.description" /></a-menu-item></a-menu></template>
        </a-dropdown>
        <a-dropdown :key="'function-'+expanded" :open="functionMenuOpen" :trigger="['click']" :disabled="disabled || !ready" :transition-name="''" :get-popup-container="popupContainer" :align="popupAlign" @open-change="functionMenuVisibilityChanged">
          <a-button type="text" size="small" :disabled="disabled || !ready || !canInsertValue" :aria-label="t('insertFunction')" @mousedown.prevent="refreshInsertion"><AIcon type="FunctionOutlined" />{{ t('formulaFunctions') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
          <template #overlay><ExpressionFunctionMenu :functions="availableFunctions" :error="functionsError" @choose="chooseFunction" @retry="refreshFunctions" @close="closeReferences(true)"><template #error>{{ t('functionCatalogRetry') }}</template></ExpressionFunctionMenu></template>
        </a-dropdown>
        <a-dropdown v-if="conditions" :key="'condition-'+expanded" :trigger="['click']" :disabled="disabled || !ready" :get-popup-container="popupContainer" :align="popupAlign">
          <a-button type="text" size="small" :disabled="disabled || !ready" :aria-label="t('conditionOperators')" @mousedown.prevent="refreshInsertion"><AIcon type="BranchesOutlined" />{{ t('formulaConditions') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
          <template #overlay><a-menu @click="chooseConditionOperator"><a-menu-item key="branch" :disabled="!canAddBranch && !canInsertValue"><SelectOption icon="BranchesOutlined" :label="t(canAddBranch ? 'addFormulaBranch' : 'conditionalFunction')" :description="t('enterFormulaBranch')" /></a-menu-item><a-menu-divider /><a-menu-item v-for="(item, index) in conditionOperators" :key="index" :disabled="item.disabled"><SelectOption icon="BranchesOutlined" :label="item.label" :description="t(item.hint)" /></a-menu-item></a-menu></template>
        </a-dropdown>
      </template>
      <slot name="tools" :finish="finish" />
      </div>
      <div v-if="mode === 'visual'" class="formula-editor__operators"><a-button v-for="item in operators" :key="item.label" type="text" size="small" :disabled="disabled || !ready || item.disabled" @mousedown.prevent @click="insert(item)">{{ item.label }}</a-button></div>
      <div class="formula-editor__view-tools">

        <a-dropdown v-if="mode === 'visual'" :key="'tools-'+expanded" :trigger="['click']" :get-popup-container="popupContainer" :align="popupAlign">
          <a-button type="text" size="small" :title="t('formulaMore')" :aria-label="t('formulaMore')" @mousedown.prevent><AIcon type="MoreOutlined" /></a-button>
          <template #overlay><a-menu>
            <a-menu-item :disabled="!ready" @click="clipboard.copy"><SelectOption icon="CopyOutlined" :label="t('formulaCopyLatex')" /></a-menu-item>
            <a-menu-item :disabled="disabled || !ready" @click="clipboard.paste"><SelectOption icon="SnippetsOutlined" :label="t('formulaPasteLatex')" /></a-menu-item>
            <a-sub-menu key="help"><template #title><SelectOption icon="InfoCircleOutlined" :label="t('formulaEditingHelp')" /></template>
              <a-menu-item disabled>{{ feedback }}</a-menu-item>
              <a-menu-item v-for="key in conditions ? ['formulaBranchesHint','formulaReplaceHint','formulaNavigateHint','formulaUndoHint'] : ['formulaReplaceHint','formulaNavigateHint','formulaUndoHint']" :key="key" disabled>{{ t(key) }}</a-menu-item>
            </a-sub-menu>
          </a-menu></template>
        </a-dropdown>
        <a-button v-show="!expanded" type="text" size="small" :title="t('expandEdit')" :aria-label="t('expandEdit')" @click="expand"><AIcon type="ExpandAltOutlined" /></a-button>
        <slot name="view-tools" :finish="finish" />
      </div>
    </div>
    <div v-if="clipboard.manualOpen.value" class="formula-editor__clipboard-panel">
      <a-textarea v-model:value="clipboard.manualText.value" :rows="3" :disabled="disabled" :placeholder="t('formulaPasteManualHint')" :aria-label="t('formulaPasteLatex')" />
      <div><a-button type="text" size="small" @click="clipboard.cancelManual">{{ t('cancel') }}</a-button><a-button type="primary" size="small" :disabled="disabled || !clipboard.manualText.value.trim()" @click="clipboard.confirmManual">{{ t('formulaInsertLatex') }}</a-button></div>
    </div>
    </div>
    <div v-if="invalid || loadError || clipboard.error.value || inputNotice" class="formula-editor__footer">
      <p class="formula-editor__feedback" :class="{ 'formula-editor__error': invalid || loadError || clipboard.error.value }" :role="invalid || loadError || clipboard.error.value ? 'alert' : 'status'" :title="feedback">{{ feedback }}</p>

    </div>
  </section>
  </ExpressionWorkspace>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import ExpressionWorkspace from './ExpressionWorkspace.vue'
import SelectOption from '../SelectOption/index.vue'
import ExpressionFunctionMenu from './ExpressionFunctionMenu.vue'
import { useMathEditor,type MathEditorProps,type MathEditorChange } from './useMathEditor'
import type { StructuredExpression } from './types'
import type { ExpressionReference } from './editor'
const props=withDefaults(defineProps<MathEditorProps>(),{conditions:true})
// Align against the viewport even when the host page has a taller scrollable document.
const popupAlign={overflow:{adjustX:1,adjustY:1,alwaysByViewport:true}}
const fallbackRoot={type:'literal' as const,valueType:'null' as const,value:null}
const emit=defineEmits<{(event:'change',value:MathEditorChange):void;(event:'update:modelValue',value:StructuredExpression):void;(event:'invalid',value:boolean):void;(event:'retryFunctions'):void;(event:'referenceHover',value:ExpressionReference|undefined):void}>()
const references=computed(()=>props.context.references)
const {blurCommit,finish,clipboard,inputNotice,t,host,canvas,referencePicker,mode,invalid,ready,canVisualize,sourceText,referenceSelection,functionSelection,functionMenuOpen,functionMenuVisibilityChanged,referenceFrame,hoverFrame,hoverHint,sourcePickerOpen,pickerStyle,referenceOptions,popupContainer,referenceVisibilityChanged,closeReferences,chooseReference,chooseAtPoint,previewAtPoint,previewSelection,clearPreview,availableFunctions,refreshFunctions,feedback,loadError,operators,conditionOperators,literalValues,chooseLiteral,changeMode,updateSource,remember,focusFormula,insert,openReferences,chooseFunction,chooseConditionOperator,canInsertValue,refreshInsertion,canAddBranch,addBranch}=useMathEditor(props,emit)
</script>
<style src="./math-editor.css" scoped />
