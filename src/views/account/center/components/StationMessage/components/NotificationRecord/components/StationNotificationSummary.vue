<template>
  <article class="notice-summary">
    <header v-if="summary.name || summary.time || summary.relieved !== undefined" class="notice-summary__head">
      <div v-if="summary.relieved !== undefined" class="notice-summary__badges">
        <StatusTag
          :text="$t(summary.relieved ? 'components.ViewDialog.alarm.relieved' : 'components.ViewDialog.alarm.triggered')"
          :status="summary.relieved ? 'success' : 'error'"
        />
        <StatusTag v-if="levelLabel || summary.level" :text="levelLabel || $t('components.ViewDialog.alarm.numericLevel', { level: summary.level })" :status="levelStatus" />
      </div>
      <h3 v-if="summary.name" class="notice-summary__name">{{ summary.name }}</h3>
      <div v-if="summary.time" class="notice-summary__time">
        <span>{{ $t(summary.timeLabelKey) }}</span>
        <span>{{ formatTime(summary.time) }}</span>
      </div>
    </header>

    <section v-for="group in groups" :key="group.kind" :class="`notice-summary__${group.kind}`">
      <h4>{{ $t(group.labelKey) }}</h4>
      <dl>
        <div v-for="field in group.fields" :key="field.key" class="notice-summary__row" :class="{ 'notice-summary__row--wide': field.wide }">
          <dt>{{ $t(field.labelKey) }}</dt>
          <dd :class="{ 'notice-summary__mono': field.format === 'mono' }">
            {{ field.format === 'time' ? formatTime(Number(field.value)) : field.value }}
          </dd>
        </div>
      </dl>
    </section>
    <section v-if="summary.description" class="notice-summary__description">
      <h4>{{ $t('components.ViewDialog.alarm.description') }}</h4>
      <p>{{ summary.description }}</p>
    </section>
    <a-empty v-if="summary.kind === 'sceneExecution' && !summary.name && !summary.time && !summary.fields.length" />
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import StatusTag from '@jetlinks-web-core/components/StatusTag/index.vue'
import type { StationSummary } from './alarmNotificationSummary'

const props = defineProps<{
  summary: StationSummary
  levels: Array<{ level: number; title: string }>
}>()
const levelLabel = computed(() => props.levels.find(item => item.level === props.summary.level)?.title || props.summary.levelText)
const levelStatus = computed(() => props.summary.level === 1 ? 'error' : (props.summary.level || 4) <= 3 ? 'warning' : 'info')
const groups = computed(() => {
  const { kind, relieved, reasons, fields } = props.summary
  return [
    { kind: 'reason', labelKey: relieved ? 'components.ViewDialog.alarm.recoveryInfo' : 'components.ViewDialog.alarm.reason', fields: reasons },
    { kind: 'target', labelKey: kind === 'sceneExecution' ? 'components.ViewDialog.alarm.sceneInfo'
      : kind === 'ai' ? 'components.ViewDialog.alarm.videoSource' : 'components.ViewDialog.alarm.target', fields },
  ].filter(group => group.fields.length)
})
const formatTime = (value: number) => dayjs(value).format('YYYY-MM-DD HH:mm:ss')
</script>

<style lang="less" scoped>
.notice-summary {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  color: var(--text-color);
  font-size: var(--fs-14);
  container-type: inline-size;

  h3, h4, dl, dt, dd, p { margin: 0; }
  h4 { margin-bottom: var(--space-2); color: inherit; font-size: inherit; font-weight: 500; }
  dd, p { min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
  dt { color: var(--text-color-secondary); white-space: nowrap; }
  dl { display: grid; gap: var(--space-2) var(--space-5); }

  &__head { display: grid; gap: var(--space-2); }
  &__badges, &__time { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  &__name { color: inherit; font-size: var(--fs-18); font-weight: 500; overflow-wrap: anywhere; }
  &__time { color: var(--text-color-secondary); font-size: var(--fs-13); font-variant-numeric: tabular-nums; }
  &__reason { padding: var(--space-3) var(--space-4); border-radius: var(--jet-theme-radius); background: var(--bg-2); }
  &__target, &__description { padding-top: var(--space-3); border-top: 1px solid var(--line); }
  &__target dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  &__row { display: grid; grid-template-columns: minmax(5.5em, max-content) minmax(0, 1fr); align-items: baseline; gap: var(--space-2); }
  &__row--wide { grid-column: 1 / -1; }
  &__mono { font-family: var(--font-mono); font-size: var(--fs-13); }
}
@container (max-width: 32rem) {
  .notice-summary__target dl { grid-template-columns: minmax(0, 1fr); }
}
</style>
