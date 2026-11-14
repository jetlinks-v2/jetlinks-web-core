<template>
  <ExpressionWorkspace :node="node" :context="context" :editable="!context.disabled">
  <section class="expression-editor">
    <div class="expression-composer" :class="{'is-disabled':context.disabled}">
      <ExpressionView v-if="!ready && !empty" :node="node" :context="context" />
      <div ref="host" :hidden="!ready" />
    </div>
    <div class="expression-editor__toolbar">
      <a-button class="expression-editor__insert" type="text" size="small" :disabled="context.disabled || !ready" @mousedown.prevent @click="complete('reference')"><AIcon type="DatabaseOutlined" />{{ t('insertData') }}</a-button>
      <a-button class="expression-editor__insert" type="text" size="small" :disabled="context.disabled || !ready" @mousedown.prevent @click="complete('function')"><AIcon type="FunctionOutlined" />{{ t('call') }}</a-button>
      <span class="expression-editor__spacer" />
      <a-button type="text" size="small" :disabled="context.disabled || !ready" :aria-label="t('undo')" @mousedown.prevent @click="undo"><AIcon type="UndoOutlined" /></a-button>
      <a-button type="text" size="small" :disabled="context.disabled || !ready" :aria-label="t('redo')" @mousedown.prevent @click="redo"><AIcon type="RedoOutlined" /></a-button>
      <a-button type="text" size="small" :disabled="context.disabled || !ready || !!error" :aria-label="t('format')" @mousedown.prevent @click="format"><AIcon type="AlignLeftOutlined" /></a-button>
      <slot name="tools" :invalid="!!error" />
    </div>
    <small v-if="error" class="expression-editor__error" role="alert">{{ t(error.key,{name:error.name}) }}</small>
    <small v-else-if="signature" class="expression-editor__signature">{{ signature }}</small>
    <a-button v-if="loadError" type="link" size="small" @click="retry">{{ t('editorLoadFailed') }} · {{ t('retry') }}</a-button>
  </section>
  </ExpressionWorkspace>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ExpressionNode } from './types'
import type { ExpressionEditorContext } from './editor'
import ExpressionView from './ExpressionView.vue'
import ExpressionWorkspace from './ExpressionWorkspace.vue'
import { useFormulaEditor } from './useFormulaEditor'
import { editorMessages } from './editorMessages'
const props=defineProps<{node:ExpressionNode;context:ExpressionEditorContext;empty?:boolean}>()
const emit=defineEmits<{(event:'change',value:ExpressionNode):void;(event:'invalid',value:boolean):void}>()
const {t}=useI18n({useScope:'local',messages:editorMessages})
const {host,ready,loadError,error,signature,retry,undo,redo,complete,format}=useFormulaEditor(()=>props.node,()=>props.context,t,value=>emit('change',value),value=>emit('invalid',value),()=>!!props.empty)
</script>
<style src="./expression.css" />
<style scoped>
.expression-editor { display:grid; gap:8px; min-width:0; padding:12px 12px 8px; border:1px solid var(--line); background:var(--bg); border-radius:6px; transition:border-color .15s,box-shadow .15s }
.expression-editor:focus-within { border-color:color-mix(in srgb,var(--accent) 65%,var(--line)); box-shadow:0 0 0 2px var(--accent-soft) }
.expression-editor__toolbar { display:flex; align-items:center; gap:2px; color:var(--ink-3); border-top:1px solid var(--line); padding-top:4px }
.expression-editor__toolbar :deep(.ant-btn) { color:var(--ink-3); font-size:12px; padding:0 5px; height:25px; display:inline-flex; align-items:center; gap:4px }
.expression-editor__toolbar :deep(.ant-btn:hover) { color:var(--accent) }
.expression-editor__toolbar :deep(.ant-btn.expression-editor__insert:not(:disabled)) { color:var(--ink-2); background:color-mix(in srgb,var(--bg-sunken,var(--bg-secondary)) 65%,var(--bg)); border-radius:5px; padding:0 7px }
.expression-editor__toolbar :deep(.expression-editor__insert .anticon) { color:var(--accent) }
.expression-editor__toolbar :deep(.ant-btn.expression-editor__insert:not(:disabled):hover) { color:var(--accent); background:var(--accent-soft) }
.expression-editor__toolbar :deep(.ant-btn[aria-label]) { opacity:.5 }
.expression-editor:hover .expression-editor__toolbar :deep(.ant-btn[aria-label]),.expression-editor:focus-within .expression-editor__toolbar :deep(.ant-btn[aria-label]) { opacity:1 }
.expression-editor__spacer { flex:1 }
.expression-editor__error { color:var(--danger,#d4380d); font-size:12px; padding:0 7px }
.expression-editor__signature { color:var(--ink-3); font-size:12px; padding:0 7px; line-height:1.6 }
</style>
