<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <FormItemEditable
        :label="$lang('iec104.collector.20260424-1')"
        :name="['configuration', 'coa']"
        :rules="[{ required: true, message: $lang('iec104.collector.20260424-2') }]"
        v-model:value="formData.configuration.coa"
        :componentProps="{ placeholder: $lang('iec104.collector.20260424-2') }"
        type="string"
        @change="(val) => onChange(['configuration', 'coa'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
        :label="$lang('iec104.collector.20260424-5')"
        :name="['configuration', 'callCumulative']"
        type="select"
        :componentProps="{ options: callCumulativeOptions }"
        v-model:value="formData.configuration.callCumulative"
        @change="(val) => onChange(['configuration', 'callCumulative'], val)"
      />
    </a-col>
    <a-col :span="24">
      <a-form-item
        :label="$lang('iec104.collector.20260424-3')"
        :name="['configuration', 'timer']"
        :rules="[{ validator: checkTimer, trigger: 'change' }]"
      >
        <div class="timer-editable" @click="openTimerEditor">
          <div class="trigger-options-content">
            <span v-if="!Object.keys(timerOptions).length">{{ $lang('iec104.timer.20260427-1') }}</span>
            <template v-else>
              <div v-if="timerOptions.when">
                <span>{{ timerOptions.when }}</span>
              </div>
              <div v-if="timerOptions.time">
                <span>{{ timerOptions.time }}</span>
              </div>
              <div v-if="timerOptions.extraTime">
                <span>{{ timerOptions.extraTime }}</span>
              </div>
            </template>
          </div>
        </div>
      </a-form-item>
    </a-col>
  </a-row>
  <a-modal
    v-model:open="timerVisible"
    :title="$lang('iec104.collector.20260424-3')"
    :width="820"
    :maskClosable="false"
    :keyboard="false"
    @ok="saveTimer"
    @cancel="cancelTimer"
  >
    <a-form ref="timerFormRef" :model="timerDraft" layout="vertical">
      <a-form-item :name="['trigger']">
        <a-radio-group
          v-model:value="timerDraft.trigger"
          :options="triggerOptions"
          option-type="button"
          button-style="solid"
          @change="draftTriggerChange"
        />
      </a-form-item>
      <a-form-item v-if="draftShowCron" :name="['cron']" :rules="[{ validator: checkTimerCron, trigger: 'blur' }]">
        <a-input
          v-model:value="timerDraft.cron"
          :placeholder="$lang('iec104.collector.20260424-4')"
        />
      </a-form-item>
      <template v-else>
        <a-form-item :name="['when']">
          <div class="timer-when-warp">
            <div :class="['when-item-option', !timerDraft.when.length ? 'active' : '']" @click="changeDraftWhen(0)">
              {{ $lang('iec104.timer.20260424-1') }}
            </div>
            <div
              v-for="item in draftWhenOptions"
              :key="item.value"
              :class="['when-item-option', timerDraft.when.includes(item.value) ? 'active' : '']"
              @click="changeDraftWhen(item.value)"
            >
              {{ item.label }}
            </div>
          </div>
        </a-form-item>
        <a-form-item :name="['mod']">
          <a-radio-group
            v-model:value="timerDraft.mod"
            :options="modOptions"
            option-type="button"
            button-style="solid"
            @change="draftModChange"
          />
        </a-form-item>
        <a-space v-if="draftShowOnce" style="display: flex; gap: 24px">
          <a-form-item :name="['once', 'time']">
            <a-time-picker
              v-model:value="timerDraft.once.time"
              value-format="HH:mm:ss"
              format="HH:mm:ss"
              style="width: 160px"
            />
          </a-form-item>
          <a-form-item>{{ $lang('iec104.timer.20260424-5') }}</a-form-item>
        </a-space>
        <a-space v-if="draftShowPeriod" style="display: flex; gap: 24px; flex-wrap: wrap">
          <a-form-item>
            <a-time-range-picker
              value-format="HH:mm:ss"
              :value="[timerDraft.period.from, timerDraft.period.to]"
              @change="draftPeriodRangeChange"
            />
          </a-form-item>
          <a-form-item>{{ $lang('iec104.timer.20260424-6') }}</a-form-item>
          <a-form-item :name="['period', 'every']" :rules="[{ required: true, message: $lang('iec104.timer.20260424-7') }]">
            <a-input-number
              v-model:value="timerDraft.period.every"
              :placeholder="$lang('iec104.timer.20260424-7')"
              style="max-width: 180px"
              :precision="0"
              :min="1"
              :max="draftUnitMax"
            >
              <template #addonAfter>
                <a-select
                  v-model:value="timerDraft.period.unit"
                  :options="unitOptions"
                  style="width: 86px"
                  @select="draftPeriodUnitChange"
                />
              </template>
            </a-input-number>
          </a-form-item>
          <a-form-item>{{ $lang('iec104.timer.20260424-5') }}</a-form-item>
        </a-space>
      </template>
    </a-form>
  </a-modal>
