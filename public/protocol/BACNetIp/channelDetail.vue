<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <FormItemEditable
        :label="$lang('BACNetIp.channel.20260427-1')"
        :name="['configuration', 'instanceNumber']"
        :rules="[{ required: true, message: $lang('BACNetIp.channel.20260427-2') }]"
        v-model:value="formData.configuration.instanceNumber"
        :componentProps="{ placeholder: $lang('BACNetIp.channel.20260427-2'), min: 0, precision: 0, controls: false }"
        type="number"
        @change="(val) => onChange(['configuration', 'instanceNumber'], val)"
      />
    </a-col>
    <a-col :span="24">
      <a-form-item :label="$lang('BACNetIp.channel.20260427-3')" required>
        <a-card size="small">
          <a-row :gutter="16">
            <a-col :span="12">
              <FormItemEditable
                :label="$lang('BACNetIp.channel.20260428-1')"
                :name="['configuration', 'overIp', 'localBindAddress']"
                :rules="[{ required: true, message: $lang('BACNetIp.channel.20260428-2') }]"
                v-model:value="formData.configuration.overIp.localBindAddress"
                :componentProps="{ placeholder: $lang('BACNetIp.channel.20260428-2') }"
                type="string"
                @change="(val) => onOverIpChange('localBindAddress', val)"
              />
            </a-col>
            <a-col :span="12">
              <FormItemEditable
                :label="$lang('BACNetIp.channel.20260428-3')"
                :name="['configuration', 'overIp', 'port']"
                :rules="[{ required: true, message: $lang('BACNetIp.channel.20260428-4') }]"
                v-model:value="formData.configuration.overIp.port"
                :componentProps="{ placeholder: $lang('BACNetIp.channel.20260428-4'), min: 1, max: 65535, precision: 0, controls: false }"
                type="number"
                @change="(val) => onOverIpChange('port', val)"
              />
            </a-col>
            <a-col :span="12">
              <FormItemEditable
                :label="$lang('BACNetIp.channel.20260428-5')"
                :name="['configuration', 'overIp', 'subnetAddress']"
                v-model:value="formData.configuration.overIp.subnetAddress"
                :componentProps="{ placeholder: $lang('BACNetIp.channel.20260428-6') }"
                type="string"
                @change="(val) => onOverIpChange('subnetAddress', val)"
              />
            </a-col>
            <a-col :span="12">
              <FormItemEditable
                :label="$lang('BACNetIp.channel.20260428-7')"
                :name="['configuration', 'overIp', 'networkPrefixLength']"
                v-model:value="formData.configuration.overIp.networkPrefixLength"
                :componentProps="{ placeholder: $lang('BACNetIp.channel.20260428-8'), min: 0, max: 128, precision: 0, controls: false }"
                type="number"
                @change="(val) => onOverIpChange('networkPrefixLength', val)"
              />
            </a-col>
          </a-row>
        </a-card>
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <FormItemEditable
        :label="$lang('BACNetIp.channel.20260427-5')"
        :name="['configuration', 'timeout']"
        :rules="[{ required: true, message: $lang('BACNetIp.channel.20260427-6') }]"
        v-model:value="formData.configuration.timeout"
        :componentProps="{ placeholder: $lang('BACNetIp.channel.20260427-6'), min: 0, precision: 0, controls: false }"
        type="number"
        @change="(val) => onChange(['configuration', 'timeout'], val)"
      />
    </a-col>
  </a-row>
</template>
<script setup>
import { inject } from 'vue'
import { useLocales } from '@hooks'

const { $lang } = useLocales('BACNetIp')
const formData = inject('plugin-channel-detail-form')
const events = inject('plugin-channel-detail-events')

if (!('configuration' in formData)) formData.configuration = {}
const defaultOverIp = {
  localBindAddress: undefined,
  port: undefined,
  subnetAddress: undefined,
  networkPrefixLength: undefined,
}
const defaultValue = { instanceNumber: 1, overIp: defaultOverIp, timeout: 2000 }
Object.keys(defaultValue).forEach((key) => {
  if (!(key in formData.configuration)) formData.configuration[key] = defaultValue[key]
})

if (!formData.configuration.overIp || typeof formData.configuration.overIp !== 'object') {
  formData.configuration.overIp = {
    ...defaultOverIp,
    localBindAddress: typeof formData.configuration.overIp === 'string' ? formData.configuration.overIp : undefined,
  }
}

Object.keys(defaultOverIp).forEach((key) => {
  if (!(key in formData.configuration.overIp)) formData.configuration.overIp[key] = defaultOverIp[key]
})

const onOverIpChange = (key, value) => {
  formData.configuration.overIp[key] = value
  onChange(['configuration', 'overIp'], { ...formData.configuration.overIp })
}

const onChange = (name, value) => {
  events.onValueChange([{ name, value }])
}
</script>
<style></style>
