<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.collector.20260422-1')"
          :name="['configuration', 'publishingInterval']"
          :rules="[
            { required: true, trigger: 'blur', validator: validatePublishingInterval },
          ]"
          v-model:value="formData.configuration.publishingInterval"
          :componentProps="{
            placeholder: $lang('OPC_UA.collector.20260422-2'),
            min: 50,
            max: 600000,
            precision: 0,
          }"
          type="number"
          @change="(val) => onChange(['configuration', 'publishingInterval'], val)"
      />
    </a-col>

    <a-col :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.collector.20260422-3')"
          :name="['configuration', 'maxNotificationsPerPublish']"
          :rules="[
            { required: true, trigger: 'blur', validator: validateMaxNotificationsPerPublish },
          ]"
          v-model:value="formData.configuration.maxNotificationsPerPublish"
          :componentProps="{
            placeholder: $lang('OPC_UA.collector.20260422-4'),
            min: 1,
            max: 65535,
            precision: 0,
          }"
          type="number"
          @change="(val) => onChange(['configuration', 'maxNotificationsPerPublish'], val)"
      />
    </a-col>

    <a-col :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.collector.20260422-5')"
          :name="['configuration', 'priority']"
          :rules="[
            { required: true, trigger: 'blur', validator: validatePriority },
          ]"
          v-model:value="formData.configuration.priority"
          :componentProps="{
            placeholder: $lang('OPC_UA.collector.20260422-6'),
            min: 0,
            max: 255,
            precision: 0,
          }"
          type="number"
          @change="(val) => onChange(['configuration', 'priority'], val)"
      />
    </a-col>
  </a-row>
</template>

<script setup>
import { inject } from 'vue'
import { useLocales } from '@hooks'

const { $lang } = useLocales('OPC_UA')
const formData = inject('plugin-collector-detail-form')
const events = inject('plugin-collector-detail-events')

if (!('configuration' in formData)) {
  formData.configuration = {
    publishingInterval: undefined,
    maxNotificationsPerPublish: undefined,
    priority: undefined,
  }
}

if (!('publishingInterval' in formData.configuration)) {
  formData.configuration.publishingInterval = undefined
}

if (!('maxNotificationsPerPublish' in formData.configuration)) {
  formData.configuration.maxNotificationsPerPublish = undefined
}

if (!('priority' in formData.configuration)) {
  formData.configuration.priority = undefined
}

const validatePublishingInterval = (_rule, value) => {
  if (value === undefined || value === '' || value === null) {
    return Promise.reject($lang('OPC_UA.collector.20260422-2'))
  }
  if (!Number.isInteger(value) || value < 50 || value > 600000) {
    return Promise.reject($lang('OPC_UA.collector.20260422-7'))
  }
  return Promise.resolve()
}

const validateMaxNotificationsPerPublish = (_rule, value) => {
  if (value === undefined || value === '' || value === null) {
    return Promise.reject($lang('OPC_UA.collector.20260422-4'))
  }
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    return Promise.reject($lang('OPC_UA.collector.20260422-8'))
  }
  return Promise.resolve()
}

const validatePriority = (_rule, value) => {
  if (value === undefined || value === '' || value === null) {
    return Promise.reject($lang('OPC_UA.collector.20260422-6'))
  }
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    return Promise.reject($lang('OPC_UA.collector.20260422-9'))
  }
  return Promise.resolve()
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
