<template>
  <a-form-item
    :label="$lang('BACNetIp.channel.20260427-1')"
    :name="['configuration', 'instanceNumber']"
    :rules="[{ required: true, message: $lang('BACNetIp.channel.20260427-2') }]"
  >
    <a-input-number
      v-model:value="formData.configuration.instanceNumber"
      style="width: 100%"
      :placeholder="$lang('BACNetIp.channel.20260427-2')"
      :min="0"
      :precision="0"
      :controls="false"
    />
  </a-form-item>
  <a-form-item :label="$lang('BACNetIp.channel.20260427-3')" required>
    <a-card size="small">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item
            :label="$lang('BACNetIp.channel.20260428-1')"
            :name="['configuration', 'overIp', 'localBindAddress']"
            :rules="[{ required: true, message: $lang('BACNetIp.channel.20260428-2') }]"
          >
            <a-input
              v-model:value="formData.configuration.overIp.localBindAddress"
              :placeholder="$lang('BACNetIp.channel.20260428-2')"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item
            :label="$lang('BACNetIp.channel.20260428-3')"
            :name="['configuration', 'overIp', 'port']"
            :rules="[{ required: true, message: $lang('BACNetIp.channel.20260428-4') }]"
          >
            <a-input-number
              v-model:value="formData.configuration.overIp.port"
              style="width: 100%"
              :placeholder="$lang('BACNetIp.channel.20260428-4')"
              :min="1"
              :max="65535"
              :precision="0"
              :controls="false"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item
            :label="$lang('BACNetIp.channel.20260428-5')"
            :name="['configuration', 'overIp', 'subnetAddress']"
          >
            <a-input
              v-model:value="formData.configuration.overIp.subnetAddress"
              :placeholder="$lang('BACNetIp.channel.20260428-6')"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item
            :label="$lang('BACNetIp.channel.20260428-7')"
            :name="['configuration', 'overIp', 'networkPrefixLength']"
          >
            <a-input-number
              v-model:value="formData.configuration.overIp.networkPrefixLength"
              style="width: 100%"
              :placeholder="$lang('BACNetIp.channel.20260428-8')"
              :min="0"
              :max="128"
              :precision="0"
              :controls="false"
            />
          </a-form-item>
        </a-col>
      </a-row>
    </a-card>
  </a-form-item>
  <a-form-item
    :label="$lang('BACNetIp.channel.20260427-5')"
    :name="['configuration', 'timeout']"
    :rules="[{ required: true, message: $lang('BACNetIp.channel.20260427-6') }]"
  >
    <a-input-number
      v-model:value="formData.configuration.timeout"
      style="width: 100%"
      :placeholder="$lang('BACNetIp.channel.20260427-6')"
      :min="0"
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
  instanceNumber: 1,
  overIp: {
    localBindAddress: undefined,
    port: undefined,
    subnetAddress: undefined,
    networkPrefixLength: undefined,
  },
  timeout: 2000,
}

Object.keys(defaultValue).forEach((key) => {
  if (!(key in formData.configuration)) formData.configuration[key] = defaultValue[key]
})

if (!formData.configuration.overIp || typeof formData.configuration.overIp !== 'object') {
  formData.configuration.overIp = {
    ...defaultValue.overIp,
    localBindAddress: typeof formData.configuration.overIp === 'string' ? formData.configuration.overIp : undefined,
  }
}

Object.keys(defaultValue.overIp).forEach((key) => {
  if (!(key in formData.configuration.overIp)) formData.configuration.overIp[key] = defaultValue.overIp[key]
})
</script>
<style></style>
