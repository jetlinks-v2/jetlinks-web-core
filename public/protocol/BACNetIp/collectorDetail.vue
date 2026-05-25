<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <FormItemEditable
        :label="$lang('BACNetIp.collector.20260427-1')"
        :name="['configuration', 'instanceNumber']"
        :rules="[{ required: true, message: $lang('BACNetIp.collector.20260427-2') }]"
        v-model:value="formData.configuration.instanceNumber"
        :componentProps="{ placeholder: $lang('BACNetIp.collector.20260427-2'), min: 0, precision: 0, controls: false }"
        type="number"
        @change="(val) => onChange(['configuration', 'instanceNumber'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
        :label="$lang('BACNetIp.collector.20260427-3')"
        :name="['configuration', 'address']"
        :rules="[{ required: true, message: $lang('BACNetIp.collector.20260427-4') }]"
        v-model:value="formData.configuration.address"
        :componentProps="{ placeholder: $lang('BACNetIp.collector.20260427-4') }"
        type="string"
        @change="(val) => onChange(['configuration', 'address'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
        :label="$lang('BACNetIp.collector.20260427-5')"
        :name="['configuration', 'batchSize']"
        :rules="[{ required: true, message: $lang('BACNetIp.collector.20260427-6') }]"
        v-model:value="formData.configuration.batchSize"
        :componentProps="{ placeholder: $lang('BACNetIp.collector.20260427-6'), min: 1, precision: 0, controls: false }"
        type="number"
        @change="(val) => onChange(['configuration', 'batchSize'], val)"
      />
    </a-col>
  </a-row>
</template>
<script setup>
import { inject } from 'vue'
import { useLocales } from '@hooks'

const { $lang } = useLocales('BACNetIp')
const formData = inject('plugin-collector-detail-form')
const events = inject('plugin-collector-detail-events')

if (!('configuration' in formData)) formData.configuration = {}
const defaultValue = { instanceNumber: undefined, address: undefined, batchSize: 16 }
Object.keys(defaultValue).forEach((key) => {
  if (!(key in formData.configuration)) formData.configuration[key] = defaultValue[key]
})

const onChange = (name, value) => {
  events.onValueChange([{ name, value }])
}
</script>
<style></style>
