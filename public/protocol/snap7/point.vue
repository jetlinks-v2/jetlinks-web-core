<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <a-form-item :label="$lang('snap7.point.20250207-1')" :name="['configuration', 'daveArea']" :rules="{
        required: true,
        message: $lang('snap7.point.20250207-2'),
        trigger: 'change',
      }">
        <a-select v-model:value="formData.configuration.daveArea" show-search
          :placeholder="$lang('snap7.point.20250207-2')" :options="dataAreaFilterList"
          :fieldNames="{ label: 'name', value: 'id' }" @change="daveAreaChange">
        </a-select>
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <a-form-item :label="$lang('snap7.point.20250207-5')" :name="['configuration', 'type']" :rules="{
        required: isString,
        message: $lang('snap7.point.20250207-6'),
        trigger: 'change',
      }">
        <a-row :gutter="24">
          <a-col v-if="isString" flex="1">
            <a-select v-model:value="formData.configuration.type" show-search :placeholder="$lang('snap7.point.20250207-6')"
              :options="dataTypesList" :fieldNames="{ label: 'name', value: 'id' }" @change="chooseS7DataType">
            </a-select>
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
    <a-col :span="12">
      <a-form-item :label="$lang('snap7.point.20250207-3')" :name="['configuration', 'areaNumber']" :rules="{
        required: true,
        message: $lang('snap7.point.20250207-4'),
        trigger: 'blur',
      }">
        <a-input-number v-model:value="formData.configuration.areaNumber" style="width: 100%" :max="65535"
          autocomplete="off" :disabled="areaNumberDisabled" :placeholder="$lang('snap7.point.20250207-4')" />
      </a-form-item>
    </a-col>
    <a-col v-if="!showBytes" :span="12">
      <a-form-item :label="$lang('snap7.point.20250207-7')" :name="['configuration', 'bytes']" :rules="{
        required: true,
        message: $lang('snap7.point.20250207-8'),
        trigger: 'blur',
      }">
        <a-input-number type="number" style="width: 100%" :addon-after="$lang('snap7.point.20250207-32')"
          v-model:value="formData.configuration.bytes" :placeholder="$lang('snap7.point.20250207-9')" :precision="0"
          :controls="false" :disabled="showBytes" :max="65535" :min="0" />
      </a-form-item>
    </a-col>
    <a-col v-if="formData.configuration.type === 'Bool'" :span="12">
      <a-form-item :label="$lang('snap7.point.20250207-10')" :name="['configuration', 'bits']" :rules="{
        required: true,
        message: $lang('snap7.point.20250207-11'),
        trigger: 'blur',
      }">
        <a-input-number type="number" style="width: 100%" :addon-after="$lang('snap7.point.20250207-29')"
          v-model:value="formData.configuration.bits" :placeholder="$lang('snap7.point.20250207-12')" :precision="0"
          :min="0" :max="7" :controls="false" />
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <a-form-item :label="$lang('snap7.point.20250207-13')" :name="['configuration', 'offset']" :rules="{
        required: true,
        message: $lang('snap7.point.20250207-14'),
        trigger: 'blur',
      }">
        <a-input-number type="number" style="width: 100%" v-model:value="formData.configuration.offset"
          :placeholder="$lang('snap7.point.20250207-15')" :precision="0" :min="0" :max="65535" :controls="false" />
      </a-form-item>
    </a-col>
  </a-row>
</template>
<script setup>
import { inject, ref, computed, toRaw, watch } from 'vue'
import { request } from '@jetlinks-web/core'
import { randomString } from "@jetlinks-web/utils";
import { useLocales } from '@hooks'

const { $lang } = useLocales('snap7')

const defaultValue = {
  type: undefined,
  interval: 3000,
  areaNumber: undefined,
  bytes: undefined,
  terms: [],
}

const formData = inject('plugin-form', {})
const collectorData = inject('point-form-collector', {})
const showDeathArea = inject('plugin-form-death-area-show', ref(false))
const codecList = inject('codec-list', ref([]))
const isString = ref(false)

Object.keys(defaultValue).forEach(key => {
  if (!toRaw(formData.configuration).hasOwnProperty(key)) {
    formData[key] = defaultValue[key]
  }
})


if (!('pointKey' in formData)) {
  formData.pointKey = randomString(9)
}
if (!('inheritBreaker' in formData)) {
  formData.inheritBreaker = true
}

if (!('scaleFactor' in formData.configuration)) {
  formData.configuration.scaleFactor = 1
}

const deviceType = ref(collectorData.configuration?.type);
const dataTypesList = ref([]);
const daveAreaList = ref([]);

const events = inject('point-metadata-events')

const accessModesOptions = computed(() => {
  return [
    { label: $lang('snap7.point.20250207-30'), value: 'read' },
    { label: $lang('snap7.point.20250207-31'), value: 'write' },
  ]
})

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
};

const dataAreaFilterList = computed(() => {
  let result = daveAreaList.value.filter((item) =>
    dataAreaFilter[deviceType.value]?.includes(item.id),
  );
  if (deviceType.value === 'S200') {
    result.push({
      id: 'DB',
      name: $lang('snap7.point.20250207-28'),
      address: '',
    });
  }
  return result;
});

// const showAreaNumber = computed(() => formData.configuration.daveArea === 'DB')

const areaNumberDisabled = computed(() => {
  return formData.configuration.daveArea === 'DB' && deviceType.value === 'S200'
})

const daveAreaChange = (val) => {
  formData.configuration.areaNumber = val === 'DB' ? 1 : 0;
}

const showBytes = ref(false)

const chooseS7DataType = (val, option) => {
  formData.configuration.bytes = option.length;
  showBytes.value = option.length !== 0;
};

const onDataTypeChange = () => {
  formData.configuration.type = undefined;
}

/**
 * 获取地区信息
 */
const getAreaList = async () => {
  const res = await request.post('/data-collect/snap7/command/GetAreaInfoList');
  if (res.success) {
    daveAreaList.value = res.result;
  }
};
getAreaList();

/**
 * 获取数据编解码器
 */
const getTypes = async () => {
  const res = await request.post('/data-collect/snap7/command/GetCodecList');
  if (res.success) {
    dataTypesList.value = res.result;
  }
};

watch(() => formData.configuration.type, (val) => {
  showDeathArea.value = val && ['Word', 'DWord', 'USInt', 'Byte', 'SInt', 'UInt', 'Int', 'UDInt', 'DInt', 'Real', 'LReal'].includes(val)
}, {
  immediate: true,
})

getTypes();

watch(() => formData.configuration, (val) => {
  events?.pointMetadataEvents?.(formData.provider, {configuration: formData.configuration})
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
</script>
<style scoped></style>
