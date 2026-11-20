<template>
  <div class="alarm-summary">
    <div class="alarm-summary__head">
      <div class="alarm-summary__title">
        <StatusTag v-if="levelLabel" :text="levelLabel" :status="levelStatus" />
        <StatusTag
          :text="$t(summary.relieved ? 'components.ViewDialog.alarm.relieved' : 'components.ViewDialog.alarm.triggered')"
          :status="summary.relieved ? 'success' : 'error'"
        />
        <span v-if="summary.name" class="alarm-summary__name">{{ summary.name }}</span>
      </div>
      <div v-if="summary.time" class="alarm-summary__time">
        <span>{{ $t('components.ViewDialog.alarm.time') }}</span>
        <span>{{ formatTime(summary.time) }}</span>
      </div>
    </div>

    <div v-if="summary.reasons.length" class="alarm-summary__reason">
      <div class="alarm-summary__reason-title">{{ $t('components.ViewDialog.alarm.reason') }}</div>
      <dl class="alarm-summary__reason-list">
        <div v-for="row in summary.reasons" :key="row.key" class="alarm-summary__item">
          <dt>{{ $t(row.labelKey) }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </div>

    <dl v-if="summary.fields.length" class="alarm-summary__fields">
      <div
        v-for="field in summary.fields"
        :key="field.key"
        class="alarm-summary__item"
        :class="{ 'alarm-summary__item--wide': field.wide }"
      >
        <dt>{{ $t(field.labelKey) }}</dt>
        <dd v-if="field.wide">{{ field.value }}</dd>
        <dd v-else :class="{ 'alarm-summary__mono': field.format === 'mono' }">
          <j-ellipsis>{{ field.format === 'time' ? formatTime(Number(field.value)) : field.value }}</j-ellipsis>
        </dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import StatusTag from '@jetlinks-web-core/components/StatusTag/index.vue'
import { buildAlarmNotificationSummary } from './alarmNotificationSummary'

type LevelStatus = 'error' | 'warning' | 'info'

const props = defineProps<{
  /** 通知记录，用于读取 topicProvider 与 notifyTime */
  record: Record<string, any>
  /** 已解析的通知详情 */
  detail: Record<string, any>
  /** 告警级别字典，来自 /alarm/config/default/level */
  levels: Array<{ level: number; title: string }>
}>()

const summary = computed(() => buildAlarmNotificationSummary(props.record, props.detail))

const levelLabel = computed(() => {
  const level = summary.value.level
  return props.levels.find(item => item.level === level)?.title || summary.value.levelText
})

// 与告警记录页一致：1 级为严重，2~3 级为警示，其余为提示
const levelStatus = computed<LevelStatus>(() => {
  const level = summary.value.level
  if (level === 1) return 'error'
  return (level || 4) <= 3 ? 'warning' : 'info'
})

const formatTime = (value: number) => dayjs(value).format('YYYY-MM-DD HH:mm:ss')
</script>

<style lang="less" scoped>
.alarm-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
  color: var(--text-color);
  font-size: var(--fs-14);

  dl,
  dd {
    margin: 0;
  }

  dt {
    flex: none;
    min-width: 4.5rem;
    color: var(--text-color-secondary);
    font-weight: 400;
  }

  dd {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  &__head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  &__title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  &__name {
    min-width: 0;
    font-size: var(--fs-16);
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  &__time {
    display: flex;
    gap: var(--space-2);
    color: var(--text-color-secondary);
    font-size: var(--fs-13);
  }

  &__reason {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--jet-theme-radius);
    background: var(--bg-2);
  }

  &__reason-title {
    font-weight: 500;
  }

  &__reason-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  &__fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3) var(--space-6);
  }

  &__item {
    display: flex;
    gap: var(--space-3);
    min-width: 0;

    &--wide {
      grid-column: 1 / -1;
    }
  }

  &__mono {
    font-family: var(--font-mono);
    font-size: var(--fs-13);
  }
}
</style>
