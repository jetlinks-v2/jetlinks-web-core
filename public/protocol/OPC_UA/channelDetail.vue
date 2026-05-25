<template>
  <a-row :gutter="[24, 24]">
    <a-col :span="12">
      <FormItemEditable
          type="string"
          v-model:value="formData.configuration.endpoint"
          :name="['configuration', 'endpoint']"
          :componentProps="{
            placeholder: $lang('OPC_UA.channel.20250207-2')
          }"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.channel.20250207-2'),
            },
            {
              validator: checkEndpoint,
              trigger: 'blur',
            },
          ]"
          @change="(val) => onChange(['configuration', 'endpoint'], val)"
      >
        <template #label>
          {{ $lang('OPC_UA.channel.20250207-1') }}
        </template>
      </FormItemEditable>
    </a-col>

    <a-col :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.channel.20250207-3')"
          :name="['configuration', 'securityPolicy']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.channel.20250207-4'),
            },
          ]"
          type="select"
          :componentProps="{
            placeholder: $lang('OPC_UA.channel.20250207-4'),
            options: securityPolicyOptions,
          }"
          v-model:value="formData.configuration.securityPolicy"
          @change="(val) => onChange(['configuration', 'securityPolicy'], val)"
      />
    </a-col>

    <a-col :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.channel.20250207-5')"
          :name="['configuration', 'securityMode']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.channel.20250207-6'),
            },
          ]"
          type="select"
          :componentProps="{
            placeholder: $lang('OPC_UA.channel.20250207-6'),
            options: securityModeOptions,
          }"
          v-model:value="formData.configuration.securityMode"
          @change="onSecurityModeChange"
      />
    </a-col>

    <a-col v-if="isSecurityMode" :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.channel.20250207-16')"
          :name="['configuration', 'certId']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.channel.20250207-17'),
            },
          ]"
          type="select"
          :componentProps="{
            placeholder: $lang('OPC_UA.channel.20250207-17'),
            options: certificateList,
          }"
          v-model:value="formData.configuration.certId"
          @change="(val) => onChange(['configuration', 'certId'], val)"
      />
    </a-col>

    <a-col :span="12">
      <FormItemEditable
          :label="$lang('OPC_UA.channel.20250207-7')"
          :name="['configuration', 'authType']"
          :rules="[
            {
              required: true,
              message: $lang('OPC_UA.channel.20250207-14'),
            },
          ]"
          type="select"
          :componentProps="{
            placeholder: $lang('OPC_UA.channel.20250207-14'),
            options: authOptions,
          }"
          v-model:value="formData.configuration.authType"
          @change="onAuthTypeChange"
      />
    </a-col>

    <a-col v-if="formData.configuration.authType === 'username'" :span="12">
      <FormItemEditable
          type="string"
          v-model:value="formData.configuration.username"
          :name="['configuration', 'username']"
          :label="$lang('OPC_UA.channel.20250207-10')"
          :componentProps="{
            placeholder: $lang('OPC_UA.channel.20250207-11')
          }"
          :rules="[
            { required: true, message: $lang('OPC_UA.channel.20250207-11'), trigger: 'blur' },
            { max: 64, message: $lang('OPC_UA.channel.20250207-15') },
          ]"
          @change="(val) => onChange(['configuration', 'username'], val)"
      />
    </a-col>

    <a-col v-if="formData.configuration.authType === 'username'" :span="12">
      <a-form-item
          :label="$lang('OPC_UA.channel.20250207-12')"
          :name="['configuration', 'password']"
          :rules="[
            { required: true, message: $lang('OPC_UA.channel.20250207-13'), trigger: 'blur' },
            { max: 64, message: $lang('OPC_UA.channel.20250207-15') },
          ]"
      >
        <a-input-password
            v-model:value="formData.configuration.password"
            :placeholder="$lang('OPC_UA.channel.20250207-13')"
            autocomplete="off"
            @blur="() => onChange(['configuration', 'password'], formData.configuration.password)"
        />
      </a-form-item>
    </a-col>
  </a-row>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import { request } from '@jetlinks-web/core'
