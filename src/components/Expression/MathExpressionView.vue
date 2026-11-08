<template>
  <span v-if="markup" class="expression-math-shell" :class="{'is-compact':compact}">
    <span class="expression-math-equation" role="math" :aria-label="projection?.document.text">
      <span ref="element" class="expression-math" :class="{'is-replay':!!facts?.size}" v-html="markup" />
      <strong v-if="projection?.result !== undefined && !compact && showResult !== false" class="expression-math-result"><span>=</span>{{ projection.result }}</strong>
    </span>
    <a-button v-if="projection?.skipped && !compact" type="text" size="small" class="expression-math-toggle" :aria-expanded="expanded" @click="expanded=!expanded"><AIcon type="EllipsisOutlined" />{{ t(expanded ? 'hideUnusedBranches' : 'unusedBranches',{count:projection.skipped}) }}</a-button>
  </span>
  <slot v-else />
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExpressionNode } from './types'
import type { ExpressionEditorContext } from './editor'
import type { ExpressionFact } from './presentation'
import { expressionMath } from './math'
import { editorMessages } from './editorMessages'
import { useMathMarkup } from './useMathMarkup'
const props=withDefaults(defineProps<{node:ExpressionNode;context:ExpressionEditorContext;facts?:Map<string,ExpressionFact>;compact?:boolean;showResult?:boolean}>(),{showResult:true})
const {t}=useI18n({useScope:'local',messages:editorMessages})
const expanded=ref(false),element=ref<HTMLElement>()
const projection=computed(()=>{try{return expressionMath(props.node,props.context,t,props.facts,true,{showSkipped:expanded.value || props.compact})}catch{return undefined}})
const {markup}=useMathMarkup(projection,element)
</script>
<style src="./math-semantic.css" />
<style>
.expression-math-shell { display:block; min-width:0; max-width:100% }
.expression-math-equation { display:flex; align-items:center; gap:12px; min-width:0; max-width:100% }
.expression-math { display:block; min-width:0; max-width:100%; overflow:auto; padding:8px 2px; font-size:16px; line-height:1.5; color:var(--ink-1); scrollbar-width:thin }
.expression-math-shell.is-compact .expression-math { font-size:14px; max-height:100px; padding:3px 0 }
.expression-math .expression-math-caption,.expression-math .expression-math-meaning { color:var(--ink-3); font-family:inherit; font-weight:400 }
.expression-math .expression-math-meaning { font-size:.72em }
.expression-math .expression-math-caption .expression-math-reference { color:var(--ink-3) }
.expression-math-result { display:inline-flex; flex:none; align-items:baseline; gap:8px; max-width:40%; overflow-wrap:anywhere; font-size:18px; font-weight:600; color:var(--accent) }
.expression-math-result>span { font-size:16px; font-weight:400; color:var(--ink-3) }
.expression-math [data-expression-inspect] { border-radius:3px; cursor:help }
.expression-math [data-expression-inspect]:hover,.expression-math [data-expression-inspect]:focus-visible { background:var(--accent-soft); outline:1px dashed var(--accent); outline-offset:2px }
.expression-math .expression-math-fold { color:var(--ink-3) }
.expression-math-toggle.ant-btn { height:24px; padding:0 2px; color:var(--ink-3); font-size:12px }
.expression-math .expression-math-fact.is-skipped { opacity:.35 }
.expression-math .expression-math-fact.is-selected { font-weight:500 }
.expression-math .expression-math-fact.is-false { color:var(--ink-3) }
.expression-math .expression-math-fact.is-unknown { color:var(--warning,#d89614) }
.expression-math .expression-math-outcome { font-size:.72em; color:var(--ink-3) }
.expression-math .expression-math-outcome.is-true { color:var(--accent) }
.expression-math .expression-math-outcome.is-unknown { color:var(--warning,#d89614) }
</style>
