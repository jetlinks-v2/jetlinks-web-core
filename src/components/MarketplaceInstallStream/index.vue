<template>
  <div
    v-if="displayItems.length || activeLog"
    class="market-install-stream"
    :style="{ maxHeight }"
  >
    <template
      v-for="item in displayItems"
      :key="item.id"
    >
      <a-collapse
        v-if="item.kind === 'logs'"
        ghost
        class="market-install-stream__logs"
      >
        <a-collapse-panel
          :key="item.id"
          :header="$t('components.MarketplaceInstallStream.viewLogs', { count: item.logs.length })"
        >
          <div class="market-install-stream__log-list">
            <p
              v-for="(log, index) in item.logs"
              :key="index"
            >
              {{ log.message }}
              <a-tooltip
                v-if="log.extra !== undefined"
                :title="formatExtra(log.extra)"
              >
                <AIcon
                  type="ExclamationCircleOutlined"
                  class="market-install-stream__extra"
                />
              </a-tooltip>
            </p>
          </div>
        </a-collapse-panel>
      </a-collapse>

      <div
        v-else
        class="market-install-stream__row"
        :class="`is-${item.row.type}`"
      >
        <AIcon :type="getFixedIcon(item)" />
        <span>{{ item.row.message }}</span>
        <a-tooltip
          v-if="item.row.extra !== undefined"
          :title="formatExtra(item.row.extra)"
        >
          <AIcon
            type="ExclamationCircleOutlined"
            class="market-install-stream__extra"
          />
        </a-tooltip>
      </div>
    </template>

    <div
      v-if="activeLog"
      class="market-install-stream__live-log"
    >
      <AIcon type="ConsoleSqlOutlined" />
      <span>{{ activeLog.message }}</span>
      <a-tooltip
        v-if="activeLog.extra !== undefined"
        :title="formatExtra(activeLog.extra)"
      >
        <AIcon
          type="ExclamationCircleOutlined"
          class="market-install-stream__extra"
        />
      </a-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MarketplaceInstallStreamRow, MarketplaceInstallStreamRowType } from './types'

/** 将连续日志折叠展示，保证执行态最后一条日志仍可实时查看。 */

type FixedRowType = Exclude<MarketplaceInstallStreamRowType, 'log'>

type FixedMarketplaceInstallStreamRow = MarketplaceInstallStreamRow & {
  type: FixedRowType
}

type FixedDisplayItem = {
  id: string
  kind: 'fixed'
  row: FixedMarketplaceInstallStreamRow
  active: boolean
}

type LogsDisplayItem = {
  id: string
  kind: 'logs'
  logs: MarketplaceInstallStreamRow[]
}

const props = withDefaults(defineProps<{
  rows?: MarketplaceInstallStreamRow[]
  finished?: boolean
  maxHeight?: string
}>(), {
  rows: () => [],
  finished: false,
  maxHeight: '8.5rem',
})

const iconMap: Record<FixedRowType, string> = {
  progress: 'CheckCircleOutlined',
  success: 'CheckCircleOutlined',
  error: 'CloseCircleOutlined',
}

const displayState = computed(() => {
  const items: Array<FixedDisplayItem | LogsDisplayItem> = []
  let pendingLogs: MarketplaceInstallStreamRow[] = []
  let activeLog: MarketplaceInstallStreamRow | undefined

  const flushLogs = () => {
    if (!pendingLogs.length) return
    items.push({
      id: `logs-${items.length}-${pendingLogs.length}`,
      kind: 'logs',
      logs: [...pendingLogs],
    })
    pendingLogs = []
    activeLog = undefined
  }

  props.rows.forEach((row, index) => {
    if (row.type === 'log') {
      pendingLogs.push(row)
      activeLog = row
      return
    }

    flushLogs()
    items.push({
      id: `fixed-${index}`,
      kind: 'fixed',
      row: row as FixedMarketplaceInstallStreamRow,
      active: false,
    })
  })

  if (props.finished) flushLogs()
  const latestFixed = [...items].reverse().find(item => item.kind === 'fixed')
  if (latestFixed?.kind === 'fixed') {
    latestFixed.active = !props.finished && !activeLog
  }

  return { items, activeLog }
})

const displayItems = computed(() => displayState.value.items)
const activeLog = computed(() => displayState.value.activeLog)

function formatExtra(extra: unknown) {
  if (extra == null) return ''
  if (typeof extra === 'string') return extra
  try {
    return JSON.stringify(extra, null, 2)
  } catch {
    return String(extra)
  }
}

function getFixedIcon(item: FixedDisplayItem) {
  if (item.row.type === 'progress' && item.active) return 'LoadingOutlined'
  return iconMap[item.row.type]
}
</script>

<style scoped>
.market-install-stream {
  display: grid;
  gap: 0.375rem;
  margin: 0.5rem 0 0.75rem;
  overflow: auto;
}

.market-install-stream__row,
.market-install-stream__live-log {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 1.5rem;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.45;
}

.market-install-stream__row.is-progress :deep(svg) {
  color: var(--jet-theme-primary);
}

.market-install-stream__row.is-success,
.market-install-stream__row.is-success :deep(svg) {
  color: var(--jet-theme-success);
}

.market-install-stream__row.is-error,
.market-install-stream__row.is-error :deep(svg) {
  color: var(--jet-theme-error);
}

.market-install-stream__live-log {
  color: var(--jet-theme-text-disabled);
}

.market-install-stream__logs {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.market-install-stream__logs :deep(.ant-collapse-header) {
  align-items: center;
  padding: 0;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.market-install-stream__logs :deep(.ant-collapse-content-box) {
  padding: 0.375rem 0 0;
}

.market-install-stream__log-list {
  display: grid;
  gap: 0.25rem;
  padding-left: 1rem;
}

.market-install-stream__log-list p {
  margin: 0;
  color: var(--jet-theme-text-disabled);
  line-height: 1.45;
}

.market-install-stream__extra {
  flex-shrink: 0;
  color: var(--jet-theme-text-disabled);
  cursor: help;
}
</style>
