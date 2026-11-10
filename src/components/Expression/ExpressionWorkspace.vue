<template>
  <section class="expression-workspace">
    <header v-if="!hideHeading" class="expression-workspace__heading">
      <span>{{ t('calculationFormula') }}</span>
      <div class="expression-workspace__heading-tools">
      <a-button v-if="!editable" type="text" size="small" :title="t('formulaCopyLatex')" :aria-label="t('formulaCopyLatex')" @click="copyFormula"><AIcon type="CopyOutlined" /></a-button>
      <a-button ref="trigger" type="text" size="small" :aria-expanded="expanded" @click="expanded=true"><AIcon type="ExpandAltOutlined" />{{ t(editable ? 'expandEdit' : explanation ? 'inspectValues' : 'expandFormula') }}</a-button>
      </div>
    </header>
    <component :is="stationary ? 'dialog' : Teleport" ref="stableDialog" :to="stationary ? undefined : modalHost" :disabled="!expanded || !modalHost" :class="stationary ? ['expression-workspace__stable',{'is-expanded':expanded}] : undefined" :role="stationary ? expanded ? 'dialog' : 'group' : undefined" :aria-label="stationary ? t('calculationFormula') : undefined" @cancel.prevent="expanded=false">
      <header v-if="stationary && expanded" class="expression-workspace__modal-heading"><strong>{{ t('calculationFormula') }}</strong><a-button type="text" :aria-label="t('close')" @click="expanded=false"><AIcon type="CloseOutlined" /></a-button></header>
      <div ref="content" class="expression-workspace__content" :class="{'is-expanded':expanded,'has-data':!!explanation && !!rows.length}" @pointerover="track" @pointerleave="highlight()" @focusin="track" @focusout="highlight()">
        <div class="expression-workspace__formula">
          <div v-if="expanded && !editable" class="expression-workspace__heading-tools">
            <a-segmented v-if="explanation" v-model:value="view" class="expression-workspace__view" size="small" :aria-label="t('formulaView')" :options="[{label:t('originalFormula'),value:'original'},{label:t('recordedFormula'),value:'recorded'}]" />
            <a-button type="text" size="small" :title="t('formulaCopyLatex')" :aria-label="t('formulaCopyLatex')" @click="copyFormula"><AIcon type="CopyOutlined" /></a-button>
          </div>
          <slot :substitute="view==='recorded'" :expand="expand" :expanded="expanded" />
          <p v-if="copyFeedback" class="expression-workspace__copy-feedback" :class="{'is-error':copyFailed}" :role="copyFailed ? 'alert' : 'status'">{{ copyFeedback }}</p>
        </div>
        <aside v-if="expanded && explanation && rows.length" class="expression-workspace__data" :aria-label="t('operand')">
          <h4><AIcon type="DatabaseOutlined" />{{ t('operand') }}<small>{{ rows.length }}</small></h4>
          <p v-if="!rows.length" class="expression-workspace__empty">{{ t('noReferences') }}</p>
          <div v-for="row in rows" :key="row.key" class="expression-workspace__row" :class="{'is-skipped':row.skipped && row.recorded,'is-parameter':row.parameter}" :data-expression-reference="row.key" tabindex="0">
            <div class="expression-workspace__identity" :title="row.source"><AIcon :type="row.icon" /><span>{{ row.label }}</span><small>{{ row.parameter ? t('parameter') : row.type }}</small></div>
            <small v-if="row.source !== row.label" class="expression-workspace__source">{{ row.source }}</small>
            <b v-if="row.values.length">{{ row.values.join(' / ') }}</b>
            <small v-else-if="explanation">{{ t(row.skipped && row.recorded ? 'notUsed' : 'valueNotRecorded') }}</small>
            <small v-else-if="row.unit">{{ row.unit }}</small>
          </div>
        </aside>
      </div>
    </component>
    <a-modal v-if="!stationary" :open="expanded" :title="t('calculationFormula')" :footer="null" width="min(1040px, calc(100vw - 32px))" :destroy-on-close="false" wrap-class-name="expression-workspace-modal" :after-close="restoreFocus" @cancel="expanded=false">
      <div ref="modalHost" />
    </a-modal>
  </section>
