<template>
  <section class="template-formula">
    <ExpressionWorkspace v-if="tree && !advanced" v-slot="{expand,expanded}" :node="tree.root" :context="context" :editable="!disabled" stationary hide-heading>
      <TemplateMathEditor :model-value="modelValue" :tree="tree" :empty="empty" :references="references" :functions="functions" :result-labels="resultLabels" :disabled="disabled" :conditions="true" hide-mode @change="changeMath" @invalid="setInvalid">
        <template #tools><FormulaTools :disabled="disabled || invalid" :advanced="false" :can-advance="true" @advanced="advanced = true" /></template>
        <template #view-tools><a-button v-show="!expanded" type="text" size="small" :aria-label="t('expandEdit')" :title="t('expandEdit')" @click="expand"><AIcon type="ExpandAltOutlined" /></a-button></template>
      </TemplateMathEditor>
    </ExpressionWorkspace>
    <ContinuousExpressionEditor v-else-if="tree" :node="tree.root" :empty="empty" :context="context" @change="changeTree" @invalid="setInvalid">
      <template #tools="{invalid}"><FormulaTools :disabled="disabled || invalid" :advanced="true" :can-advance="true" @business="advanced = false" /></template>
    </ContinuousExpressionEditor>
    <TemplateMathEditor v-else :model-value="modelValue" :tree="props.tree" :references="references" :functions="functions" :disabled="disabled" :conditions="conditions" force-source hide-mode @change="change" @invalid="setInvalid">
      <template #tools><FormulaTools v-if="tree" :disabled="disabled || invalid" :advanced="true" :can-advance="canAdvance" @business="advanced = false" /></template>
    </TemplateMathEditor>
    <a-button v-if="functionsError" type="text" size="small" @click="refreshFunctions">{{ t('catalogFailed') }} · {{ t('retry') }}</a-button>
  </section>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExpressionNode,StructuredExpression } from '../../Expression/types'
import type { ExpressionResultLabel } from '../../Expression/editor'
import { expressionReferences,expressionText } from '../../Expression/display'
import { editorMessages } from '../../Expression/editorMessages'
import ContinuousExpressionEditor from '../../Expression/ContinuousExpressionEditor.vue'
import ExpressionWorkspace from '../../Expression/ExpressionWorkspace.vue'
import { useExpressionFunctions } from '../../Expression/useExpressionFunctions'
import TemplateMathEditor from './TemplateMathEditor.vue'
import FormulaTools from './FormulaTools.vue'
import { expressionToTree,formulaReferencePath,type FormulaReference } from './formula'
import { configurationSnapshot } from './configurationText'
type FormulaChange={expression:string;expressionTree?:StructuredExpression;metricIds?:string[]}
const props=defineProps<{modelValue:string;tree?:StructuredExpression;references:FormulaReference[];resultLabels?:ExpressionResultLabel[];disabled?:boolean;conditions?:boolean}>()
const emit=defineEmits<{(event:'change',value:FormulaChange):void;(event:'invalid',value:boolean):void}>()
const {t}=useI18n({useScope:'local',messages:editorMessages})
const {functions,error:functionsError,refresh:refreshFunctions}=useExpressionFunctions()
const advanced=ref(false),invalid=ref(false)
// 旧公式只作显示投影；查看和切换模式不写回模板。
const empty=computed(()=>!props.tree && !props.modelValue.trim())
const emptyRoot:ExpressionNode={type:'literal',valueType:'null',value:null}
const tree=computed(()=>props.tree || expressionToTree(props.modelValue,props.references) || (empty.value ? {version:1 as const,root:emptyRoot} : undefined))
const context=computed(()=>({references:props.references.map(item=>({...formulaReferencePath(item),label:item.label,displayLabel:item.displayLabel,schema:item.schema,unit:item.unit})),functions:functions.value,resultLabels:props.resultLabels,disabled:props.disabled}))
const canAdvance=computed(()=>!props.tree || configurationSnapshot(expressionToTree(expressionText(props.tree),props.references)) === configurationSnapshot(props.tree))
function setInvalid(value:boolean) {invalid.value=value;emit('invalid',value)}
function change(value:FormulaChange) {if (!props.disabled) emit('change',value)}
// 数学输入输出同一棵树；父级不同时保存一份可独立修改的脚本。
function changeMath(value:FormulaChange) {if(value.expressionTree)changeTree(value.expressionTree.root);else change(value)}
function changeTree(root:ExpressionNode) {
  const metricIds=[...new Set(expressionReferences(root).flatMap(node=>{
    const reference=props.references.find(item=>{const path=formulaReferencePath(item);return path.id === node.id && JSON.stringify(path.path) === JSON.stringify(node.path)})
    return reference?.metricId ? [reference.metricId] : []
  }))]
  change({expression:'',expressionTree:{version:1,root},metricIds})
}
</script>
<style scoped>
.template-formula { min-width:0; display:grid; gap:6px }
</style>
