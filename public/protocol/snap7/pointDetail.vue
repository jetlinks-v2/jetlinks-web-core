<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('snap7.point.20250207-1')"
          :name="['configuration', 'daveArea']"
          :rules="[
            {
              required: true,
              message: $lang('snap7.point.20250207-2'),
              trigger: 'change',
            },
          ]"
          v-model:value="formData.configuration.daveArea"
          :componentProps="{
            placeholder: $lang('snap7.point.20250207-2'),
            options: dataAreaOptions,
            showSearch: true,
            filterOption,
          }"
          type="select"
          @change="onDaveAreaChange"
      />
    </a-col>
    <a-col :span="12">
      <a-form-item :label="$lang('snap7.point.20250207-5')" :name="['configuration', 'type']" :rules="{
        required: isString,
        message: $lang('snap7.point.20250207-6'),
        trigger: 'change',
      }">
        <a-row :gutter="24">
          <a-col v-if="isString" flex="1">
            <Editable v-model:value="formData.configuration.type" type="select"
              :componentProps="{
                placeholder: $lang('snap7.point.20250207-6'),
                options: dataTypeOptions,
                showSearch: true,
                filterOption,
              }"
              @change="onTypeChange">
            </Editable>
          </a-col>
          <a-col flex="120px">
            <a-form-item-rest>
              <a-space style="height: 100%;" align="center">
                <span>字符串</span>
                <a-switch v-model:checked="isString" @change="onDataTypeChange"></a-switch>
              </a-space>
            </a-form-item-rest>
          </a-col>
        </a-row>
      </a-form-item>   
    </a-col>
    <a-col :span="12" v-show="showAreaNumber">
      <FormItemEditable
          :label="$lang('snap7.point.20250207-3')"
          :name="['configuration', 'areaNumber']"
          :rules="[
            {
              required: showAreaNumber,
              message: $lang('snap7.point.20250207-4'),
              trigger: 'blur',
            },
          ]"
          v-model:value="formData.configuration.areaNumber"
          :componentProps="{
            placeholder: $lang('snap7.point.20250207-4'),
            min: 0,
            max: 65535,
            precision: 0,
            disabled: areaNumberDisabled,
          }"
          type="number"
          @change="(val) => onChange(['configuration', 'areaNumber'], val)"
      />
    </a-col>
    <a-col :span="12" v-if="showBytes">
      <FormItemEditable
          :label="$lang('snap7.point.20250207-7')"
          :name="['configuration', 'bytes']"
          :rules="[
            {
              required: true,
              message: $lang('snap7.point.20250207-8'),
              trigger: 'blur',
            },
          ]"
          v-model:value="formData.configuration.bytes"
          :componentProps="{
            placeholder: $lang('snap7.point.20250207-9'),
            min: 0,
            max: 65535,
            precision: 0,
            controls: false,
            addonAfter: $lang('snap7.point.20250207-32'),
          }"
          type="number"
          @change="(val) => onChange(['configuration', 'bytes'], val)"
      />
    </a-col>
    <a-col :span="12" v-if="formData.configuration.type === 'Bool'">
      <FormItemEditable
          :label="$lang('snap7.point.20250207-10')"
          :name="['configuration', 'bits']"
          :rules="[
            {
              required: true,
              message: $lang('snap7.point.20250207-11'),
              trigger: 'blur',
            },
          ]"
          v-model:value="formData.configuration.bits"
          :componentProps="{
            placeholder: $lang('snap7.point.20250207-12'),
            min: 0,
            max: 7,
            precision: 0,
            controls: false,
            addonAfter: $lang('snap7.point.20250207-29'),
          }"
          type="number"
          @change="(val) => onChange(['configuration', 'bits'], val)"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('snap7.point.20250207-13')"
          :name="['configuration', 'offset']"
          :rules="[
            {
              required: true,
              message: $lang('snap7.point.20250207-14'),
              trigger: 'blur',
            },
          ]"
          v-model:value="formData.configuration.offset"
          :componentProps="{
            placeholder: $lang('snap7.point.20250207-15'),
            min: 0,
            max: 65535,
            precision: 0,
            controls: false,
          }"
          type="number"
          @change="(val) => onChange(['configuration', 'offset'], val)"
      />
    </a-col>
  </a-row>
</template>

<script setup>
import { computed, inject, ref, toRaw, watch } from 'vue'
import { request } from '@jetlinks-web/core'
import { useLocales } from '@hooks'

const { $lang } = useLocales('snap7')

const formData = inject('plugin-form', {})
const events = inject('plugin-detail-save-events')
const metadataEvents = inject('point-metadata-events')
const pointCollector = inject('point-form-collector', {})
const collectorData = inject('collector-data', ref({}))
const codecList = inject('codec-list', ref([]))