</template>
<script setup lang="ts">
import { ref, watch, Teleport } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExpressionNode,ExpressionExplanation } from './types'
import type { ExpressionEditorContext } from './editor'
import type { ExplanationFormatter } from './explanation'
import { useExpressionWorkspace } from './useExpressionWorkspace'
import { editorMessages } from './editorMessages'
const props=defineProps<{node:ExpressionNode;context:ExpressionEditorContext;explanation?:ExpressionExplanation;format?:ExplanationFormatter;editable?:boolean;stationary?:boolean;hideHeading?:boolean}>()
const emit=defineEmits<{(event:'expandedChange',value:boolean):void}>()
const {t}=useI18n({useScope:'local',messages:editorMessages})
const view=ref('recorded')
const {copyFormula,copyFeedback,copyFailed,expanded,expand,content,modalHost,stableDialog,trigger,rows,highlight,track,restoreFocus}=useExpressionWorkspace(props,t)
watch(expanded,value=>emit('expandedChange',value),{flush:'sync'})
</script>
<style src="./expression.css" />
<style scoped>
.expression-workspace { min-width:0 }
.expression-workspace__heading-tools { display:flex; align-items:center; justify-content:flex-end; gap:4px; min-width:0 }
.expression-workspace__copy-feedback { margin:4px 0; color:var(--ink-3); font-size:12px }
.expression-workspace__copy-feedback.is-error { color:var(--danger,#ff4d4f) }
.expression-workspace__stable { position:static; width:100%; max-width:none; max-height:none; margin:0; padding:0; border:0; background:transparent; color:inherit; overflow:visible }
.expression-workspace__stable.is-expanded { position:fixed; inset:0; width:min(1040px,calc(100vw - 32px)); max-height:calc(100vh - 48px); margin:auto; padding:20px 24px; overflow:visible; border-radius:8px; background:var(--bg); color:var(--ink-1); box-shadow:0 12px 48px #0003; box-sizing:border-box }
.expression-workspace__stable.is-expanded { --expression-editor-max-height:calc(100vh - 216px) }
.expression-workspace__stable::backdrop { background:#0006 }
.expression-workspace__modal-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:14px; font-size:14px }
.expression-workspace__modal-heading strong { font-weight:500 }
.expression-workspace__modal-heading :deep(.ant-btn) { color:var(--ink-3) }
.expression-workspace__heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:6px; font-size:12px; line-height:22px; color:var(--ink-3) }
.expression-workspace__heading :deep(.ant-btn) { display:inline-flex; align-items:center; gap:5px; color:var(--ink-3); font-size:12px; padding:0 4px; height:24px }
.expression-workspace__heading :deep(.ant-btn:hover) { color:var(--accent) }
.expression-workspace__content { min-width:0; color:var(--ink-1); font-family:inherit }
.expression-workspace__content.is-expanded.has-data { display:grid; grid-template-columns:minmax(0,1fr) minmax(240px,.48fr); gap:24px; align-items:start }
.expression-workspace__formula { min-width:0 }
.expression-workspace__view { margin-bottom:10px; font-size:12px }
.expression-workspace__data { min-width:0; border-left:1px solid var(--line); padding-left:20px; max-height:65vh; overflow:auto }
.expression-workspace__data h4 { display:flex; align-items:center; gap:6px; margin:0 0 10px; color:var(--ink-2); font-size:13px; line-height:22px; font-weight:500 }
.expression-workspace__data h4>.anticon { font-size:12px; color:var(--ink-3) }
.expression-workspace__data h4 small { margin-left:auto; color:var(--ink-3); font-size:12px; font-weight:400; font-variant-numeric:tabular-nums }
.expression-workspace__row { display:grid; gap:4px; padding:9px 8px; margin:0 -8px; border-radius:5px; outline:none; border-bottom:1px solid var(--line); font-size:13px; line-height:20px }
.expression-workspace__row.is-related,.expression-workspace__row:focus-visible { background:var(--accent-soft); box-shadow:inset 2px 0 var(--accent) }
.expression-workspace__identity { display:flex; align-items:baseline; gap:6px; color:var(--ink-2) }
.expression-workspace__identity>.anticon { font-size:12px; color:var(--expression-reference-ink) }
.expression-workspace__identity>span:not(.anticon) { flex:1; overflow-wrap:anywhere; min-width:0; color:var(--expression-reference-ink,var(--accent)); font-weight:500 }
.expression-workspace__identity>small { flex-shrink:0 }
.expression-workspace__row.is-parameter .anticon { color:var(--expression-parameter-ink) }
.expression-workspace__row.is-parameter .expression-workspace__identity>span:not(.anticon) { color:var(--expression-parameter-ink) }
.expression-workspace__row b { font-size:14px; font-weight:500; color:var(--ink-1); font-variant-numeric:tabular-nums; overflow-wrap:anywhere; padding-left:18px }
.expression-workspace__row small,.expression-workspace__empty { color:var(--ink-3); font-size:12px; font-weight:400 }
.expression-workspace__row>small { padding-left:18px }
.expression-workspace__row>.expression-workspace__source { font-size:11px; line-height:16px }
.expression-workspace__row.is-skipped { opacity:.55 }
.expression-workspace__empty { margin:0; line-height:22px }
@media(max-width:720px) {
  .expression-workspace__content.is-expanded.has-data { grid-template-columns:minmax(0,1fr); gap:16px }
  .expression-workspace__data { border-left:0; border-top:1px solid var(--line); padding:14px 0 0; max-height:32vh }
}
</style>
