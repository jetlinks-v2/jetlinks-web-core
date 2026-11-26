<template>
  <div v-if="!detail?.history.length" class="trend-empty">暂无趋势</div>
  <svg v-else class="point-trend" :class="{ 'is-compact': compact }" viewBox="0 0 240 68" preserveAspectRatio="none" role="img" :aria-label="label">
    <line x1="2" x2="238" :y1="limitY" :y2="limitY" class="trend-limit" />
    <polyline :points="points" class="trend-line" :class="{ 'is-attention': attention }" />
    <circle cx="238" :cy="lastY" r="2.5" :class="attention ? 'trend-dot--attention' : 'trend-dot'" />
  </svg>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { DeviceDetail } from './data.ts'
const props = defineProps<{ detail?: DeviceDetail; attention?: boolean; compact?: boolean }>()
const bounds = computed(() => {
  const values = props.detail ? [...props.detail.history, props.detail.lower, props.detail.upper] : [0, 1]
  const min = Math.min(...values), max = Math.max(...values)
  return { min, span: Math.max(max - min, 0.1) }
})
const y = (value: number) => 60 - (value - bounds.value.min) / bounds.value.span * 52
const points = computed(() => (props.detail?.history ?? []).map((value, i, data) => [2 + i * 236 / Math.max(data.length - 1, 1), y(value)].join(',')).join(' '))
const lastY = computed(() => y(props.detail?.history.at(-1) ?? 0))
const limitY = computed(() => y(props.detail && props.detail.value !== undefined && props.detail.value < props.detail.lower ? props.detail.lower : props.detail?.upper ?? 1))
const label = computed(() => '近30分钟趋势，当前' + (props.detail?.value ?? '无数据') + (props.detail?.unit ?? '') + '；虚线为参考界限')
</script>
<style scoped>
.point-trend { display:block; width:100%; height:68px; overflow:visible; }
.point-trend.is-compact { height:30px; }
.trend-line { fill:none; stroke:var(--accent); stroke-width:2; vector-effect:non-scaling-stroke; }
.trend-line.is-attention { stroke:var(--jet-theme-warning); }
.trend-limit { stroke:var(--line-strong,var(--line)); stroke-width:1; stroke-dasharray:4 4; vector-effect:non-scaling-stroke; }
.trend-dot { fill:var(--accent); }
.trend-dot--attention { fill:var(--jet-theme-warning); }
.trend-empty { display:flex; align-items:center; min-height:30px; font-size:var(--fs-12); color:var(--ink-2); }
</style>
