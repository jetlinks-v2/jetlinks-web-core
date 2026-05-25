<template>
  <a-form-item
    :label="$lang('BACNetIp.collector.20260427-1')"
    :name="['configuration', 'instanceNumber']"
    :rules="[{ required: true, message: $lang('BACNetIp.collector.20260427-2') }]"
  >
    <a-input-number
      v-model:value="formData.configuration.instanceNumber"
      style="width: 100%"
      :placeholder="$lang('BACNetIp.collector.20260427-2')"
      :min="0"
      :precision="0"
      :controls="false"
    />
  </a-form-item>
  <a-form-item
    :label="$lang('BACNetIp.collector.20260427-3')"
    :name="['configuration', 'address']"
    :rules="[{ required: true, message: $lang('BACNetIp.collector.20260427-4') }]"
  >
    <a-input v-model:value="formData.configuration.address" :placeholder="$lang('BACNetIp.collector.20260427-4')" />
  </a-form-item>
  <a-form-item
    :label="$lang('BACNetIp.collector.20260427-5')"
    :name="['configuration', 'batchSize']"
    :rules="[{ required: true, message: $lang('BACNetIp.collector.20260427-6') }]"
  >
    <a-input-number
      v-model:value="formData.configuration.batchSize"
      style="width: 100%"
      :placeholder="$lang('BACNetIp.collector.20260427-6')"
      :min="1"
      :precision="0"
      :controls="false"
    />
  </a-form-item>
</template>
<script setup>
import { inject } from 'vue'
import { useLocales } from '@hooks'

const { $lang } = useLocales('BACNetIp')
const formData = inject('plugin-form')

if (!('configuration' in formData)) formData.configuration = {}

const defaultValue = {
  instanceNumber: undefined,
  address: undefined,
  batchSize: 16,
}

Object.keys(defaultValue).forEach((key) => {
  if (!(key in formData.configuration)) formData.configuration[key] = defaultValue[key]
})
</script>
<style></style>
