<template>
  <a-form-item
    :label="$lang('iec104.collector.20260424-1')"
    :name="['configuration', 'coa']"
    :rules="[{ required: true, message: $lang('iec104.collector.20260424-2') }]"
  >
    <a-input v-model:value="formData.configuration.coa" :placeholder="$lang('iec104.collector.20260424-2')" />
  </a-form-item>
  <a-form-item
    :label="$lang('iec104.collector.20260424-3')"
    :name="['configuration', 'timer']"
    :rules="[{ validator: checkTimer, trigger: 'change' }]"
  >
    <div class="iec104-timer">
      <a-radio-group
        v-model:value="formData.configuration.timer.trigger"
        :options="triggerOptions"
        option-type="button"
        button-style="solid"
        @change="triggerChange"
      />
      <a-input
        v-if="showCron"
        v-model:value="formData.configuration.timer.cron"
        :placeholder="$lang('iec104.collector.20260424-4')"
      />
      <template v-else>
        <div class="timer-when-warp">
          <div :class="['when-item-option', !formData.configuration.timer.when.length ? 'active' : '']" @click="changeWhen(0)">
            {{ $lang('iec104.timer.20260424-1') }}
          </div>
          <div
            v-for="item in whenOptions"
            :key="item.value"
            :class="['when-item-option', formData.configuration.timer.when.includes(item.value) ? 'active' : '']"
            @click="changeWhen(item.value)"
          >
            {{ item.label }}
          </div>
        </div>
        <a-radio-group
          v-model:value="formData.configuration.timer.mod"
          :options="modOptions"
          option-type="button"
          button-style="solid"
          @change="modChange"
        />
        <a-space v-if="showOnce" style="display: flex; gap: 24px">
          <a-time-picker
            v-model:value="formData.configuration.timer.once.time"
            value-format="HH:mm:ss"
            format="HH:mm:ss"
            style="width: 160px"
          />
          <span>{{ $lang('iec104.timer.20260424-5') }}</span>
        </a-space>
        <a-space v-if="showPeriod" style="display: flex; gap: 24px; flex-wrap: wrap">
          <a-time-range-picker
            value-format="HH:mm:ss"
            :value="[formData.configuration.timer.period.from, formData.configuration.timer.period.to]"
            @change="periodRangeChange"
          />
          <span>{{ $lang('iec104.timer.20260424-6') }}</span>
          <a-input-number
            v-model:value="formData.configuration.timer.period.every"
            :placeholder="$lang('iec104.timer.20260424-7')"
            style="max-width: 180px"
            :precision="0"
            :min="1"
            :max="unitMax"
          >
            <template #addonAfter>
              <a-select
                v-model:value="formData.configuration.timer.period.unit"
                :options="unitOptions"
                style="width: 86px"
                @select="periodUnitChange"
              />
            </template>
          </a-input-number>
          <span>{{ $lang('iec104.timer.20260424-5') }}</span>
        </a-space>
      </template>
    </div>
  </a-form-item>
  <a-form-item :label="$lang('iec104.collector.20260424-5')" :name="['configuration', 'callCumulative']">
    <a-radio-group v-model:value="formData.configuration.callCumulative">
      <a-radio-button :value="true">{{ $lang('iec104.common.20260424-1') }}</a-radio-button>
      <a-radio-button :value="false">{{ $lang('iec104.common.20260424-2') }}</a-radio-button>
    </a-radio-group>
  </a-form-item>
</template>
<script setup>
import { computed, inject } from 'vue'
import dayjs from 'dayjs'
import { useLocales } from '@hooks'

const { $lang } = useLocales('iec104')
const formData = inject('plugin-form')
const defaultCron = '0 0,15,30,45 * * * ?'
const weekText = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const createDefaultTimer = () => ({
  trigger: 'cron',
  cron: defaultCron,
  when: [],
  mod: 'period',
  once: {
    time: dayjs(new Date()).format('HH:mm:ss'),
  },
  period: {
    from: dayjs(new Date()).startOf('day').format('HH:mm:ss'),
    to: dayjs(new Date()).endOf('day').format('HH:mm:ss'),
    every: 15,
    unit: 'minutes',
  },
})

const createDefaultOnce = () => ({
  time: dayjs(new Date()).format('HH:mm:ss'),
})

const createDefaultPeriod = () => ({
  from: dayjs(new Date()).startOf('day').format('HH:mm:ss'),
  to: dayjs(new Date()).endOf('day').format('HH:mm:ss'),
  every: 15,
  unit: 'minutes',
})

