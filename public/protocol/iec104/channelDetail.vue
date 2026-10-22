<template>
  <a-row :gutter="[24, 24]">
    <a-col :span="12">
      <FormItemEditable
        type="string"
        v-model:value="formData.configuration.host"
        :name="['configuration', 'host']"
        :componentProps="{ placeholder: $lang('iec104.channel.20260424-2') }"
        :rules="[
          { required: true, message: $lang('iec104.channel.20260424-2') },
          { validator: checkHost, trigger: 'blur' },
        ]"
        @change="(val) => onChange(['configuration', 'host'], val)"
      >
        <template #label>
          {{ $lang('iec104.channel.20260424-1') }}
          <a-tooltip :title="$lang('iec104.channel.20260424-3')">
            <AIcon type="QuestionCircleOutlined" style="margin-left: 2px" />
          </a-tooltip>
        </template>
      </FormItemEditable>
    </a-col>
    <a-col :span="12">
      <FormItemEditable
        :label="$lang('iec104.channel.20260424-4')"
        :name="['configuration', 'port']"
        :rules="[
          { required: true, message: $lang('iec104.channel.20260424-5') },
          { validator: checkPort, trigger: 'blur' },
        ]"
        type="number"
        :componentProps="{ placeholder: $lang('iec104.channel.20260424-5'), min: 1, max: 65535, precision: 0, controls: false }"
        v-model:value="formData.configuration.port"
        @change="(val) => onChange(['configuration', 'port'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
        :label="$lang('iec104.channel.20260424-7')"
        :name="['configuration', 'timeout']"
        :rules="[{ required: true, message: $lang('iec104.channel.20260424-8') }]"
        type="number"
        :componentProps="{ placeholder: $lang('iec104.channel.20260424-8'), min: 0, precision: 0, controls: false }"
        v-model:value="formData.configuration.timeout"
        @change="(val) => onChange(['configuration', 'timeout'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
        :label="$lang('iec104.channel.20260424-9')"
        :name="['configuration', 'connect']"
        type="select"
        :componentProps="{ options: connectOptions }"
        v-model:value="formData.configuration.connect"
        @change="(val) => onChange(['configuration', 'connect'], val)"
      />
    </a-col>
  </a-row>
</template>
<script setup>
import { inject, computed } from 'vue'
import { useLocales } from '@hooks'

const { $lang } = useLocales('iec104')
const formData = inject('plugin-channel-detail-form')
const events = inject('plugin-channel-detail-events')

if (!('configuration' in formData)) {
  formData.configuration = {}
}

const defaultValue = { host: undefined, port: 2404, timeout: 2000, connect: true }
Object.keys(defaultValue).forEach((key) => {
  if (!(key in formData.configuration)) formData.configuration[key] = defaultValue[key]
})

const connectOptions = computed(() => ([
  { label: $lang('iec104.common.20260424-1'), value: true },
  { label: $lang('iec104.common.20260424-2'), value: false },
]))

const regIP = /^([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])$/
const regIPv6 = /^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/
const regDomain = /([0-9a-z-]{2,}\.[0-9a-z-]{2,3}\.[0-9a-z-]{2,3}|[0-9a-z-]{2,}\.[0-9a-z-]{2,3})$/i

const checkHost = (_rule, value) => new Promise((resolve, reject) => {
  if (!value) return resolve('')
  return regIP.test(value) || regIPv6.test(value) || regDomain.test(value) ? resolve('') : reject($lang('iec104.channel.20260424-6'))
})

const checkPort = (_rule, value) => new Promise((resolve, reject) => {
  if (value === undefined || value === null || value === '') return reject($lang('iec104.channel.20260424-5'))
  return Number.isInteger(Number(value)) && value >= 1 && value <= 65535 ? resolve('') : reject($lang('iec104.channel.20260424-10'))
})

const onChange = (name, value) => {
  events.onValueChange([{ name, value }])
}
</script>
<style></style>
