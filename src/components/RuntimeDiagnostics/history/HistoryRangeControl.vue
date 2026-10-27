<template>
  <a-popover v-model:open="open" trigger="click" placement="bottomRight">
    <template #content>
      <div class="history-range-panel">
        <div class="history-range-presets"><a-button v-for="seconds in durations" :key="seconds" size="small" :type="preset === seconds ? 'primary' : 'default'" @click="selectPreset(seconds)">{{ t(`runtimeDiagnostics.range.${seconds}`) }}</a-button></div>
        <span class="history-range-label">{{ t('runtimeDiagnostics.customRange') }}</span>
        <ConditionDateRangeValueEditor :value="[range.from, range.to]" :allow-clear="false" :get-popup-container="popupContainer" :placeholder="[t('runtimeDiagnostics.fromTime'), t('runtimeDiagnostics.toTime')]" @change="selectDates" />
      </div>
    </template>
    <a-button class="history-range-trigger" type="text" size="small" :aria-label="t('runtimeDiagnostics.timeRange')"><CalendarOutlined /><span>{{ label }}</span><DownOutlined /></a-button>
  </a-popover>
</template>
<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import dayjs from 'dayjs'
import { CalendarOutlined, DownOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import { ConditionDateRangeValueEditor } from '../../ConditionFilter/value-editors'
import type { TimeWindow } from '../types'
const props = defineProps({ range: { type: Object as PropType<TimeWindow>, required: true } })
const emit = defineEmits<{ (event: 'change', range: TimeWindow): void }>()
const { t } = useI18n(), open = ref(false)
const durations = [15 * 60, 3600, 6 * 3600, 24 * 3600]
const preset = computed(() => durations.find(seconds => seconds === props.range.relativeSeconds))
const label = computed(() => preset.value ? t(`runtimeDiagnostics.range.${preset.value}`) : `${dayjs(props.range.from).format('MM-DD HH:mm')} – ${dayjs(props.range.to).format('MM-DD HH:mm')}`)
let emitted = ''
watch(() => props.range, () => { emitted = '' })
/** 共享编辑器change/ok可能提供同一范围；仅提交一次有效范围，避免重复历史查询。 */
function commit(from: number, to: number, relativeSeconds?: number) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return
  const identity = `${from}:${to}:${relativeSeconds ?? ''}`
  if (identity === emitted || from === props.range.from && to === props.range.to && relativeSeconds === props.range.relativeSeconds) return
  emitted = identity; open.value = false; emit('change', { from, to, ...(relativeSeconds === undefined ? {} : { relativeSeconds }) })
}
function selectPreset(seconds: number) { const to = Date.now(); commit(to - seconds * 1000, to, seconds) }
function selectDates(value: unknown) { if (Array.isArray(value) && value.length === 2 && value.every(part => typeof part === 'number')) commit(value[0], value[1]) }
function popupContainer(element: HTMLElement) { return element.parentElement ?? element }
</script>
<style scoped>
.history-range-trigger { display:inline-flex; align-items:center; gap:6px; max-width:100%; padding-inline:4px; }.history-range-trigger > span { overflow:hidden; text-overflow:ellipsis; }
.history-range-panel { width:360px; max-width:calc(100vw - 64px); }.history-range-presets { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
.history-range-label { display:block; margin-bottom:6px; color:var(--ink-3); font-size:12px; }
</style>
