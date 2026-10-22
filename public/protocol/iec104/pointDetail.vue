<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <FormItemEditable
        :label="$lang('iec104.point.20260424-1')"
        :name="['configuration', 'pointAddress']"
        :rules="[{ required: true, message: $lang('iec104.point.20260424-2') }]"
        v-model:value="formData.configuration.pointAddress"
        :componentProps="{ placeholder: $lang('iec104.point.20260424-2'), min: 0, precision: 0, controls: false }"
        type="number"
        @change="(val) => onChange(['configuration', 'pointAddress'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
        :label="$lang('iec104.point.20260427-1')"
        :name="['configuration', 'isRemoteControl']"
        :rules="[{ required: true, message: $lang('iec104.point.20260427-2') }]"
        v-model:value="formData.configuration.isRemoteControl"
        :componentProps="{ placeholder: $lang('iec104.point.20260427-2'), options: booleanOptions }"
        type="select"
        @change="onRemoteControlChange"
      />
    </a-col>
    <a-col v-if="formData.configuration.isRemoteControl" :span="12">
      <FormItemEditable
        :label="$lang('iec104.point.20260424-3')"
        :name="['configuration', 'typeIdentifierName']"
        :rules="[{ required: true, message: $lang('iec104.point.20260424-4') }]"
        v-model:value="formData.configuration.typeIdentifierName"
        :componentProps="{ placeholder: $lang('iec104.point.20260424-4'), options: typeOptions, showSearch: true, allowClear: true, filterOption }"
        type="select"
        @change="(val) => onChange(['configuration', 'typeIdentifierName'], val)"
      />
    </a-col>
  </a-row>
</template>
<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useLocales } from '@hooks'
import { request } from '@jetlinks-web/core'

const { $lang } = useLocales('iec104')
const formData = inject('plugin-form', {})
const detailEvents = inject('plugin-detail-save-events')
const metadataEvents = inject('point-metadata-events')

if (!('configuration' in formData)) formData.configuration = {}
if (!('pointAddress' in formData.configuration)) formData.configuration.pointAddress = undefined
if (!('typeIdentifierName' in formData.configuration)) formData.configuration.typeIdentifierName = undefined
if (!('isRemoteControl' in formData.configuration)) formData.configuration.isRemoteControl = false

const typeList = ref([])

const booleanOptions = computed(() => ([
  { label: $lang('iec104.common.20260424-1'), value: true },
  { label: $lang('iec104.common.20260424-2'), value: false },
]))

const typeOptions = computed(() =>
  typeList.value.map((item) => ({ label: item.name, value: item.key })),
)

const filterOption = (input, option) => {
  return String(option?.label || '').toLowerCase().includes(input.toLowerCase())
}

const getTypes = async () => {
  const res = await request.post('/data-collect/iec104/command/QueryTypes').catch(() => undefined)
  if (res?.success) {
    typeList.value = res.result || []
  }
}

const onChange = (name, value) => {
  detailEvents?.onValueChange?.([{ name, value }])
}

const onRemoteControlChange = (val) => {
  if (!val) {
    formData.configuration.typeIdentifierName = undefined
  }
  onChange(['configuration', 'isRemoteControl'], val)
  if (!val) {
    onChange(['configuration', 'typeIdentifierName'], undefined)
  }
}

watch(
  () => [
    formData.configuration.pointAddress,
    formData.configuration.typeIdentifierName,
    formData.configuration.isRemoteControl,
  ],
  ([pointAddress, typeIdentifierName, isRemoteControl]) => {
    if (
      pointAddress !== undefined &&
      pointAddress !== null &&
      (!isRemoteControl || typeIdentifierName)
    ) {
      metadataEvents?.pointMetadataEvents?.(formData.provider, { configuration: formData.configuration })
    } else {
      metadataEvents?.pointMetadataEvents?.(formData.provider, false)
    }
  },
  { immediate: true, deep: true },
)

getTypes()
</script>
<style></style>
