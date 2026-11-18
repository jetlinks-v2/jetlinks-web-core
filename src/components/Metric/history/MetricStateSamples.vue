<template>
  <div class="state-samples">
    <div class="state-samples__head"><span :title="t('stateSampleHint')">{{ t('stateSamples', { count:samples.length }) }}</span><span v-if="inspected">{{ label(inspected) }}</span></div>
    <div class="state-samples__strip" role="img" :aria-label="t('stateSampleHint')" @pointermove="inspect" @pointerleave="index = undefined">
      <span v-for="entry in samples" :key="entry.key" :style="{ left:`clamp(2px, ${samplePosition(entry)}%, calc(100% - 2px))`, background:stateAppearance(entry.state, labels).color }" :class="{ 'is-unknown':entry.state === null }" :title="`${label(entry)} · ${time(entry.time)}`" />
      <span v-if="inspected" class="state-samples__tooltip" :style="{ left:`${position}%`, transform:`translateX(-${position}%)` }">{{ label(inspected) }} · {{ time(inspected.time) }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { metricMessages } from '../messages'
import { recordedStateLabel, stateAppearance } from '../stateIntervals'
import type { MetricStateLabel } from '../types'
import type { HistoryEntry } from './projection'
import { historyBounds, STATE_SAMPLE_LIMIT } from './projection'
const props = defineProps<{ entries:HistoryEntry[]; labels?:MetricStateLabel[]; bounds?:[number,number] }>()
const { t, locale } = useI18n({ useScope:'local', messages:metricMessages })
// A tile is a recorded sample, not inferred uptime. Bound the DOM independently of history query size.
const samples = computed(() => props.entries.filter((entry):entry is Extract<HistoryEntry,{ kind:'record' }> => entry.kind === 'record').slice(-STATE_SAMPLE_LIMIT))
const axis = computed(() => historyBounds(samples.value,props.bounds))
const index = ref<number>()
const inspected = computed(() => index.value === undefined ? undefined : samples.value[index.value])
const samplePosition = (entry:HistoryEntry) => axis.value ? (entry.time-axis.value[0]) / (axis.value[1]-axis.value[0]) * 100 : 50
const position = computed(() => inspected.value ? samplePosition(inspected.value) : 0)
const label = (entry:Extract<HistoryEntry,{ kind:'record' }>) => recordedStateLabel(entry.state,props.labels || [],String(locale.value),t)
const time = (value:number) => new Date(value).toLocaleString(String(locale.value),{ month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit' })
function inspect(event:PointerEvent) {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (!bounds.width || !axis.value || !samples.value.length) { index.value=undefined;return }
  const time = axis.value[0]+Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width))*(axis.value[1]-axis.value[0])
  // 悬停寻找最近的真实采样；不等间隔的记录不能按数组下标平分时间。
  index.value = samples.value.reduce((nearest,entry,index) => Math.abs(entry.time-time) < Math.abs(samples.value[nearest].time-time) ? index : nearest,0)
}
</script>
<style scoped>
.state-samples { min-width:0 }
.state-samples__head { display:flex; justify-content:space-between; align-items:center; gap:8px; min-height:20px; color:var(--ink-3); font-size:11px }
.state-samples__head>span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.state-samples__strip { position:relative; height:24px; border-bottom:1px solid var(--line) }
.state-samples__strip>span:not(.state-samples__tooltip) { position:absolute; top:4px; width:4px; height:16px; transform:translateX(-50%); border-radius:1px; opacity:.85 }
.state-samples__strip>span.is-unknown { background:repeating-linear-gradient(135deg,var(--line),var(--line) 2px,var(--bg-2) 2px,var(--bg-2) 4px)!important }
.state-samples__strip:hover>span:not(.state-samples__tooltip) { opacity:1 }
.state-samples__tooltip { position:absolute; top:-24px; padding:3px 8px; white-space:nowrap; pointer-events:none; border:1px solid var(--line); border-radius:var(--r-2,6px); background:var(--bg); color:var(--ink-2); font-size:11px; z-index:1 }
</style>
