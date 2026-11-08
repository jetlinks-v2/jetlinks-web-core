<template>
  <template v-for="(part,index) in parts" :key="index">
    <span v-if="part.token" :class="['expression-token',`is-${part.token.kind}`,{'has-meaning':!!part.token.meaning,'is-skipped':part.fact?.state === 'skipped','is-parameter':part.token.node.type === 'reference' && part.token.node.id === 'params','has-value':part.token.kind === 'reference' && part.fact?.state === 'available' && !!part.fact.text}]" :data-expression-reference="part.token.node.type === 'reference' ? referenceKey(part.token.node) : undefined" :tabindex="!compact && part.token.kind === 'reference' ? 0 : undefined" :title="part.fact?.title || part.token.title">
      <AIcon v-if="part.token.kind === 'reference' || part.token.kind === 'function'" class="expression-token__icon" :type="referenceIcon(part.token,context)" aria-hidden="true" />
      <span class="expression-token__label">{{ part.token.label }}</span><small v-if="part.token.meaning" class="expression-token__code">{{ part.token.meaning }}</small><small v-if="part.fact?.text && part.fact.state !== 'skipped'" class="expression-token__value">{{ part.fact.text }}</small>
    </span><span v-else-if="part.outcome" role="img" :aria-label="t(outcomeLabels[part.outcome])" :title="t(outcomeLabels[part.outcome])" :class="['expression-outcome is-inline',`is-${part.outcome}`]"><AIcon :type="outcomeIcons[part.outcome]" aria-hidden="true" /></span><template v-else>{{ part.text }}</template>
  </template>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { referenceKey } from './document'
import { referenceIcon, outcomeIcons, outcomeLabels, type ExpressionPart } from './presentation'
import type { ExpressionEditorContext } from './editor'
import { editorMessages } from './editorMessages'
defineProps<{parts:ExpressionPart[];context:ExpressionEditorContext;compact?:boolean}>()
const {t}=useI18n({useScope:'local',messages:editorMessages})
</script>
