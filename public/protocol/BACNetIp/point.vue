<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <a-form-item :label="$lang('BACNetIp.point.20260427-1')" required>
        <a-card size="small">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item
                :label="$lang('BACNetIp.point.20260427-2')"
                :name="['configuration', 'objectId', 'type']"
                :rules="[{ required: true, message: $lang('BACNetIp.point.20260427-3') }]"
              >
                <a-input v-model:value="formData.configuration.objectId.type" :placeholder="$lang('BACNetIp.point.20260427-3')" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item
                :label="$lang('BACNetIp.point.20260427-4')"
                :name="['configuration', 'objectId', 'instanceNumber']"
                :rules="[{ required: true, message: $lang('BACNetIp.point.20260427-5') }]"
              >
                <a-input-number
                  v-model:value="formData.configuration.objectId.instanceNumber"
                  style="width: 100%"
                  :placeholder="$lang('BACNetIp.point.20260427-5')"
                  :min="0"
                  :precision="0"
                  :controls="false"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-card>
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <a-form-item
        :label="$lang('BACNetIp.point.20260427-6')"
        :name="['configuration', 'propertyId']"
        :rules="[{ required: true, message: $lang('BACNetIp.point.20260427-7') }]"
      >
        <a-select
          v-model:value="formData.configuration.propertyId"
          :options="propertyOptions"
          :placeholder="$lang('BACNetIp.point.20260427-7')"
          allow-clear
          show-search
          :filter-option="filterOption"
        />
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <a-form-item
        :label="$lang('BACNetIp.point.20260427-8')"
        :name="['configuration', 'valueType']"
        :rules="[{ required: true, message: $lang('BACNetIp.point.20260427-9') }]"
      >
        <a-select
          v-model:value="formData.configuration.valueType"
          :options="valueTypeOptions"
          :placeholder="$lang('BACNetIp.point.20260427-9')"
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
import { request } from '@jetlinks-web/core'
import { useLocales } from '@hooks'

const { $lang } = useLocales('BACNetIp')
const formData = inject('plugin-form', {})
const events = inject('point-metadata-events')
const propertyIdList = ref([])
const valueTypeList = ref([])

if (!('configuration' in formData)) formData.configuration = {}
if (!('objectId' in formData.configuration) || !formData.configuration.objectId) formData.configuration.objectId = {}
if (!('type' in formData.configuration.objectId)) formData.configuration.objectId.type = undefined
if (!('instanceNumber' in formData.configuration.objectId)) formData.configuration.objectId.instanceNumber = undefined
if (!('propertyId' in formData.configuration)) formData.configuration.propertyId = 'presentValue'
if (!('valueType' in formData.configuration)) formData.configuration.valueType = undefined

const fallbackPropertyIds = ['presentValue', 'statusFlags', 'eventState', 'outOfService', 'units', 'description', 'objectName']
const fallbackValueTypes = ['Boolean', 'String', 'Number', 'Integer', 'UnsignedInteger', 'Real', 'Double', 'Enum']

const propertyOptions = computed(() => (propertyIdList.value.length ? propertyIdList.value : fallbackPropertyIds).map((item) => ({
  label: item?.label || item?.name || item?.text || item,
  value: item?.value || item?.id || item?.key || item,
})))

const valueTypeOptions = computed(() => (valueTypeList.value.length ? valueTypeList.value : fallbackValueTypes).map((item) => ({
  label: item?.label || item?.name || item?.text || item,
  value: item?.value || item?.id || item?.key || item,
})))

const filterOption = (input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())

const getValueTypes = async () => {
  const resp = await request.post('/data-collect/BACNetIp/command/QueryValueTypes').catch(() => undefined)
  if (resp?.success) valueTypeList.value = resp.result || []
}

const getPropertyIds = async () => {
  const resp = await request.post('/data-collect/BACNetIp/command/QueryUnusedPropertyIds', {
    objectId: formData.configuration.objectId,
    propertyId: formData.configuration.propertyId,
  }).catch(() => undefined)
  if (resp?.success) propertyIdList.value = resp.result || []
}

watch(
  () => [formData.configuration.objectId?.type, formData.configuration.objectId?.instanceNumber],
  ([type, instanceNumber]) => {
    if (type && instanceNumber !== undefined && instanceNumber !== null) getPropertyIds()
  },
  { immediate: true },
)

watch(
  () => [formData.configuration.objectId?.type, formData.configuration.objectId?.instanceNumber, formData.configuration.propertyId, formData.configuration.valueType],
  ([type, instanceNumber, propertyId, valueType]) => {
    if (type && instanceNumber !== undefined && instanceNumber !== null && propertyId && valueType) {
      events?.pointMetadataEvents?.(formData.provider, { configuration: formData.configuration })
    } else {
      events?.pointMetadataEvents?.(formData.provider, false)
    }
  },
  { immediate: true, deep: true },
)

getValueTypes()
</script>
<style></style>