const defaultConfiguration = {
  daveArea: undefined,
  type: undefined,
  areaNumber: undefined,
  bytes: undefined,
  bits: undefined,
  offset: undefined,
  interval: 3000,
  terms: [],
}

if (!('configuration' in formData)) {
  formData.configuration = {}
}

const isString = ref(!!formData.configuration.type)

Object.keys(defaultConfiguration).forEach((key) => {
  if (!toRaw(formData.configuration).hasOwnProperty(key)) {
    formData.configuration[key] = defaultConfiguration[key]
  }
})

if (!('scaleFactor' in formData.configuration)) {
  formData.configuration.scaleFactor = 1
}

const dataTypesList = ref([])
const daveAreaList = ref([])

const dataAreaFilter = {
  S200: [
    'RELAY',
    'HIGH_SPEED',
    'SYSTEM_FLAGS',
    'ANALOG_INPUTS',
    'ANALOG_OUTPUTS',
    'I',
    'Q',
    'M',
    'IEC_COUNTERS',
    'IEC_TIMERS',
  ],
  S1200: ['I', 'Q', 'M', 'DB'],
  S1500: ['I', 'Q', 'M', 'DB'],
  S300: ['I', 'Q', 'M', 'DB', 'C', 'T'],
  S400: ['I', 'Q', 'M', 'DB', 'C', 'T'],
}

const collectorValue = computed(() => {
  return pointCollector?.value || collectorData?.value || pointCollector || collectorData || {}
})

const deviceType = computed(() => {
  return formData.deviceType ||
      formData.collectorConfiguration?.type ||
      collectorValue.value?.configuration?.type ||
      collectorValue.value?.deviceType
})

const dataAreaOptions = computed(() => {
  const currentDeviceType = deviceType.value
  let result = daveAreaList.value

  if (currentDeviceType && dataAreaFilter[currentDeviceType]) {
    result = daveAreaList.value.filter((item) => dataAreaFilter[currentDeviceType].includes(item.id))
  }

  if (currentDeviceType === 'S200') {
    result = [
      ...result,
      {
        id: 'DB',
        name: $lang('snap7.point.20250207-28'),
        address: '',
      },
    ]
  }

  if (
      formData.configuration.daveArea &&
      !result.some((item) => item.id === formData.configuration.daveArea)
  ) {
    result = [
      ...result,
      {
        id: formData.configuration.daveArea,
        name: formData.configuration.daveArea,
      },
    ]
  }

  return result.map((item) => ({
    label: item.name,
    value: item.id,
  }))
})

const dataTypeOptions = computed(() => {
  return dataTypesList.value.map((item) => ({
    label: item.name,
    value: item.id,
    length: item.length,
  }))
})

const currentType = computed(() => {
  return dataTypeOptions.value.find((item) => item.value === formData.configuration.type)
})

const showAreaNumber = computed(() => formData.configuration.daveArea === 'DB')

const areaNumberDisabled = computed(() => {
  return formData.configuration.daveArea === 'DB' && deviceType.value === 'S200'
})

const showBytes = computed(() => {
  return !currentType.value || currentType.value.length === 0
})

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

const onDaveAreaChange = (val) => {
  formData.configuration.areaNumber = val === 'DB' ? 1 : 0
  onChange(['configuration', 'daveArea'], val)
}

const onTypeChange = (val) => {
  const option = dataTypeOptions.value.find((item) => item.value === val)
  if (option) {
    formData.configuration.bytes = option.length
  }
  if (val !== 'Bool') {
    formData.configuration.bits = undefined
  }
  onChange(['configuration', 'type'], val)
}

const onDataTypeChange = (val) => {
  formData.configuration.type = undefined;
  onChange(['configuration', 'type'], undefined)
}

const getAreaList = async () => {
  const res = await request.post('/data-collect/snap7/command/GetAreaInfoList')
  if (res.success) {
    daveAreaList.value = res.result || []
  }
}

const getTypes = async () => {
  const res = await request.post('/data-collect/snap7/command/GetCodecList')
  if (res.success) {
    dataTypesList.value = res.result || []
  }
}

watch(() => formData.configuration, (val) => {
  metadataEvents?.pointMetadataEvents?.(formData.provider, {configuration: formData.configuration})
}, {
  immediate: true,
  deep: true
})

watch(() => formData.managedConfiguration.codec, (val) => {
  if(!formData.configuration.type && val) {
    const codec = codecList.value.find(item => item.value === val)
    formData.configuration.codec = codec?.id
  } else {
    formData.configuration.codecType = undefined
  }
}, {
  immediate: true,
  deep: true
})

getAreaList()
getTypes()
</script>

<style></style>
