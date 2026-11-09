<template>
  <a-popover v-if="summary" :trigger="$slots.trigger ? ['hover','focus','click'] : ['hover','focus']" placement="top" :get-popup-container="summaryPopupContainer">
    <template #content><div class="template-formula-preview"><ExpressionView v-if="tree" :node="tree.root" :context="context" :show-result="false" /><span v-else class="template-formula-source">{{ label }}</span><small v-if="conditionCount">{{ t('order') }}</small></div></template>
    <slot name="trigger"><span class="template-formula-summary" :aria-label="conditionCount ? t('conditionalSummary',{count:conditionCount}) : label">
      <span v-if="conditionCount" class="template-formula-summary__cases"><AIcon type="BranchesOutlined" />{{ t('conditionalSummary',{count:conditionCount}) }}</span>
      <ExpressionView v-else-if="tree" :node="tree.root" :context="context" compact :show-result="false" />
      <span v-else class="template-formula-summary__source">{{ label }}</span>
      <AIcon type="ExpandAltOutlined" class="template-formula-summary__inspect" :title="t('expandFormula')" />
    </span></slot>
  </a-popover>
  <ExpressionWorkspace v-else-if="tree && !compact" v-slot="{substitute}" :node="tree.root" :context="context" :explanation="explanation" :format="format" @expanded-change="emit('expandedChange',$event)">
    <ExpressionView :node="tree.root" :context="context" :explanation="explanation" :format="format" :show-result="showResult" :substitute="substitute" />
  </ExpressionWorkspace>
  <ExpressionView v-else-if="tree" :node="tree.root" :context="context" compact :explanation="explanation" :format="format" />
  <span v-else-if="!semanticOnly" class="template-formula-source" :class="{'is-compact':compact}">{{ label }}</span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFormulaDisplay } from './useFormulaDisplay'
import ExpressionView from '../../../Expression/ExpressionView.vue'
import ExpressionWorkspace from '../../../Expression/ExpressionWorkspace.vue'
import { editorMessages } from '../../../Expression/editorMessages'
import type { ExpressionExplanation,ExpressionNode } from '../../../Expression/types'
import type { ExplanationFormatter } from '../../../Expression/explanation'
import type { TemplateRule } from '../designer'
import type { MetricCalculatorDescriptor, MetricTemplate } from '../../types'
const props = withDefaults(defineProps<{ template: MetricTemplate; rule: TemplateRule; expression: string; calculators?: MetricCalculatorDescriptor[]; compact?: boolean; summary?:boolean; semanticOnly?: boolean; explanation?:ExpressionExplanation; format?:ExplanationFormatter;showResult?:boolean }>(),{showResult:true})
const emit=defineEmits<{(event:'expandedChange',value:boolean):void}>()
const { label, tree, context } = useFormulaDisplay(props)
const { t }=useI18n({useScope:'local',messages:editorMessages})
const conditionCount=computed(()=>tree.value ? countConditions(tree.value.root) : 0)
function countConditions(node:ExpressionNode):number {
  switch(node.type) {
    case 'conditional':return 1+countConditions(node.condition)+countConditions(node.whenTrue)+countConditions(node.whenFalse)
    case 'binary':return countConditions(node.left)+countConditions(node.right)
    case 'unary':return countConditions(node.operand)
    case 'logical':return node.operands.reduce((total,item)=>total+countConditions(item),0)
    case 'call':return node.arguments.reduce((total,item)=>total+countConditions(item),0)
    default:return 0
  }
}
// 图画布有缩放和裁切，预览留在所属顶层对话框或 body，避免跟随节点一起裁切。
const summaryPopupContainer=(trigger:HTMLElement)=>trigger.closest('dialog') || trigger.ownerDocument.body
</script>
<style scoped>
.template-formula-source { display:block; font-size:13px; line-height:1.85; white-space:pre-wrap; overflow-wrap:anywhere }
.template-formula-source.is-compact { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; font-size:12px }
.template-formula-summary { display:flex; align-items:center; gap:8px; width:100%; min-width:0; height:28px }
.template-formula-summary>:first-child { flex:1; min-width:0; overflow:hidden }
.template-formula-summary__cases { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-2) }
.template-formula-summary__inspect { flex:none; font-size:12px; color:var(--ink-3) }
.template-formula-summary__source { text-overflow:ellipsis; white-space:nowrap }
.template-formula-summary :deep(.expression-math) { overflow:hidden; max-height:28px; padding:0; font-size:12px }
.template-formula-preview { max-width:min(560px,80vw); max-height:55vh; overflow:auto }
.template-formula-preview small { display:block; margin-top:8px; font-size:12px; color:var(--ink-3) }
</style>
