<template>
  <a-form-item
    :name="['configuration', 'host']"
    :rules="[
      { required: true, message: $lang('iec104.channel.20260424-2') },
      { validator: checkHost, trigger: 'blur' },
    ]"
  >
    <template #label>
      {{ $lang('iec104.channel.20260424-1') }}
      <a-tooltip :title="$lang('iec104.channel.20260424-3')">
        <AIcon type="QuestionCircleOutlined" style="margin-left: 2px" />
      </a-tooltip>
    </template>
    <a-input v-model:value="formData.configuration.host" :placeholder="$lang('iec104.channel.20260424-2')" />
  </a-form-item>
  <a-form-item
    :label="$lang('iec104.channel.20260424-4')"
    :name="['configuration', 'port']"
    :rules="[
      { required: true, message: $lang('iec104.channel.20260424-5') },
      { validator: checkPort, trigger: 'blur' },
    ]"
  >
    <a-input-number
      v-model:value="formData.configuration.port"
      style="width: 100%"
      :placeholder="$lang('iec104.channel.20260424-5')"
      :min="1"
      :max="65535"
      :precision="0"
      :controls="false"
    />
  </a-form-item>
  <a-form-item
    :label="$lang('iec104.channel.20260424-7')"
    :name="['configuration', 'timeout']"
    :rules="[{ required: true, message: $lang('iec104.channel.20260424-8') }]"
  >
    <a-input-number
      v-model:value="formData.configuration.timeout"
      style="width: 100%"
      :placeholder="$lang('iec104.channel.20260424-8')"
      :min="0"
      :precision="0"
      :controls="false"
    />
  </a-form-item>
  <a-form-item :label="$lang('iec104.channel.20260424-9')" :name="['configuration', 'connect']">
    <a-radio-group v-model:value="formData.configuration.connect">
      <a-radio-button :value="true">{{ $lang('iec104.common.20260424-1') }}</a-radio-button>
      <a-radio-button :value="false">{{ $lang('iec104.common.20260424-2') }}</a-radio-button>
    </a-radio-group>
  </a-form-item>
</template>
<script setup>
import { inject } from 'vue'
import { useLocales } from '@hooks'

const { $lang } = useLocales('iec104')
const formData = inject('plugin-form')

if (!('configuration' in formData)) {
  formData.configuration = {}
}

const defaultValue = {
  host: undefined,
  port: 2404,
  timeout: 2000,
  connect: true,
}

Object.keys(defaultValue).forEach((key) => {
  if (!(key in formData.configuration)) {
    formData.configuration[key] = defaultValue[key]
  }
})

const regIP = /^([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])$/
const regIPv6 = /^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/
const regDomain = /([0-9a-z-]{2,}\.[0-9a-z-]{2,3}\.[0-9a-z-]{2,3}|[0-9a-z-]{2,}\.[0-9a-z-]{2,3})$/i

const checkHost = (_rule, value) => new Promise((resolve, reject) => {
  if (!value) return resolve('')
  if (!(regIP.test(value) || regIPv6.test(value) || regDomain.test(value))) {
    return reject($lang('iec104.channel.20260424-6'))
  }
  return resolve('')
})

const checkPort = (_rule, value) => new Promise((resolve, reject) => {
  if (value === undefined || value === null || value === '') return reject($lang('iec104.channel.20260424-5'))
  if (!Number.isInteger(Number(value)) || value < 1 || value > 65535) return reject($lang('iec104.channel.20260424-10'))
  return resolve('')
})
</script>
<style></style>