if (!('configuration' in formData)) {
  formData.configuration = {}
}

if (!('coa' in formData.configuration)) {
  formData.configuration.coa = undefined
}

if (!('timer' in formData.configuration) || !formData.configuration.timer) {
  formData.configuration.timer = createDefaultTimer()
}

if (typeof formData.configuration.timer === 'string') {
  formData.configuration.timer = { ...createDefaultTimer(), cron: formData.configuration.timer }
}

Object.assign(formData.configuration.timer, {
  ...createDefaultTimer(),
  ...formData.configuration.timer,
  once: { ...createDefaultTimer().once, ...formData.configuration.timer.once },
  period: { ...createDefaultTimer().period, ...formData.configuration.timer.period },
  when: formData.configuration.timer.when || [],
})

if (!('callCumulative' in formData.configuration)) {
  formData.configuration.callCumulative = false
}

const triggerOptions = computed(() => {
  return [
    { label: $lang('iec104.timer.20260424-2'), value: 'week' },
    { label: $lang('iec104.timer.20260424-3'), value: 'month' },
    { label: $lang('iec104.timer.20260424-4'), value: 'cron' },
  ]
})

const modOptions = computed(() => {
  return [
    { label: $lang('iec104.timer.20260424-8'), value: 'period' },
    { label: $lang('iec104.timer.20260424-5'), value: 'once' },
  ]
})

const unitOptions = computed(() => {
  return [
    { label: $lang('iec104.timer.20260424-9'), value: 'seconds' },
    { label: $lang('iec104.timer.20260424-10'), value: 'minutes' },
    { label: $lang('iec104.timer.20260424-11'), value: 'hours' },
  ]
})

const showCron = computed(() => formData.configuration.timer.trigger === 'cron')
const showOnce = computed(() => formData.configuration.timer.trigger !== 'cron' && formData.configuration.timer.mod === 'once')
const showPeriod = computed(() => formData.configuration.timer.trigger !== 'cron' && formData.configuration.timer.mod === 'period')
const unitMax = computed(() => formData.configuration.timer.period?.unit === 'hours' ? 99999 : 99)

const whenOptions = computed(() => {
  const isMonth = formData.configuration.timer.trigger === 'month'
  return new Array(isMonth ? 31 : 7).fill(1).map((_, index) => {
    const value = index + 1
    return {
      label: isMonth ? `${value}日` : `${weekText[index]}`,
      value,
    }
  })
})

const triggerChange = () => {
  formData.configuration.timer.when = []
  if (formData.configuration.timer.trigger !== 'cron') {
    formData.configuration.timer.cron = undefined
    modChange()
  } else {
    formData.configuration.timer.cron = formData.configuration.timer.cron || defaultCron
    delete formData.configuration.timer.once
    delete formData.configuration.timer.period
  }
}

const modChange = () => {
  if (formData.configuration.timer.mod === 'once') {
    formData.configuration.timer.once = formData.configuration.timer.once || createDefaultOnce()
    delete formData.configuration.timer.period
  } else {
    formData.configuration.timer.period = formData.configuration.timer.period || createDefaultPeriod()
    delete formData.configuration.timer.once
  }
}

const changeWhen = (value) => {
  if (value === 0) {
    formData.configuration.timer.when = []
    return
  }
  const keys = new Set(formData.configuration.timer.when || [])
  keys.has(value) ? keys.delete(value) : keys.add(value)
  formData.configuration.timer.when = [...keys.values()].sort((a, b) => a - b)
}

const periodRangeChange = (value) => {
  const range = value || []
  formData.configuration.timer.period.from = range[0]
  formData.configuration.timer.period.to = range[1]
}

const periodUnitChange = () => {
  formData.configuration.timer.period.every = 1
}

const checkTimer = (_rule, value) => new Promise((resolve, reject) => {
  if (!value) return reject($lang('iec104.collector.20260424-4'))
  if (value.trigger === 'cron') {
    if (!value.cron) return reject($lang('iec104.collector.20260424-4'))
    const parts = value.cron.trim().split(' ')
    if (parts.length < 6 || parts.length > 7) return reject($lang('iec104.timer.20260424-12'))
  }
  if (value.trigger !== 'cron' && value.mod === 'period' && !value.period?.every) {
    return reject($lang('iec104.timer.20260424-7'))
  }
  return resolve('')
})
</script>
<style scoped>
.iec104-timer {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
