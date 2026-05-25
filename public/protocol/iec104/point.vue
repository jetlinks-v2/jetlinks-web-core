<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <a-form-item
        :label="$lang('iec104.point.20260424-1')"
        :name="['configuration', 'pointAddress']"
        :rules="[{ required: true, message: $lang('iec104.point.20260424-2') }]"
      >
        <a-input-number
          v-model:value="formData.configuration.pointAddress"
          style="width: 100%"
          :placeholder="$lang('iec104.point.20260424-2')"
          :min="0"
          :precision="0"
          :controls="false"
        />
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <a-form-item
        :label="$lang('iec104.point.20260427-1')"
        :name="['configuration', 'isRemoteControl']"
        :rules="[{ required: true, message: $lang('iec104.point.20260427-2') }]"
      >
        <a-select
          v-model:value="formData.configuration.isRemoteControl"
          :placeholder="$lang('iec104.point.20260427-2')"
          :options="booleanOptions"
          @change="onRemoteControlChange"
        />
      </a-form-item>
    </a-col>
    <a-col v-if="formData.configuration.isRemoteControl" :span="12">
      <a-form-item
        :label="$lang('iec104.point.20260424-3')"
        :name="['configuration', 'typeIdentifierName']"
        :rules="[{ required: true, message: $lang('iec104.point.20260424-4') }]"
      >
        <a-select
          v-model:value="formData.configuration.typeIdentifierName"
          :placeholder="$lang('iec104.point.20260424-4')"
          :options="typeOptions"
          allow-clear
          show-search
          :filter-option="filterOption"
        />
      </a-form-item>
    </a-col>
  </a-row>
</template>
<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useLocales } from '@hooks'
import { request } from '@jetlinks-web/core'

const { $lang } = useLocales('iec104')
const formData = inject('plugin-form', {})
const events = inject('point-metadata-events')

if (!('configuration' in formData)) {
  formData.configuration = {}
}

if (!('pointAddress' in formData.configuration)) {
  formData.configuration.pointAddress = undefined
}

if (!('typeIdentifierName' in formData.configuration)) {
  formData.configuration.typeIdentifierName = undefined
}

if (!('isRemoteControl' in formData.configuration)) {
  formData.configuration.isRemoteControl = false
}

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

const onRemoteControlChange = (val) => {
  if (!val) {
    formData.configuration.typeIdentifierName = undefined
  }
}

watch(
  () => [
    formData.configuration.pointAddress,
    formData.configuration.typeIdentifierName,
    formData.configuration.isRemoteControl,
  ],
  ([pointAddress, typeIdentifierName, isRemoteControl]) => {
    events?.pointMetadataEvents?.(formData.provider, { configuration: formData.configuration })
  },
  { immediate: true, deep: true },
)

getTypes()
</script>
<style></style>
