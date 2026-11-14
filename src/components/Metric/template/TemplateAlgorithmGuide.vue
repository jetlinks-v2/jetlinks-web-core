<template>
  <details v-if="model" class="algorithm-guide">
    <summary><AIcon type="QuestionCircleOutlined" />{{ t('algorithmGuide') }}<AIcon class="algorithm-guide__chevron" type="DownOutlined" /></summary>
    <div class="algorithm-guide__content">
      <p v-if="invalid || model.warning" class="algorithm-guide__warning" role="status">{{ invalid ? t('guideInvalid') : model.warning }}</p>
      <template v-else>
        <figure>
          <figcaption><span>{{ t('guideExample') }}</span><small>{{ model.state ? t('guideFragment', { span:model.state.span }) : t('guideSamples') }}</small></figcaption>
          <svg v-if="model.state" viewBox="0 0 320 86" role="img" :aria-label="t('guideDiagram')">
            <g class="algorithm-guide__axis">
              <text v-for="(tick, index) in model.state.ticks" :key="index" :x="tick.x" y="17" :text-anchor="index === 0 ? 'start' : index === model.state.ticks.length - 1 ? 'end' : 'middle'">{{ tick.label }}</text>
            </g>
            <path class="algorithm-guide__axis-line" d="M14 24V66 M306 24V66" />
            <line v-for="(segment, index) in model.state.segments" :key="index" :x1="segment.from" :x2="segment.to" y1="44" y2="44" class="algorithm-guide__band" :class="`is-${segment.kind}`" :style="{ stroke:segment.kind === 'active' ? model.state.labels[0].color : segment.kind === 'inactive' ? model.state.labels[1].color : undefined }" />
            <g class="algorithm-guide__points"><circle v-for="(x, index) in model.state.samples" :key="index" :cx="x" cy="44" r="4" /></g>
          </svg>
          <svg v-else viewBox="0 0 320 116" role="img" :aria-label="t('guideDiagram')">
            <path class="algorithm-guide__axis-line" d="M14 12V88H306" />
            <template v-if="model.kind === 'integral'">
              <polygon v-for="(point, index) in model.samples.slice(0,-1)" :key="index" class="algorithm-guide__area" :points="`${point.x},88 ${point.x},${point.y} ${model.samples[index+1].x},${model.leftIntegral ? point.y : model.samples[index+1].y} ${model.samples[index+1].x},88`" />
            </template>
            <g v-if="model.kind === 'align'" class="algorithm-guide__grid"><line v-for="tick in model.grid" :key="tick.x" :x1="tick.x" :x2="tick.x" y1="14" y2="88" /></g>
            <polyline class="algorithm-guide__line" :points="model.samples.map(point=>`${point.x},${point.y}`).join(' ')" />
            <polyline v-if="model.kind === 'rate'" class="algorithm-guide__highlight" :points="model.samples.slice(-2).map(point=>`${point.x},${point.y}`).join(' ')" />
            <g class="algorithm-guide__points"><circle v-for="(point, index) in model.samples" :key="index" :cx="point.x" :cy="point.y" :r="model.kind === 'hampel' && index === model.samples.length - 1 ? 5 : 3" /></g>
            <g class="algorithm-guide__axis">
              <template v-if="model.kind !== 'spectrum' && model.samples.length <= 6"><text v-for="(point, index) in model.samples" :key="index" :x="point.x" :y="point.y-8" :text-anchor="index === 0 ? 'start' : index === model.samples.length-1 ? 'end' : 'middle'">{{ point.label }}</text></template>
              <text v-if="model.kind === 'rate'" x="306" y="108" text-anchor="end">{{ t('guideLatestPair') }} · Δv / Δt</text>
              <text v-else-if="model.kind === 'difference'" x="160" y="108">Δv</text>
              <template v-else-if="model.kind === 'hampel'"><text x="14" y="108" text-anchor="start">{{ t('guideBaselineLabel') }}</text><text x="306" y="108" text-anchor="end">{{ t('guideCandidateLabel') }}</text></template>
              <template v-else-if="model.grid?.length"><text v-for="(tick,index) in model.grid" :key="tick.x" :x="tick.x" y="108" :text-anchor="index === 0 ? 'start' : index === model.grid.length-1 ? 'end' : 'middle'">{{ tick.label }}</text></template>
              <text v-else x="306" y="108" text-anchor="end">{{ t('guideTime') }} →</text>
            </g>
          </svg>
          <div v-if="model.state" class="algorithm-guide__legend">
            <span v-for="(label,index) in model.state.labels" :key="index" :class="['is-active','is-inactive','is-unknown'][index]">
              <IconValueView v-if="label.icon" :value="label.icon" :size="12" :indicator="true" /><i v-else />{{ label.name }}
            </span>
          </div>
          <ol v-if="model.steps.length" class="algorithm-guide__steps"><li v-for="(step,index) in model.steps" :key="index"><span>{{ step }}</span><AIcon v-if="index < model.steps.length-1" type="ArrowRightOutlined" /></li></ol>
        </figure>
        <dl class="algorithm-guide__facts"><div v-for="(fact,index) in model.facts" :key="index"><dt>{{ fact.name }}</dt><dd>{{ fact.value }}</dd></div></dl>
        <p class="algorithm-guide__note">{{ model.note }}</p>
        <p class="algorithm-guide__hint">{{ t('guideOnlyExample') }}</p>
      </template>
    </div>
  </details>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import IconValueView from '../../IconValue/IconValueView.vue'
