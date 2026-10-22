<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <a-form-item
          :label="$lang('OPC_UA.point.20260423-1')"
          :name="['configuration', 'nodeId']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.point.20260423-2'),
            },
          ]"
      >
        <a-input
            v-model:value="formData.configuration.nodeId"
            :placeholder="$lang('OPC_UA.point.20260423-2')"
            allow-clear
        />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item
          :label="$lang('OPC_UA.point.20250207-1')"
          :name="['configuration', 'type']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.point.20250207-2'),
            },
          ]"
      >
        <a-select
            v-model:value="formData.configuration.type"
            show-search
            allow-clear
            :placeholder="$lang('OPC_UA.point.20250207-2')"
            :options="opcuaDataTypeList"
            :filter-option="filterOption"
        />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item
          :label="$lang('OPC_UA.point.20260423-3')"
          :name="['configuration', 'samplingInterval']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.point.20260423-4'),
            },
          ]"
      >
        <a-input-number
            v-model:value="formData.configuration.samplingInterval"
            style="width: 100%"
            :min="0"
            :max="1000"
            :precision="0"
            addon-after="ms"
            :placeholder="$lang('OPC_UA.point.20260423-4')"
        />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item
          :label="$lang('OPC_UA.point.20260423-5')"
          :name="['configuration', 'monitoringMode']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.point.20260423-6'),
            },
          ]"
      >
        <a-select
            v-model:value="formData.configuration.monitoringMode"
            :options="monitoringModeOptions"
            :placeholder="$lang('OPC_UA.point.20260423-6')"
        />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item
          :label="$lang('OPC_UA.point.20260423-7')"
          :name="['configuration', 'queueSize']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.point.20260423-8'),
            },
          ]"
      >
        <a-input-number
            v-model:value="formData.configuration.queueSize"
            style="width: 100%"
            :min="1"
            :max="65535"
            :precision="0"
            :placeholder="$lang('OPC_UA.point.20260423-8')"
        />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item
          :label="$lang('OPC_UA.point.20250207-3')"
          name="accessModes"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.point.20250207-4'),
            },
          ]"
      >
        <j-check-button
            v-model:value="formData.accessModes"
            :multiple="true"
            :options="accessModeOptions"
        />
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item
          :label="$lang('OPC_UA.point.20260423-9')"
          :name="['configuration', 'arrayType']"
          :valuePropName="'checked'"
      >
        <a-switch v-model:checked="formData.configuration.arrayType"/>
      </a-form-item>
    </a-col>

    <a-col :span="12">
      <a-form-item
          :label="$lang('OPC_UA.point.20260423-10')"
          :name="['configuration', 'valueRank']"
      >
        <a-input-number
            v-model:value="formData.configuration.valueRank"
            style="width: 100%"
            :precision="0"
            :placeholder="$lang('OPC_UA.point.20260423-11')"
        />
      </a-form-item>
    </a-col>
  </a-row>
</template>

<script setup>
import {inject, ref, watch} from 'vue'
import {request} from '@jetlinks-web/core'
import {useLocales} from '@hooks'

const formData = inject('plugin-form', {
  configuration: {
    nodeId: undefined,
    samplingInterval: 500,
    monitoringMode: 'Reporting',
    queueSize: 256,
    type: undefined,
    arrayType: false,
    valueRank: undefined,
  },
  accessModes: [],
})
const showDeathArea = inject('plugin-form-death-area-show', ref(false))
const { $lang } = useLocales('OPC_UA')

const opcuaDataTypeList = ref([])

if (!('configuration' in formData)) {
  formData.configuration = {
    nodeId: undefined,
    samplingInterval: 500,
    monitoringMode: 'Reporting',
    queueSize: 256,
    type: undefined,
    arrayType: false,
    valueRank: undefined,
  }
}

if (!('nodeId' in formData.configuration)) {
  formData.configuration.nodeId = undefined
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

if (!('type' in formData.configuration)) {
  formData.configuration.type = undefined
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

const accessModeOptions = computed(() => ([
  { label: $lang('OPC_UA.point.20250207-5'), value: 'read' },
  { label: $lang('OPC_UA.point.20250207-6'), value: 'write' },
  { label: $lang('OPC_UA.point.20250207-7'), value: 'subscribe' },
]))

const numberTypes = ['Byte', 'Short', 'Word', 'Integer', 'DWord', 'Long', 'LLong', 'Float', 'Double']

const filterOption = (input, option) => {
  return option?.label?.toLowerCase?.().includes(input.toLowerCase())
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
      showDeathArea.value = !!val && numberTypes.includes(val)
    },
    {
      immediate: true,
    },
)

getOpcuaDataType()
</script>

<style></style>
