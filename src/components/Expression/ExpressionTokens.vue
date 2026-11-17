<template>
  <template v-for="(part,index) in parts" :key="index">
    <a-tooltip v-if="part.token" :title="hint(part)" :trigger="['hover','focus']" :mouse-enter-delay="0.1" :get-popup-container="popupContainer"><span :class="['expression-token',`is-${part.token.kind}`,{'has-meaning':!!part.token.meaning,'is-skipped':part.fact?.state === 'skipped','is-parameter':part.token.node.type === 'reference' && part.token.node.id === 'params','has-value':part.token.kind === 'reference' && part.fact?.state === 'available' && !!part.fact.text}]" :data-expression-reference="part.token.node.type === 'reference' ? referenceKey(part.token.node) : undefined" :tabindex="!compact && part.token.kind === 'reference' ? 0 : undefined">
      <AIcon v-if="part.token.kind === 'reference' || part.token.kind === 'function'" class="expression-token__icon" :type="referenceIcon(part.token,context)" aria-hidden="true" />
      <span class="expression-token__label">{{ substitute && part.token.kind === 'reference' && part.fact?.state === 'available' && part.fact.text ? part.fact.text : part.token.label }}</span><small v-if="part.token.meaning" class="expression-token__code">{{ part.token.meaning }}</small><small v-if="!substitute && part.fact?.text && part.fact.state !== 'skipped'" class="expression-token__value">{{ t('thisReading') }}: {{ part.fact.text }}</small>
    </span></a-tooltip><a-tooltip v-else-if="part.outcome" :title="t(outcomeLabels[part.outcome])" :trigger="['hover','focus']" :mouse-enter-delay="0.1" :get-popup-container="popupContainer"><span :aria-label="t(outcomeLabels[part.outcome])" :class="['expression-outcome is-inline',`is-${part.outcome}`]">{{ t(outcomeText[part.outcome]) }}</span></a-tooltip><template v-else>{{ part.text }}</template>
  </template>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { referenceKey } from './document'
import { referenceIcon, outcomeText, outcomeLabels, type ExpressionPart } from './presentation'
import type { ExpressionEditorContext } from './editor'
import { editorMessages } from './editorMessages'
defineProps<{parts:ExpressionPart[];context:ExpressionEditorContext;compact?:boolean;substitute?:boolean}>()
const {t}=useI18n({useScope:'local',messages:editorMessages})
const popupContainer=(trigger:HTMLElement)=>trigger.closest<HTMLElement>('dialog:modal, [role="dialog"], [role="alertdialog"]') || trigger.ownerDocument.body
function hint(part:ExpressionPart) {
  return [part.fact?.title || part.token?.title,part.fact ? part.fact.state === 'skipped' ? t('notUsed') : part.fact.state === 'available' && part.fact.text ? `${t('thisReading')}: ${part.fact.text}` : t('valueNotRecorded') : undefined].filter(Boolean).join(' · ')
}
</script>
