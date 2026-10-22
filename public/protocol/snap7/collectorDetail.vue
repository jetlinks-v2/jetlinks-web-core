<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <FormItemEditable
          type="string"
          v-model:value="formData.configuration.host"
          :name="['configuration', 'host']"
          :componentProps="{
            placeholder: $lang('snap7.collector.20250207-1')
          }"
          :rules="[
            { required: true, message: $lang('snap7.collector.20250207-1'), trigger: 'blur' },
            { validator: validatorUrl, trigger: 'blur' },
          ]"
          @change="(val) => onChange(['configuration', 'host'], val)"
      >
        <template #label>
          IP
        </template>
      </FormItemEditable>
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('snap7.collector.20250207-2')"
          :name="['configuration', 'port']"
          :rules="[
            { required: true, message: $lang('snap7.collector.20250207-3'), trigger: 'blur' },
            { validator: validator1, trigger: 'blur' },
          ]"
          type="number"
          :componentProps="{
            placeholder: $lang('snap7.collector.20250207-3'),
            min: 1,
            max: 65535,
            precision: 0,
          }"
          v-model:value="formData.configuration.port"
          @change="(val) => onChange(['configuration', 'port'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('snap7.collector.20250207-4')"
          :name="['configuration', 'rack']"
          :rules="[
            { required: true, message: $lang('snap7.collector.20250207-5'), trigger: 'blur' },
            { validator: validator2, trigger: 'blur' },
          ]"
          type="number"
          :componentProps="{
            placeholder: $lang('snap7.collector.20250207-5'),
            min: 0,
            max: 65535,
            precision: 0,
          }"
          v-model:value="formData.configuration.rack"
          @change="(val) => onChange(['configuration', 'rack'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('snap7.collector.20250207-6')"
          :name="['configuration', 'type']"
          :rules="[
            { required: true, message: $lang('snap7.collector.20250207-7'), trigger: 'change' },
          ]"
          type="select"
          :componentProps="{
            placeholder: $lang('snap7.collector.20250207-7'),
            options,
          }"
          v-model:value="formData.configuration.type"
          @change="onTypeChange"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('snap7.collector.20250207-8')"
          :name="['configuration', 'slot']"
          :rules="[
            { required: true, message: $lang('snap7.collector.20250207-9'), trigger: 'blur' },
            { validator: validator3, trigger: 'blur' },
          ]"
          type="number"
          :componentProps="{
            placeholder: $lang('snap7.collector.20250207-9'),
            min: 0,
            max: 65535,
            precision: 0,
            disabled: showSlot,
          }"
          v-model:value="formData.configuration.slot"
          @change="(val) => onChange(['configuration', 'slot'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('snap7.collector.20250207-10')"
          :name="['configuration', 'timeout']"
          :rules="[
            { required: true, message: $lang('snap7.collector.20250207-11'), trigger: 'blur' },
            { validator: validator4, trigger: 'blur' },
          ]"
          type="number"
          :componentProps="{
            placeholder: $lang('snap7.collector.20250207-11'),
            min: 0,
            max: 65535,
            precision: 0,
          }"
          v-model:value="formData.configuration.timeout"
          @change="(val) => onChange(['configuration', 'timeout'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('snap7.collector.20250207-12')"
          :name="['configuration', 'serializable']"
          type="select"
          :componentProps="{
            options: serializableOptions,
          }"
          v-model:value="formData.configuration.serializable"
          @change="(val) => onChange(['configuration', 'serializable'], val)"
      />
    </a-col>
  </a-row>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useLocales } from '@hooks'

const { $lang } = useLocales('snap7')
const formData = inject('plugin-collector-detail-form')
const events = inject('plugin-collector-detail-events')

if (!('configuration' in formData)) {
  formData.configuration = {
    host: undefined,
    port: undefined,
    rack: undefined,
    type: undefined,
    slot: 1,
    timeout: undefined,
    serializable: false,
  }
}

if (!('serializable' in formData.configuration)) {
  formData.configuration.serializable = false
}

const showSlot = computed(() => {
  return formData.configuration.type === 'S200' || formData.configuration.type === 'S1200'
})

const DOMAIN_NAME = /^(?:(?:(?:[a-zA-z\-]+)\:\/{1,3})?(?:[a-zA-Z0-9])(?:[a-zA-Z0-9-\.]){1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+|\[(?:(?:(?:[a-fA-F0-9]){1,4})(?::(?:[a-fA-F0-9]){1,4}){7}|::1|::)\]|(?:(?:[0-9]{1,3})(?:\.[0-9]{1,3}){3}))(?:\:[0-9]{1,5})?$/
const IP_URL = /^((2((5[0-5])|([0-4]\d)))|([0-1]?\d{1,2}))(\.((2((5[0-5])|([0-4]\d)))|([0-1]?\d{1,2}))){3}$/

const options = [
  { value: 'S200', label: 'S7-200' },
  { value: 'S300', label: 'S7-300' },
  { value: 'S400', label: 'S7-400' },
  { value: 'S1200', label: 'S7-1200' },
  { value: 'S1500', label: 'S7-1500' },
]

const serializableOptions = computed(() => [
  { label: $lang('snap7.collector.20250207-13'), value: false },
  { label: $lang('snap7.collector.20250207-14'), value: true },
])

const validatorUrl = (_rule, value) => {
  if (value === undefined || value === '' || value === null) {
    return Promise.reject($lang('snap7.collector.20250207-1'))
  }
  if (!DOMAIN_NAME.test(value) && !IP_URL.test(value)) {
    return Promise.reject($lang('snap7.collector.20250207-15'))
  }
  return Promise.resolve()
}

const validator1 = (_rule, value) => {
  if (value === undefined || value === '' || value === null) {
    return Promise.reject($lang('snap7.collector.20250207-3'))
  }
  if (value < 1 || value > 65535) {
    return Promise.reject($lang('snap7.collector.20250207-16'))
  }
  return Promise.resolve()
}

const validator2 = (_rule, value) => {
  if (value === undefined || value === '' || value === null) {
    return Promise.reject($lang('snap7.collector.20250207-5'))
  }
  if (value < 0 || value > 65535) {
    return Promise.reject($lang('snap7.collector.20250207-17'))
  }
  return Promise.resolve()
}

const validator3 = (_rule, value) => {
  if (value === undefined || value === '' || value === null) {
    return Promise.reject($lang('snap7.collector.20250207-9'))
  }
  if (value < 0 || value > 65535) {
    return Promise.reject($lang('snap7.collector.20250207-17'))
  }
  return Promise.resolve()
}

const validator4 = (_rule, value) => {
  if (value === undefined || value === '' || value === null) {
    return Promise.reject($lang('snap7.collector.20250207-11'))
  }
  if (value < 0 || value > 65535) {
    return Promise.reject($lang('snap7.collector.20250207-17'))
  }
  return Promise.resolve()
}

const typeChange = (val) => {
  if (val === 'S200' || val === 'S1200') {
    formData.configuration.slot = 1
    onChange(['configuration', 'slot'], 1)
  }
}

const onTypeChange = (val) => {
  typeChange(val)
  onChange(['configuration', 'type'], val)
}

const onChange = (name, value) => {
  events?.onValueChange?.([
    {
      name,
      value,
    },
  ])
}
</script>

<style></style>
