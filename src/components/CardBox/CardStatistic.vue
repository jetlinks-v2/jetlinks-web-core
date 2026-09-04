<template>
  <CardShell
    :active="active"
    :disabled="disabled"
    :bordered="bordered"
    :background-opacity="backgroundOpacity"
    :aria-label="data.label"
    @click="handleClick"
  >
    <article class="card-statistic">
      <div class="card-statistic__main">
        <div class="card-statistic__value-wrap">
          <span class="card-statistic__label">
            <slot name="label" :data="data">{{ data.label }}</slot>
          </span>
          <strong class="card-statistic__value">
            <slot name="value" :data="data">
              {{ data.value }}<small v-if="data.unit">{{ data.unit }}</small>
            </slot>
          </strong>
        </div>
        <slot name="chart" :data="data">
          <span class="card-statistic__chart" :style="chartStyle" aria-hidden="true">
            <span />
          </span>
        </slot>
      </div>

      <div v-if="$slots.legend || data.segments?.length" class="card-statistic__legend">
        <slot name="legend" :data="data">
          <span
            v-for="(segment, index) in data.segments"
            :key="segment.key ?? index"
            class="card-statistic__legend-item"
            :style="getLegendStyle(segment.tone)"
          >
            <i />
            <span>{{ segment.label }}</span>
            <strong>{{ segment.value }}</strong>
          </span>
        </slot>
      </div>
    </article>
  </CardShell>
</template>

<script setup lang="ts" name="CardStatistic">
import { computed, type CSSProperties, type PropType } from 'vue'
import { cardAppearanceProps } from './appearance'
import CardShell from './CardShell.vue'
import type { CardStatisticData, CardStatisticSegment, CardTone } from './types'

const props = defineProps({
  ...cardAppearanceProps,
  data: {
    type: Object as PropType<CardStatisticData>,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (event: 'click', data: CardStatisticData, nativeEvent: MouseEvent | KeyboardEvent): void
}>()

const toneColors: Record<CardTone, string> = {
  default: 'var(--card-tone-default)',
  info: 'var(--card-tone-info)',
  success: 'var(--card-tone-success)',
  warning: 'var(--card-tone-warning)',
  error: 'var(--card-tone-error)',
}

const getToneColor = (tone: CardTone = 'info') => toneColors[tone]

// 环图只表达各 segment 的相对占比，卡片主值仍由 data.value 独立控制。
const chartStyle = computed<CSSProperties>(() => {
  const segments = (props.data.segments ?? []).filter(item => item.value > 0)
  const total = segments.reduce((sum, item) => sum + item.value, 0)
  if (!total) return { background: 'var(--line)' }

  let start = 0
  const stops = segments.map(segment => {
    const end = start + (segment.value / total) * 100
    const stop = `${getToneColor(segment.tone)} ${start}% ${end}%`
    start = end
    return stop
  })

  return { background: `conic-gradient(${stops.join(', ')})` }
})

const getLegendStyle = (tone: CardStatisticSegment['tone']): CSSProperties => ({
  '--card-statistic-segment-color': getToneColor(tone),
} as CSSProperties)

const handleClick = (event: MouseEvent | KeyboardEvent) => {
  emit('click', props.data, event)
}
</script>

<style scoped>
.card-statistic__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5);
  gap: var(--space-4);
}

.card-statistic__value-wrap {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-2);
}

.card-statistic__label {
  overflow: hidden;
  color: var(--ink-2);
  font-size: var(--fs-body);
  line-height: var(--lh-normal);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-statistic__value {
  color: var(--ink-1);
  font-size: var(--fs-28);
  font-weight: 600;
  line-height: var(--lh-tight);
}

.card-statistic__value small {
  margin-left: var(--space-2);
  font-size: var(--fs-body);
  font-weight: 500;
}

.card-statistic__chart {
  display: inline-flex;
  width: var(--card-shell-chart-size);
  height: var(--card-shell-chart-size);
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-pill);
}

.card-statistic__chart > span {
  width: calc(var(--card-shell-chart-size) - var(--card-shell-chart-stroke) * 2);
  height: calc(var(--card-shell-chart-size) - var(--card-shell-chart-stroke) * 2);
  border-radius: var(--r-pill);
  background: var(--card-box-background);
}

.card-statistic__legend {
  display: flex;
  flex-wrap: wrap;
  padding: var(--space-3) var(--space-5);
  border-top: var(--jet-theme-stroke-width) solid var(--line);
  gap: var(--space-4);
}

.card-statistic__legend-item {
  display: inline-flex;
  align-items: center;
  color: var(--ink-2);
  font-size: var(--fs-body);
  gap: var(--space-1);
}

.card-statistic__legend-item i {
  width: var(--space-2);
  height: var(--space-2);
  flex: none;
  border-radius: var(--r-pill);
  background: var(--card-statistic-segment-color);
}

.card-statistic__legend-item strong {
  color: var(--card-statistic-segment-color);
  font-weight: 600;
}
</style>
