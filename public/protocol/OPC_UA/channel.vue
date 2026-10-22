<template>
  <a-form-item
      :label="$lang('OPC_UA.channel.20250207-1')"
      :name="['configuration', 'endpoint']"
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
  >
    <a-input
        v-model:value="formData.configuration.endpoint"
        :placeholder="$lang('OPC_UA.channel.20250207-2')"
    />
  </a-form-item>

  <a-form-item
      :label="$lang('OPC_UA.channel.20250207-3')"
      :name="['configuration', 'securityPolicy']"
      :rules="[
        {
          required: true,
          message: $lang('OPC_UA.channel.20250207-4'),
        },
      ]"
  >
    <a-select
        v-model:value="formData.configuration.securityPolicy"
        style="width: 100%"
        allow-clear
        show-search
        :options="securityPolicyOptions"
        :placeholder="$lang('OPC_UA.channel.20250207-4')"
        :filter-option="filterOption"
    />
  </a-form-item>

  <a-form-item
      :label="$lang('OPC_UA.channel.20250207-5')"
      :name="['configuration', 'securityMode']"
      :rules="[
        {
          required: true,
          message: $lang('OPC_UA.channel.20250207-6'),
        },
      ]"
  >
    <a-select
        v-model:value="formData.configuration.securityMode"
        style="width: 100%"
        allow-clear
        show-search
        :options="securityModeOptions"
        :placeholder="$lang('OPC_UA.channel.20250207-6')"
        :filter-option="filterOption"
    />
  </a-form-item>

  <a-form-item
      v-if="isSecurityMode"
      :label="$lang('OPC_UA.channel.20250207-16')"
      :name="['configuration', 'certId']"
      :rules="[
        {
          required: true,
          message: $lang('OPC_UA.channel.20250207-17'),
        },
      ]"
  >
    <a-select
        v-model:value="formData.configuration.certId"
        style="width: 100%"
        allow-clear
        show-search
        :options="certificateList"
        :placeholder="$lang('OPC_UA.channel.20250207-17')"
        :filter-option="filterOption"
    />
  </a-form-item>

  <a-form-item
      :label="$lang('OPC_UA.channel.20250207-7')"
      :name="['configuration', 'authType']"
      :rules="[
        {
          required: true,
          message: $lang('OPC_UA.channel.20250207-14'),
        },
      ]"
  >
    <j-card-select
        v-model:value="formData.configuration.authType"
        :placeholder="$lang('OPC_UA.channel.20250207-14')"
        :options="authOptions"
        :column="2"
        @change="onAuthTypeChange"
    />
  </a-form-item>

  <a-form-item
      v-if="formData.configuration.authType === 'username'"
      :label="$lang('OPC_UA.channel.20250207-10')"
      :name="['configuration', 'username']"
      :rules="[
        { required: true, message: $lang('OPC_UA.channel.20250207-11'), trigger: 'blur' },
        { max: 64, message: $lang('OPC_UA.channel.20250207-15') },
      ]"
  >
    <a-input
        v-model:value="formData.configuration.username"
        :placeholder="$lang('OPC_UA.channel.20250207-11')"
        autocomplete="off"
    />
  </a-form-item>

  <a-form-item
      v-if="formData.configuration.authType === 'username'"
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
    />
  </a-form-item>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import { request } from '@jetlinks-web/core'
import { useLocales } from '@hooks'

const formData = inject('plugin-form')
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

const filterOption = (input, option) => {
  return option?.value?.toLowerCase?.().includes(input.toLowerCase())
}

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

const onAuthTypeChange = () => {
  formData.configuration.username = undefined
  formData.configuration.password = undefined
}

watch(
  () => formData.configuration.securityMode,
  (val) => {
    if ((val === 'SignAndEncrypt' || val === 'Sign') && !certificateList.value.length) {
      getCertificateList()
    }
    if (val !== 'SignAndEncrypt' && val !== 'Sign') {
      formData.configuration.certId = undefined
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