import type { MetricCalculatorDescriptor, MetricCalculatorSpec, MetricStateLabel } from '../types'
import { metricMessages } from '../messages'
import { algorithmGuideMessages } from './algorithmGuideMessages'
import { algorithmGuideModel } from './algorithmGuide'

const props = defineProps<{ spec:MetricCalculatorSpec; descriptor?:MetricCalculatorDescriptor; labels:MetricStateLabel[]; invalid?:boolean }>()
const { t, locale } = useI18n({ useScope:'local', messages:{ zh:{...metricMessages.zh,...algorithmGuideMessages.zh}, en:{...metricMessages.en,...algorithmGuideMessages.en} } })
const model = computed(() => algorithmGuideModel(props.spec, props.descriptor, props.labels, String(locale.value), t))
</script>
<style scoped>
.algorithm-guide { margin-top:12px; border-top:1px solid var(--line); color:var(--ink-2); font-size:12px; line-height:1.65; min-width:0 }
.algorithm-guide > summary { display:flex; align-items:center; gap:6px; min-height:32px; cursor:pointer; color:var(--ink-3); list-style:none }
.algorithm-guide > summary::-webkit-details-marker { display:none }
.algorithm-guide > summary:hover,.algorithm-guide > summary:focus-visible { color:var(--accent) }
.algorithm-guide__chevron { margin-left:auto; font-size:10px; transition:transform .15s }
.algorithm-guide[open] .algorithm-guide__chevron { transform:rotate(180deg) }
.algorithm-guide__content { padding-top:4px; overflow-wrap:anywhere }
.algorithm-guide figure { margin:0; padding:10px 8px; background:var(--bg-sunken,#f7f8fa); border-radius:var(--r-2,6px) }
.algorithm-guide figcaption { display:flex; flex-wrap:wrap; justify-content:space-between; gap:2px 8px; margin-bottom:4px; color:var(--ink-3) }
.algorithm-guide figcaption small { font-size:11px }
.algorithm-guide svg { display:block; width:100%; max-width:480px; margin:auto }
.algorithm-guide__axis { font-size:10px; fill:var(--ink-3); text-anchor:middle }
.algorithm-guide__axis-line { stroke:var(--line); stroke-width:1; fill:none }
.algorithm-guide__band { stroke-width:14 }
.algorithm-guide__band.is-active,.algorithm-guide__line { stroke:var(--accent,#1677ff) }
.algorithm-guide__band.is-inactive { stroke:var(--ink-3,#6b7280) }
.algorithm-guide__band.is-unknown { stroke:var(--ink-4,#b8bec8); stroke-dasharray:3 3 }
.algorithm-guide__points { fill:var(--bg-base,#fff); stroke:var(--ink-2); stroke-width:1.5 }
.algorithm-guide__line,.algorithm-guide__highlight { fill:none; stroke-width:1.5; stroke-linejoin:round }
.algorithm-guide__highlight { stroke:var(--accent,#1677ff); stroke-width:4 }
.algorithm-guide__area { fill:var(--accent,#1677ff); fill-opacity:.12; stroke:var(--accent,#1677ff); stroke-opacity:.4; stroke-width:.5 }
.algorithm-guide__grid { stroke:var(--ink-4,#b8bec8); stroke-dasharray:2 3 }
.algorithm-guide__legend { display:flex; flex-wrap:wrap; gap:4px 12px; font-size:11px }
.algorithm-guide__legend > span { display:inline-flex; align-items:center; gap:4px }
.algorithm-guide__legend i { width:10px; height:6px; border-radius:2px; background:var(--ink-3,#6b7280) }
.algorithm-guide__legend .is-active i { background:var(--accent,#1677ff) }
.algorithm-guide__legend .is-unknown i { background:repeating-linear-gradient(120deg,var(--ink-4,#b8bec8) 0 2px,transparent 2px 4px) }
.algorithm-guide__steps { display:flex; flex-wrap:wrap; gap:4px 6px; list-style:none; margin:8px 0 0; padding:0; font-size:11px }
.algorithm-guide__steps li { display:inline-flex; align-items:center; gap:6px }
.algorithm-guide__steps li > span { border:1px solid var(--line); border-radius:4px; padding:1px 5px; background:var(--bg-base,#fff) }
.algorithm-guide__steps .anticon { color:var(--ink-4); font-size:10px }
.algorithm-guide__facts { margin:10px 0 0 }
.algorithm-guide__facts > div { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.4fr); gap:12px; padding:2px 0 }
.algorithm-guide dt { color:var(--ink-3) }
.algorithm-guide dd { margin:0; text-align:right }
.algorithm-guide__note { margin:8px 0 0 }
.algorithm-guide__hint { margin:6px 0 0; color:var(--ink-3); font-size:11px }
.algorithm-guide__warning { margin:0; color:var(--warning,#ad6800) }
</style>
