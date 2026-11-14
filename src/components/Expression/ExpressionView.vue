<template>
  <MathExpressionView :node="node" :context="context" :facts="facts" :compact="compact" :show-result="showResult">
  <div v-if="branches.length" class="expression-document expression-branches" :class="{'is-compact':compact}">
    <template v-for="group in groups" :key="group.key">
      <a-button v-if="group.skipped" type="text" size="small" class="expression-branches__toggle" :aria-expanded="expanded.has(group.key)" @click="toggle(group.key)"><AIcon type="EllipsisOutlined" />{{ t(expanded.has(group.key) ? 'hideUnusedBranches' : 'unusedBranches',{count:group.rows.length}) }}</a-button>
      <template v-if="!group.skipped || expanded.has(group.key)">
        <div v-for="row in group.rows" :key="row.key" :class="['expression-branch',{'is-selected':row.selected,'is-false':row.outcome === 'false','is-skipped':row.skipped}]" :style="{'--branch-depth':row.depth}">
          <span v-if="row.outcome || row.selected" role="img" :class="['expression-outcome',`is-${row.outcome || 'true'}`]" :aria-label="t(row.outcome ? outcomeLabels[row.outcome] : 'usedBranch')" :title="t(row.outcome ? outcomeLabels[row.outcome] : 'usedBranch')"><AIcon :type="row.outcome ? outcomeIcons[row.outcome] : 'CheckOutlined'" aria-hidden="true" /></span><span v-else class="expression-outcome" />
          <div class="expression-branch__formula">
            <div class="expression-branch__condition"><span class="expression-branch__keyword">{{ row.label }} </span><ExpressionTokens v-if="row.condition" :parts="row.condition" :context="context" :compact="compact" /></div>
            <span v-if="row.result" class="expression-branch__result"><span v-if="row.condition" class="expression-branch__keyword" :title="t('then')">?</span><ExpressionTokens :parts="row.result" :context="context" :compact="compact" /><strong v-if="row.selected && row.value" class="expression-branch__value">= {{ row.value }}</strong></span>
          </div>
        </div>
      </template>
    </template>
  </div>
  <span v-else class="expression-document" :class="{'is-compact':compact}"><ExpressionTokens :parts="parts" :context="context" :compact="compact" /></span>
  </MathExpressionView>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExpressionNode,ExpressionExplanation } from './types'
import type { ExpressionEditorContext } from './editor'
import { expressionDocument } from './document'
import { documentParts,explanationFacts,outcomeIcons,outcomeLabels } from './presentation'
import { expressionBranches,branchGroups } from './branches'
import ExpressionTokens from './ExpressionTokens.vue'
import MathExpressionView from './MathExpressionView.vue'
import type { ExplanationFormatter } from './explanation'
import { editorMessages } from './editorMessages'
const props=withDefaults(defineProps<{node:ExpressionNode;context:ExpressionEditorContext;explanation?:ExpressionExplanation;format?:ExplanationFormatter;compact?:boolean;showResult?:boolean;substitute?:boolean}>(),{showResult:true,substitute:true})
const {t}=useI18n({useScope:'local',messages:editorMessages})
const model=computed(()=>expressionDocument(props.node,props.context,t))
const facts=computed(()=>{
  const recorded=props.explanation && props.format ? explanationFacts(props.node,props.explanation,props.format) : new Map()
  // Original notation keeps recorded branch outcomes, without substituting reference labels.
  return props.substitute ? recorded : new Map([...recorded].map(([path,fact])=>[path,{...fact,text:''}]))
})
const parts=computed(()=>documentParts(model.value,facts.value))
const branches=computed(()=>!props.compact && props.explanation && props.format && props.node.type === 'conditional' ? expressionBranches(props.node,props.context,t,facts.value) : [])
const groups=computed(()=>branchGroups(branches.value))
const expanded=ref(new Set<string>())
function toggle(key:string) {const next=new Set(expanded.value);next.has(key) ? next.delete(key) : next.add(key);expanded.value=next}
</script>
<style src="./expression.css" />
