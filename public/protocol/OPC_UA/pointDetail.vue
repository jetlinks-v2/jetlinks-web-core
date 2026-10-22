<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.point.20260423-1')"
          :name="['configuration', 'nodeId']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.point.20260423-2'),
            },
          ]"
          v-model:value="formData.configuration.nodeId"
          :componentProps="{
            placeholder: $lang('OPC_UA.point.20260423-2'),
            allowClear: true,
            disabled: true
          }"
          type="string"
          @change="(val) => onChange(['configuration', 'nodeId'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.point.20250207-1')"
          :name="['configuration', 'type']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.point.20250207-2'),
            },
          ]"
          v-model:value="formData.configuration.type"
          :componentProps="{
            placeholder: $lang('OPC_UA.point.20250207-2'),
            options: opcuaDataTypeList,
            showSearch: true,
            allowClear: true,
            filterOption,
          }"
          type="select"
          @change="(val) => onChange(['configuration', 'type'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.point.20260423-3')"
          :name="['configuration', 'samplingInterval']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.point.20260423-4'),
            },
          ]"
          v-model:value="formData.configuration.samplingInterval"
          :componentProps="{
            placeholder: $lang('OPC_UA.point.20260423-4'),
            min: 0,
            max: 1000,
            precision: 0,
            addonAfter: 'ms',
          }"
          type="number"
          @change="(val) => onChange(['configuration', 'samplingInterval'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.point.20260423-5')"
          :name="['configuration', 'monitoringMode']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.point.20260423-6'),
            },
          ]"
          v-model:value="formData.configuration.monitoringMode"
          :componentProps="{
            placeholder: $lang('OPC_UA.point.20260423-6'),
            options: monitoringModeOptions,
          }"
          type="select"
          @change="(val) => onChange(['configuration', 'monitoringMode'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.point.20260423-7')"
          :name="['configuration', 'queueSize']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.point.20260423-8'),
            },
          ]"
          v-model:value="formData.configuration.queueSize"
          :componentProps="{
            placeholder: $lang('OPC_UA.point.20260423-8'),
            min: 1,
            max: 65535,
            precision: 0,
          }"
          type="number"
          @change="(val) => onChange(['configuration', 'queueSize'], val)"
      />
    </a-col>
    <a-col :span="12">
      <a-form-item :label="$lang('OPC_UA.point.20260423-9')" :name="['configuration', 'arrayType']">
        <a-switch v-model:checked="formData.configuration.arrayType" @change="(val) => onChange(['configuration', 'arrayType'], val)"/>
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.point.20260423-10')"
          :name="['configuration', 'valueRank']"
          v-model:value="formData.configuration.valueRank"
          :componentProps="{
            placeholder: $lang('OPC_UA.point.20260423-11'),
            precision: 0,
          }"
          type="number"
          @change="(val) => onChange(['configuration', 'valueRank'], val)"
      />
    </a-col>
  </a-row>
</template>

<script setup>
import {computed, inject, ref, watch} from 'vue'
import {request} from '@jetlinks-web/core'
import {useLocales} from '@hooks'

const { $lang } = useLocales('OPC_UA')
const formData = inject('plugin-form', {})
const events = inject('plugin-detail-save-events')
const metadataEvents = inject('point-metadata-events')

const opcuaDataTypeList = ref([])

if (!('configuration' in formData)) {
  formData.configuration = {
    nodeId: undefined,
    type: undefined,
    samplingInterval: 500,
    monitoringMode: 'Reporting',
    queueSize: 256,
    arrayType: false,
    valueRank: undefined,
  }
}

if (!('nodeId' in formData.configuration)) {
  formData.configuration.nodeId = undefined
}

if (!('type' in formData.configuration)) {
  formData.configuration.type = undefined
}

if (!('samplingInterval' in formData.configuration)) {
  formData.configuration.samplingInterval = 500
}

if (!('monitoringMode' in formData.configuration)) {
  formData.configuration.monitoringMode = 'Reporting'
}

if (!('queueSize' in formData.configuration)) {
  formData.configuration.queueSize = 256
}

if (!('arrayType' in formData.configuration)) {
  formData.configuration.arrayType = false
}

if (!('valueRank' in formData.configuration)) {
  formData.configuration.valueRank = undefined
}

if (!('accessModes' in formData)) {
  formData.accessModes = []
}

const monitoringModeOptions = computed(() => ([
  { label: $lang('OPC_UA.point.20260423-12'), value: 'Sampling' },
  { label: $lang('OPC_UA.point.20260423-13'), value: 'Reporting' },
]))

const filterOption = (input, option) => {
  const label = option?.label || option?.text || ''
  return label.toLowerCase().includes(input.toLowerCase())
}

const onChange = (name, value) => {
  events?.onValueChange?.([
    {
      name,
      value,
    },
  ])
}

const getOpcuaDataType = async () => {
  const res = await request.post('/data-collect/OPC_UA/command/OpcUaType', {})
  if (res?.success) {
    opcuaDataTypeList.value = (res.result || []).map((item) => ({
      label: item,
      value: item,
    }))
  }
}

watch(
    () => formData.configuration.type,
    (val) => {
      if (val != null && val !== '') {
        metadataEvents?.pointMetadataEvents?.(formData.provider, { configuration: formData.configuration })
      } else {
        metadataEvents?.pointMetadataEvents?.(formData.provider, false)
      }
    },
    {
      immediate: true,
      deep: true,
    },
)

getOpcuaDataType()
</script>

<style></style>