import { useLocales } from '@hooks'

const formData = inject('plugin-channel-detail-form')
const events = inject('plugin-channel-detail-events')
const { $lang } = useLocales('OPC_UA')

const securityPolicyOptions = ref([])
const securityModeOptions = ref([])
const certificateList = ref([])

if (!('configuration' in formData)) {
  formData.configuration = {
    endpoint: undefined,
    securityPolicy: undefined,
    securityMode: undefined,
    certId: undefined,
    authType: undefined,
    username: undefined,
    password: undefined,
  }
}

if (!('endpoint' in formData.configuration)) {
  formData.configuration.endpoint = undefined
}

if (!('securityPolicy' in formData.configuration)) {
  formData.configuration.securityPolicy = undefined
}

if (!('securityMode' in formData.configuration)) {
  formData.configuration.securityMode = undefined
}

if (!('certId' in formData.configuration)) {
  formData.configuration.certId = undefined
}

if (!('authType' in formData.configuration)) {
  formData.configuration.authType = undefined
}

if (!('username' in formData.configuration)) {
  formData.configuration.username = undefined
}

if (!('password' in formData.configuration)) {
  formData.configuration.password = undefined
}

const authOptions = computed(() => [
  { label: $lang('OPC_UA.channel.20250207-9'), value: 'anonymous' },
  { label: $lang('OPC_UA.channel.20250207-10'), value: 'username' },
])

const isSecurityMode = computed(() => {
  const { securityMode } = formData.configuration
  return securityMode === 'SignAndEncrypt' || securityMode === 'Sign'
})

const checkEndpoint = (_rule, value) =>
  new Promise((resolve, reject) => {
    if (!value) {
      resolve('')
      return
    }
    request
      .post('/data-collect/OPC_UA/command/HandleEndpointValidate', { endpoint: value })
      .then((resp) => {
        resp?.result?.passed ? resolve('') : reject(resp?.result?.reason || $lang('OPC_UA.channel.20250207-18'))
      })
      .catch((err) => {
        reject(err?.message || $lang('OPC_UA.channel.20250207-18'))
      })
  })

const getSecurityPolicies = () => {
  request.post('/data-collect/OPC_UA/command/QuerySecurityPolicies', {}).then((resp) => {
    securityPolicyOptions.value = (resp?.result || []).map((item) => ({
      label: item,
      value: item,
    }))
  })
}

const getSecurityModes = () => {
  request.post('/data-collect/OPC_UA/command/QuerySecurityModes', {}).then((resp) => {
    securityModeOptions.value = (resp?.result || []).map((item) => ({
      label: item,
      value: item,
    }))
  })
}

const getCertificateList = () => {
  request.get('/network/certificate/_query/no-paging?paging=false', {}).then((resp) => {
    certificateList.value = (resp?.result || []).map((item) => ({
      label: item.name,
      value: item.id,
    }))
  })
}

const onChange = (name, value) => {
  events?.onValueChange?.([
    {
      name,
      value,
    },
  ])
}

const onAuthTypeChange = (val) => {
  formData.configuration.username = undefined
  formData.configuration.password = undefined
  onChange(['configuration', 'authType'], val)
  onChange(['configuration', 'username'], undefined)
  onChange(['configuration', 'password'], undefined)
}

const onSecurityModeChange = (val) => {
  if ((val === 'SignAndEncrypt' || val === 'Sign') && !certificateList.value.length) {
    getCertificateList()
  }
  if (val !== 'SignAndEncrypt' && val !== 'Sign') {
    formData.configuration.certId = undefined
    onChange(['configuration', 'certId'], undefined)
  }
  onChange(['configuration', 'securityMode'], val)
}

watch(
  () => formData.configuration.securityMode,
  (val) => {
    if ((val === 'SignAndEncrypt' || val === 'Sign') && !certificateList.value.length) {
      getCertificateList()
    }
  },
  {
    immediate: true,
  },
)

getSecurityPolicies()
getSecurityModes()
</script>

<style></style>