</template>
<script setup>
import { computed, inject, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { useLocales } from '@hooks'

const { $lang } = useLocales('iec104')
const formData = inject('plugin-collector-detail-form')
const events = inject('plugin-collector-detail-events')
const defaultCron = '0 0,15,30,45 * * * ?'
const weekText = ['一', '二', '三', '四', '五', '六', '日']

const createDefaultOnce = () => ({
  time: dayjs(new Date()).format('HH:mm:ss'),
})

const createDefaultPeriod = () => ({
  from: dayjs(new Date()).startOf('day').format('HH:mm:ss'),
  to: dayjs(new Date()).endOf('day').format('HH:mm:ss'),
  every: 15,
  unit: 'minutes',
})

const createDefaultTimer = () => ({
  trigger: 'cron',
  cron: defaultCron,
  when: [],
  mod: 'period',
  once: createDefaultOnce(),
  period: createDefaultPeriod(),
})

const normalizeTimer = (timer) => {
  const source = typeof timer === 'string' ? { cron: timer } : (timer || {})
  return {
    ...createDefaultTimer(),
    ...source,
    when: source.when || [],
    once: source.once ? { ...createDefaultOnce(), ...source.once } : createDefaultOnce(),
    period: source.period ? { ...createDefaultPeriod(), ...source.period } : createDefaultPeriod(),
  }
}

if (!('configuration' in formData)) formData.configuration = {}
if (!('coa' in formData.configuration)) formData.configuration.coa = undefined
formData.configuration.timer = normalizeTimer(formData.configuration.timer)
if (!('callCumulative' in formData.configuration)) formData.configuration.callCumulative = false

const timerVisible = ref(false)
const timerFormRef = ref()
const timerDraft = reactive(createDefaultTimer())

const callCumulativeOptions = computed(() => ([
  { label: $lang('iec104.common.20260424-1'), value: true },
  { label: $lang('iec104.common.20260424-2'), value: false },
]))
const triggerOptions = computed(() => ([
  { label: $lang('iec104.timer.20260424-2'), value: 'week' },
  { label: $lang('iec104.timer.20260424-3'), value: 'month' },
  { label: $lang('iec104.timer.20260424-4'), value: 'cron' },
]))
const modOptions = computed(() => ([
  { label: $lang('iec104.timer.20260424-8'), value: 'period' },
  { label: $lang('iec104.timer.20260424-5'), value: 'once' },
]))
const unitOptions = computed(() => ([
  { label: $lang('iec104.timer.20260424-9'), value: 'seconds' },
  { label: $lang('iec104.timer.20260424-10'), value: 'minutes' },
  { label: $lang('iec104.timer.20260424-11'), value: 'hours' },
]))

const timeUnitText = computed(() => ({
  seconds: $lang('iec104.timer.20260424-9'),
  minutes: $lang('iec104.timer.20260424-10'),
  hours: $lang('iec104.timer.20260424-11'),
}))

const draftShowCron = computed(() => timerDraft.trigger === 'cron')
const draftShowOnce = computed(() => timerDraft.trigger !== 'cron' && timerDraft.mod === 'once')
const draftShowPeriod = computed(() => timerDraft.trigger !== 'cron' && timerDraft.mod === 'period')
const draftUnitMax = computed(() => timerDraft.period?.unit === 'hours' ? 99999 : 99)
const draftWhenOptions = computed(() => {
  const isMonth = timerDraft.trigger === 'month'
  return new Array(isMonth ? 31 : 7).fill(1).map((_, index) => {
    const value = index + 1
    return { label: isMonth ? `${value}日` : `周${weekText[index]}`, value }
  })
})

const continuousValue = (data, type) => {
  if (!Array.isArray(data) || !data.length) return []
  const isWeek = type === 'week'
  const result = []
  let start = 0
  data.forEach((item, index) => {
    const current = Number(item)
    const nextValue = data[index + 1]
    const previousValue = data[index - 1]
    const nextItemValue = current + 1
    const previousItemValue = current - 1
    if (nextItemValue === nextValue && previousItemValue !== previousValue) {
      start = current
    } else if (previousItemValue === previousValue && nextItemValue !== nextValue) {
      if (current - start >= 2) {
        result.push(isWeek ? `周${weekText[start - 1]} - 周${weekText[current - 1]}` : `${start}日 - ${current}日`)
      } else {
        result.push(isWeek ? `周${weekText[start - 1]}` : `${start}日`)
        result.push(isWeek ? `周${weekText[current - 1]}` : `${current}日`)
      }
    } else if (previousItemValue !== previousValue && nextItemValue !== nextValue) {
      result.push(isWeek ? `周${weekText[current - 1]}` : `${current}日`)
    }
  })
  return result
}

const timerOptions = computed(() => {
  const timer = formData.configuration.timer
  if (!timer) return {}
  if (timer.trigger === 'cron') {
    return timer.cron ? { time: timer.cron } : {}
  }
  const options = {}
  if (timer.when?.length) {
    const whenList = continuousValue(timer.when, timer.trigger)
    options.when = `${timer.trigger === 'week' ? '每周' : '每月'}${whenList.slice(0, 3).join('、')}`
    if (timer.when.length > 3) options.when += `等${timer.when.length}项`
  } else {
    options.when = $lang('iec104.timer.20260424-1')
  }
  if (timer.mod === 'once' && timer.once?.time) {
    options.time = `${timer.once.time} ${$lang('iec104.timer.20260424-5')}`
  } else if (timer.period) {
    options.time = `${timer.period.from}-${timer.period.to}`
    options.extraTime = `每隔 ${timer.period.every}${timeUnitText.value[timer.period.unit]} ${$lang('iec104.timer.20260424-5')}`
  }
  return options
})

const copyTimerToDraft = (timer) => {
  Object.assign(timerDraft, normalizeTimer(timer))
}

const openTimerEditor = () => {
  copyTimerToDraft(formData.configuration.timer)
  timerVisible.value = true
}

const cancelTimer = () => {
  timerVisible.value = false
  copyTimerToDraft(formData.configuration.timer)
}

const draftTriggerChange = () => {
  timerDraft.when = []
  if (timerDraft.trigger !== 'cron') {
    timerDraft.cron = undefined
    draftModChange()
  } else {
    timerDraft.cron = timerDraft.cron || defaultCron
    delete timerDraft.once
    delete timerDraft.period
  }
}

const draftModChange = () => {
  if (timerDraft.mod === 'once') {
    timerDraft.once = timerDraft.once || createDefaultOnce()
    delete timerDraft.period
  } else {
    timerDraft.period = timerDraft.period || createDefaultPeriod()
    delete timerDraft.once
  }
}

const changeDraftWhen = (value) => {
  if (value === 0) {
    timerDraft.when = []
    return
  }
  const keys = new Set(timerDraft.when || [])
  keys.has(value) ? keys.delete(value) : keys.add(value)
  timerDraft.when = [...keys.values()].sort((a, b) => a - b)
}

const draftPeriodRangeChange = (value) => {
  const range = value || []
  timerDraft.period.from = range[0]
  timerDraft.period.to = range[1]
}

const draftPeriodUnitChange = () => {
  timerDraft.period.every = 1
}

const buildTimerValue = () => {
  const timer = {
    trigger: timerDraft.trigger,
  }
  if (timerDraft.trigger === 'cron') {
    timer.cron = timerDraft.cron
    return timer
  }
  timer.when = timerDraft.when || []
  timer.mod = timerDraft.mod
  if (timerDraft.mod === 'once') {
    timer.once = { ...timerDraft.once }
  } else {
    timer.period = { ...timerDraft.period }
  }
  return timer
}

const saveTimer = async () => {
  const data = await timerFormRef.value?.validate().catch(() => undefined)
  if (!data) return
  const timer = buildTimerValue()
  formData.configuration.timer = timer
  onChange(['configuration', 'timer'], timer)
  timerVisible.value = false
}

const checkTimerCron = (_rule, value) => new Promise((resolve, reject) => {
  if (!value) return reject($lang('iec104.collector.20260424-4'))
  const parts = value.trim().split(' ')
  if (parts.length < 6 || parts.length > 7) return reject($lang('iec104.timer.20260424-12'))
  return resolve('')
})

const checkTimer = (_rule, value) => new Promise((resolve, reject) => {
  if (!value) return reject($lang('iec104.collector.20260424-4'))
  if (value.trigger === 'cron') return checkTimerCron(_rule, value.cron).then(resolve).catch(reject)
  if (value.mod === 'period' && !value.period?.every) return reject($lang('iec104.timer.20260424-7'))
  return resolve('')
})

const onChange = (name, value) => {
  events.onValueChange([{ name, value }])
}
</script>
<style scoped>
.timer-editable {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
  padding: 4px 11px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.timer-editable:hover {
  background-color: #f5f6f8;
}

.timer-editable:hover {
  border-color: #4096ff;
}

.trigger-options-content {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 16px;
}

.timer-edit-icon {
  color: rgba(0, 0, 0, 0.45);
}

.timer-when-warp {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 16px;
  background: #fafafa;
}

.timer-when-warp .when-item-option {
  width: 76px;
  padding: 6px 0;
  text-align: center;
  background: #fff;
  border: 1px solid #e6e6e6;
  border-radius: 2px;
  cursor: pointer;
}

.timer-when-warp .active {
  color: #233dd7;
  border-color: #233dd7;
}
</style>
