<template>
  <section class="expression-explanation">
    <template v-if="decision.rows.length">
      <p v-if="decisive" class="expression-explanation__decision"><span>{{ explanationText(decisive.condition,format) }}</span><b :class="{matched:decisive.selected === true}">{{ t(decisive.selected === undefined ? 'unknown' : 'yes') }}</b></p>
      <p v-else class="expression-explanation__default">{{ t('otherwise') }}</p>
      <details v-if="unmatched.length"><summary>{{ t('unmatched',{count:unmatched.length}) }}</summary><ol><li v-for="(row,index) in unmatched" :key="index"><span>{{ explanationText(row.condition,format) }}</span><b>{{ t('no') }}</b></li></ol></details>
    </template>
    <p v-else>{{ explanationText(explanation,format) }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { explanationDecisions, explanationText, type ExplanationFormatter } from './explanation'
import type { ExpressionExplanation } from './types'
const props=defineProps<{explanation:ExpressionExplanation;format:ExplanationFormatter}>()
const decision=computed(()=>explanationDecisions(props.explanation))
// 仅收拢后端解释中已知的否定条件；未知条件必须保留，不能当成默认分支。
const decisive=computed(()=>decision.value.rows.find(row=>row.selected !== false))
const unmatched=computed(()=>decision.value.rows.filter(row=>row.selected === false))
const {t}=useI18n({useScope:'local',messages:{zh:{yes:'满足',no:'不满足',unknown:'缺少判断数据',otherwise:'未命中条件，采用默认结果',unmatched:'{count} 项条件不满足'},en:{yes:'Met',no:'Not met',unknown:'Missing decision data',otherwise:'No condition matched; using the default result',unmatched:'{count} conditions not met'}}})
</script>
<style scoped>
.expression-explanation { display:grid; gap:6px; min-width:0; font-size:13px; color:var(--ink-2) }
.expression-explanation ol { list-style:none; padding:0; margin:0 }
.expression-explanation li { display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding:7px 0; border-bottom:1px solid var(--line); line-height:1.6 }
.expression-explanation li span,.expression-explanation__decision span { overflow-wrap:anywhere }
.expression-explanation b { color:var(--ink-3); font-size:12px; white-space:nowrap; font-weight:400 }
.expression-explanation b.matched { color:var(--accent); font-weight:500 }
.expression-explanation p { margin:0; line-height:1.7; overflow-wrap:anywhere }
.expression-explanation__decision { display:flex; align-items:baseline; justify-content:space-between; gap:12px }
.expression-explanation summary { cursor:pointer; color:var(--ink-3); font-size:12px; line-height:1.8 }
</style>
