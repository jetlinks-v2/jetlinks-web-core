<template>
  <a-form-item
      :label="$lang('OPC_UA.collector.20260422-1')"
      :name="['configuration', 'publishingInterval']"
      :rules="[
        { required: true, trigger: 'blur', validator: validatePublishingInterval },
      ]"
  >
    <a-input-number
        v-model:value="formData.configuration.publishingInterval"
        style="width: 100%"
        :precision="0"
        :min="50"
        :max="600000"
        :placeholder="$lang('OPC_UA.collector.20260422-2')"
    />
  </a-form-item>

  <a-form-item
      :label="$lang('OPC_UA.collector.20260422-3')"
      :name="['configuration', 'maxNotificationsPerPublish']"
      :rules="[
        { required: true, trigger: 'blur', validator: validateMaxNotificationsPerPublish },
      ]"
  >
    <a-input-number
        v-model:value="formData.configuration.maxNotificationsPerPublish"
        style="width: 100%"
        :precision="0"
        :min="1"
        :max="65535"
        :placeholder="$lang('OPC_UA.collector.20260422-4')"
    />
  </a-form-item>

  <a-form-item
      :label="$lang('OPC_UA.collector.20260422-5')"
      :name="['configuration', 'priority']"
      :rules="[
        { required: true, trigger: 'blur', validator: validatePriority },
      ]"
  >
    <a-input-number
        v-model:value="formData.configuration.priority"
        style="width: 100%"
        :precision="0"
        :min="0"
        :max="255"
        :placeholder="$lang('OPC_UA.collector.20260422-6')"
    />
  </a-form-item>
</template>

<script setup>
import { inject } from 'vue'
import { useLocales } from '@hooks'

const { $lang } = useLocales('OPC_UA')
const formData = inject('plugin-form')

if (!('configuration' in formData)) {
  formData.configuration = {
    publishingInterval: undefined,
    maxNotificationsPerPublish: undefined,
    priority: undefined,
  }
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
</script>

<style></style>
