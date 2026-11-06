<template>
  <span v-if="!semanticOnly || story" ref="viewport" class="template-formula" :style="{ fontSize: `${fontSize}px` }" :class="{ 'template-formula--compact': compact, 'template-formula--story':!!story, 'template-formula--source':!story && !markup }" :role="story ? 'group' : 'math'" :aria-label="story?.label || label" :title="story?.label || label">
    <span ref="content" class="template-formula__content">
      <span v-if="story" class="template-formula__story">
        <template v-if="!compact && story.condition"><span><small>{{ t('semanticWhen') }}</small>{{ story.condition }}</span><span><small>{{ t('semanticTake') }}</small>{{ story.yes }}</span><span><small>{{ t('semanticOtherwise') }}</small>{{ story.no }}</span></template>
        <span v-else>{{ story.label }}</span>
      </span>
      <span v-else-if="markup" class="template-formula__math" aria-hidden="true" v-html="markup" />
      <span v-else class="template-formula__source">{{ label }}</span>
      <a-popover v-if="story && !compact" trigger="click" placement="left">
        <template #content><code class="template-formula__raw">{{ expression }}</code></template>
        <button type="button" class="template-formula__inspect"><AIcon type="CodeOutlined" />{{ t('semanticViewExpression') }}</button>
      </a-popover>
    </span>
  </span>
</template>
<script setup lang="ts">
import { useFormulaDisplay } from './useFormulaDisplay'
import { ref, watch } from 'vue'
import { useContentFit } from '../../../../hooks/useContentFit'
import type { TemplateRule } from '../designer'
import type { MetricCalculatorDescriptor, MetricTemplate } from '../../types'

const props = defineProps<{ template: MetricTemplate; rule: TemplateRule; expression: string; calculators?: MetricCalculatorDescriptor[]; compact?: boolean; semanticOnly?: boolean }>()
const { label, markup, story, t } = useFormulaDisplay(props)
const viewport = ref<HTMLElement>(), content = ref<HTMLElement>()
const { fontSize, refresh } = useContentFit({ viewport, content, minSize:() => props.compact ? 11 : 14, maxSize:() => props.compact ? 12 : 18 })
watch([label, markup, story], refresh, { flush:'post' })
</script>
<style scoped>
.template-formula { display:inline-flex; align-items:center; width:100%; max-width:100%; min-width:0; height:64px; overflow:auto; vertical-align:middle; color:inherit; box-sizing:border-box; scrollbar-width:thin }
.template-formula--compact { height:30px }
.template-formula__content { display:block; flex:none; width:max-content }
.template-formula__math { display:block; width:max-content; padding:2px }
.template-formula--source .template-formula__content { width:100% }
.template-formula__source { display:block; white-space:pre-wrap; overflow-wrap:anywhere; font-size:12px }
.template-formula--story { height:auto; min-height:64px; font-size:13px !important; overflow:visible }
.template-formula--story .template-formula__content { width:100%; min-width:0 }
.template-formula__story { display:grid; gap:6px; line-height:1.65; overflow-wrap:anywhere }
.template-formula__story>span { display:flex; align-items:baseline; gap:8px }
.template-formula__story small { color:var(--ink-3); font-size:11px; min-width:34px; flex:none }
.template-formula__inspect { display:inline-flex; align-items:center; gap:4px; border:0; background:none; color:var(--ink-3); font-size:11px; padding:5px 0 0; cursor:pointer }
.template-formula__inspect:focus-visible { outline:2px solid var(--accent) }
.template-formula__raw { display:block; max-width:min(480px,80vw); white-space:pre-wrap; overflow-wrap:anywhere; font-size:12px }
.template-formula--compact.template-formula--story { min-height:0; height:30px; overflow:hidden; font-size:11px !important }
.template-formula--compact .template-formula__story,.template-formula--compact .template-formula__source { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; line-height:15px; overflow:hidden }
</style>
