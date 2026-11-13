<template>
  <ExpressionWorkspace v-slot="{expand,expanded}" :node="modelValue?.root || fallbackRoot" :context="context" editable stationary hide-heading @expanded-change="closeReferences()">
  <section class="formula-editor" :style="{'--formula-candidate-width':expanded ? '320px' : '296px'}" :aria-label="t(conditions ? 'conditionExpression' : 'formula')">
    <div class="formula-editor__surface">
      <div v-if="source && !hideMode" class="formula-editor__mode">
        <a-button type="text" size="small" :disabled="disabled || invalid || forceSource || mode === 'source' && !canVisualize" :aria-label="t(mode === 'visual' ? 'editExpression' : 'backToFormula')" :title="mode === 'source' && !canVisualize ? t('advancedFormulaHint') : undefined" @mousedown.prevent @click="changeMode(mode === 'visual' ? 'source' : 'visual')"><AIcon :type="mode === 'visual' ? 'CodeOutlined' : 'FunctionOutlined'" />{{ t(mode === 'visual' ? 'editExpression' : 'backToFormula') }}</a-button>
      </div>
    <div ref="canvas" class="formula-editor__canvas" @pointerdown.capture="chooseAtPoint" @pointermove="previewAtPoint" @keyup="previewSelection" @pointerleave="clearPreview" @focusout="clearPreview" @contextmenu.capture="openContextMenu">
      <div v-show="mode === 'visual'" ref="host" class="formula-editor__field" @click.self="focusFormula" @focusout="blurCommit" @scroll="closeReferences()" />
      <a-textarea v-if="mode === 'source'" class="formula-editor__source" :value="sourceText" :disabled="disabled" :bordered="false"
        :aria-label="t('advancedExpression')" @update:value="updateSource" @focus="remember" @click="remember" @keyup="remember" @select="remember" />
      <a-tooltip v-if="hoverHint" :open="true" :trigger="[]" placement="top" :get-popup-container="popupContainer" :overlay-style="{pointerEvents:'none'}">
        <template #title><div class="formula-editor__hint"><strong>{{ hoverHint.name }}<small v-if="hoverHint.type">{{ hoverHint.type }}</small></strong><span v-if="hoverHint.description">{{ hoverHint.description }}</span><span v-if="hoverHint.context">{{ hoverHint.context }}</span></div></template>
        <span class="formula-editor__hint-anchor" :style="hoverHint.style" aria-hidden="true" />
      </a-tooltip>
      <span v-if="hoverFrame" class="formula-editor__hover-reference" :style="hoverFrame" aria-hidden="true" />
      <a-dropdown v-if="candidateKind" :open="true" :trigger="[]" :transition-name="''" :get-popup-container="popupContainer" :align="popupAlign">
        <span class="formula-editor__picker-anchor" :style="pickerStyle" aria-hidden="true" />
        <template #overlay><div ref="popupContent" @keydown.esc.stop.prevent="closeReferences(true)">
          <ExpressionCandidateMenu :key="candidateKind" :compact="!expanded" :groups="candidateGroups" :placeholder="candidatePlaceholder" :empty-text="candidateEmpty" :selected-id="functionSelection?.id" :error="candidateKind === 'function' && functionsError" @choose="chooseCandidate" @preview="previewConditionTarget($event.key)" @retry="refreshFunctions" @close="closeReferences(true)"><template #error>{{ t('functionCatalogRetry') }}</template></ExpressionCandidateMenu>
        </div></template>
      </a-dropdown>
      <a-dropdown v-if="contextMenuOpen" :open="true" :trigger="[]" :transition-name="''" :get-popup-container="popupContainer" :align="popupAlign">
        <span class="formula-editor__picker-anchor" :style="pickerStyle" aria-hidden="true" />
        <template #overlay><div ref="popupContent" @keydown.esc.stop.prevent="closeReferences(true)"><a-menu @click="contextAction">
          <a-menu-item key="variable" :disabled="disabled || !canInsertValue || !referenceOptions.length"><SelectOption icon="FieldStringOutlined" :label="t('formulaVariables')" /></a-menu-item>
          <a-menu-item key="literal" :disabled="disabled || !canInsertValue || !literalValues.some(item=>!item.disabled)"><SelectOption icon="NumberOutlined" :label="t('value')" /></a-menu-item>
          <a-menu-item key="function" :disabled="disabled || !canInsertValue || !functionsError && !availableFunctions.some(item=>!item.disabled)"><SelectOption icon="FunctionOutlined" :label="t('formulaFunctions')" /></a-menu-item>
          <a-menu-item v-if="conditions" key="condition" :disabled="disabled || !canAddBranch && !canInsertValue"><SelectOption icon="BranchesOutlined" :label="t('formulaConditions')" /></a-menu-item>
          <a-menu-divider />
          <a-menu-item key="undo" :disabled="disabled || !contextCanUndo"><SelectOption icon="UndoOutlined" :label="t('undo')" /></a-menu-item>
          <a-menu-item key="redo" :disabled="disabled || !contextCanRedo"><SelectOption icon="RedoOutlined" :label="t('redo')" /></a-menu-item>
          <a-menu-divider />
          <a-menu-item key="copy"><SelectOption icon="CopyOutlined" :label="t('formulaCopyLatex')" /></a-menu-item>
          <a-menu-item key="paste" :disabled="disabled"><SelectOption icon="SnippetsOutlined" :label="t('formulaPasteLatex')" /></a-menu-item>
          <a-menu-divider />
          <a-menu-item key="selectAll"><SelectOption icon="SelectOutlined" :label="t('selectAll')" /></a-menu-item>
        </a-menu></div></template>
      </a-dropdown>
    </div>
    <div class="formula-editor__toolbar">
      <div class="formula-editor__actions">
      <span class="formula-editor__symbol" :title="t('calculationFormula')" :aria-label="t('calculationFormula')" role="img"><AIcon type="FunctionOutlined" /></span>
      <a-button type="text" size="small" :disabled="disabled || mode === 'visual' && (!ready || !canInsertValue) || !references.length" :aria-label="t('insertVariable')" @mousedown.prevent @click="openReferences()"><AIcon type="FieldStringOutlined" />{{ t('formulaVariables') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
      <template v-if="mode === 'visual'">
        <a-button type="text" size="small" :disabled="disabled || !ready || !canInsertValue" :aria-label="t('insertValue')" @mousedown.prevent="refreshInsertion" @click="openInsertionMenu('literal')"><AIcon type="NumberOutlined" />{{ t('value') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
        <a-button type="text" size="small" :disabled="disabled || !ready || !canInsertValue" :aria-label="t('insertFunction')" @mousedown.prevent="refreshInsertion" @click="functionMenuVisibilityChanged(!functionMenuOpen)"><AIcon type="FunctionOutlined" />{{ t('formulaFunctions') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
        <a-button v-if="conditions" type="text" size="small" :disabled="disabled || !ready" :aria-label="t('conditionOperators')" @mousedown.prevent="refreshInsertion" @click="openInsertionMenu('condition')"><AIcon type="BranchesOutlined" />{{ t('formulaConditions') }}<AIcon type="DownOutlined" class="formula-editor__caret" /></a-button>
      </template>
      <slot name="tools" :finish="finish" />
      </div>
      <div v-if="mode === 'visual'" class="formula-editor__operators"><a-button v-for="item in operators" :key="item.label" type="text" size="small" :disabled="disabled || !ready || item.disabled" @mousedown.prevent @click="insert(item)">{{ item.label }}</a-button></div>
      <div class="formula-editor__view-tools">

        <a-dropdown v-if="mode === 'visual'" :key="'tools-'+expanded" :trigger="['click']" :get-popup-container="popupContainer" :align="popupAlign" @open-change="prepareToolbarMenu">
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
import ExpressionCandidateMenu from './ExpressionCandidateMenu.vue'
import { useMathEditor,type MathEditorProps,type MathEditorChange } from './useMathEditor'
import type { StructuredExpression } from './types'
import type { ExpressionReference } from './editor'
const props=withDefaults(defineProps<MathEditorProps>(),{conditions:true})
// Align against the viewport even when the host page has a taller scrollable document.
const popupAlign={overflow:{adjustX:true,adjustY:true,alwaysByViewport:true}}
const fallbackRoot={type:'literal' as const,valueType:'null' as const,value:null}
const emit=defineEmits<{(event:'change',value:MathEditorChange):void;(event:'update:modelValue',value:StructuredExpression):void;(event:'invalid',value:boolean):void;(event:'retryFunctions'):void;(event:'referenceHover',value:ExpressionReference|undefined):void}>()
const references=computed(()=>props.context.references)
const {blurCommit,finish,clipboard,inputNotice,t,host,canvas,popupContent,contextMenuOpen,contextCanUndo,contextCanRedo,openContextMenu,contextAction,mode,invalid,ready,canVisualize,sourceText,referenceSelection,functionSelection,functionMenuOpen,candidateKind,candidateGroups,candidatePlaceholder,candidateEmpty,chooseCandidate,previewConditionTarget,functionMenuVisibilityChanged,insertionMenu,openInsertionMenu,prepareToolbarMenu,hoverFrame,hoverHint,sourcePickerOpen,pickerStyle,referenceOptions,popupContainer,closeReferences,chooseReference,chooseAtPoint,previewAtPoint,previewSelection,clearPreview,availableFunctions,refreshFunctions,feedback,loadError,operators,conditionOperators,literalValues,chooseLiteral,changeMode,updateSource,remember,focusFormula,insert,openReferences,chooseFunction,chooseConditionOperator,canInsertValue,refreshInsertion,canAddBranch,addBranch}=useMathEditor(props,emit)
</script>
<style src="./math-editor.css" scoped />
