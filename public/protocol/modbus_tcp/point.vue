<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <a-form-item
          label="配置类型"
          :name="['configuration', 'type']"
          :rules="[
            {
              required: true,
              message: $lang('MODBUS_TCP.point.20250207-2')
            },
          ]"
      >
        <a-radio-group v-model:value="formData.configuration.type">
          <a-space>
            <a-radio-button value="function">功能码+地址</a-radio-button>
            <a-radio-button value="plc">PLC地址</a-radio-button>
          </a-space>
        </a-radio-group>
      </a-form-item>
    </a-col>
    <a-col :span="12" v-if="formData.configuration.type === 'function'">
      <a-form-item
          :label="$lang('MODBUS_TCP.point.20250207-1')"
          :name="['configuration', 'function']"
          :rules="[
            {
              required: true,
              message: $lang('MODBUS_TCP.point.20250207-2')
            },
          ]"
      >
        <a-select
            style="width: 100%"
            v-model:value="formData.configuration.function"
            :options="[
              { label: $lang('MODBUS_TCP.point.20250207-24'), value: 'Coils' },
              { label: $lang('MODBUS_TCP.point.20250207-25'), value: 'DiscreteInputs' },
              { label: $lang('MODBUS_TCP.point.20250207-26'), value: 'HoldingRegisters' },
              { label: $lang('MODBUS_TCP.point.20250207-27'), value: 'InputRegisters' },
            ]"
            :placeholder="$lang('MODBUS_TCP.point.20250207-2')"
            allowClear show-search
            :filter-option="filterOption"
        />
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <a-form-item
          :label="$lang('MODBUS_TCP.point.20250207-3')"
          :name="['configuration', 'parameter', 'address']"
          validate-first
          :rules="[
        {
          required: true,
          message: $lang('MODBUS_TCP.point.20250207-4'),
        },
        {
          validator: checkPointKey,
          trigger: 'blur',
        },
      ]"
      >
        <a-input-number
            v-model:value="formData.configuration.parameter.address"
            :controls="false"
            :max="255"
            :min="0"
            :precision="0"
            :placeholder="$lang('MODBUS_TCP.point.20250207-4')"
            style="width: 100%"
        />
        <!--        <p v-show="plcFormat" style="margin: 10px 0; color: #616161">-->
        <!--          PLC{{ $lang('MODBUS_TCP.point.20250207-3') }}：{{ formData.pointKey !== undefined ? plcFormat : '' }}-->
        <!--        </p>-->
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <a-form-item
          :name="['configuration', 'parameter', 'quantity']"
          :rules="[
            {
              required: true,
              message: $lang('MODBUS_TCP.point.20250207-9')
            },
            {
              pattern: new RegExp(/^\d+$/),
              message: $lang('MODBUS_TCP.point.20250207-10')
            },
          ]"
          :label="$lang('MODBUS_TCP.point.20250207-8')"
      >
        <a-input-number
            v-model:value="formData.configuration.parameter.quantity"
            :controls="false"
            :max="65535"
            :min="1"
            :precision="0"
            :placeholder="$lang('MODBUS_TCP.point.20250207-9')"
            style="width: 100%"
        />
      </a-form-item>
    </a-col>
    <template v-if="showWriteByteConfig">
      <a-col :span="24">
        <a-form-item
            style="
            display: flex;
            flex-direction: row;
            align-items: center;
            margin: 0;
        "
        >
          <a-form-item-rest>
            <span>{{ $lang('MODBUS_TCP.point.20250207-15') }}</span>
          </a-form-item-rest>
          <a-switch v-model:checked="writeByteConfig" style="margin-left: 20px"/>
        </a-form-item>
      </a-col>
      <template v-if="writeByteConfig">
        <a-col :span="12">
          <a-form-item :name="['configuration', 'parameter', 'writeByteCount']"
                       :rules="[
    {
      required: true,
      message: $lang('MODBUS_TCP.point.20250207-16')
    },
  ]" :label="$lang('MODBUS_TCP.point.20250207-17')">
            <a-radio-group v-model:value="formData.configuration.parameter.writeByteCount">
              <a-space>
                <a-radio-button :value="true">{{ $lang('MODBUS_TCP.point.20250207-18') }}</a-radio-button>
                <a-radio-button :value="false">{{ $lang('MODBUS_TCP.point.20250207-19') }}</a-radio-button>
              </a-space>
            </a-radio-group>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item
              v-if="writeByteConfig"
              :name="['configuration', 'parameter', 'byteCount']"
              :rules="[
          {
            required: true,
            message: $lang('MODBUS_TCP.point.20250207-20')
          },
        ]"
              :label="$lang('MODBUS_TCP.point.20250207-21')"
          >
            <a-input
                :placeholder="$lang('MODBUS_TCP.point.20250207-20')"
                v-model:value="formData.configuration.parameter.byteCount"/>
          </a-form-item>
        </a-col>
      </template>
    </template>
  </a-row>
</template>
<script setup>
import {computed, inject, ref, watch} from 'vue'
import {request} from '@jetlinks-web/core'
import {useLocales} from '@hooks'

const {$lang} = useLocales('modbus_tcp')
const formData = inject('plugin-form', {
  accessModes: [],
  pointKey: undefined,
})

const collectorData = inject('plugin-form-collector', {})
const showDeathArea = inject('plugin-form-death-area-show', ref(false))

const writeByteConfig = ref(false);

if (!('configuration' in formData)) {
  formData.configuration = {
    type: 'function',
    function: undefined,
    parameter: {
      quantity: 1,
      writeByteCount: undefined,
      byteCount: undefined,
      address: undefined,
    },
  }
}

if (!('parameter' in formData.configuration)) {
  formData.configuration.parameter = {
    quantity: 1,
    writeByteCount: undefined,
    byteCount: undefined,
    address: undefined,
  }
}

if (!('type' in formData.configuration)) {
  formData.configuration.type = 'function'
}

if (!('accessModes' in formData)) {
  formData.accessModes = []
}

const oldPointKey = formData.pointKey;

const filterOption = (input, option) => {
  return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};

function checkPointKey(_rule, value) {
  return new Promise(async (resolve, reject) => {
    if (value || value === 0) {
      const reg = new RegExp(/^\d+$/)
      if (!reg.test(value)) {
        return reject($lang('MODBUS_TCP.point.20250207-29'))
      }
      if (Number(oldPointKey) === Number(value)) return resolve('');
      if (typeof value === 'object') return resolve('');
      const res = await request.get(`/data-collect/point/${collectorData.id || formData.collectorId}/_validate`, {
        pointKey: value,
      });
      return res.result?.passed ? resolve('') : reject(res.result.reason);
    } else {
      return reject($lang('MODBUS_TCP.point.20250207-4'));
    }
  });
}


const plcFormat = computed(() => {
  let result = parseInt(formData.pointKey);
  switch (formData.configuration.function) {
    case 'Coils':
      result += 1;
      break;
    case 'HoldingRegisters':
      result += 40001;
      break;
    case 'InputRegisters':
      result += 30001;
      break;
  }
  return result ?? undefined;
});

const showWriteByteConfig = computed(() => formData.configuration.function === 'HoldingRegisters')

watch(
    () => writeByteConfig.value,
    (val) => {
      if (
          val && !formData.configuration.parameter.byteCount && formData.configuration.parameter.quantity
      ) {
        formData.configuration.parameter.byteCount = formData.configuration.parameter.quantity * 2;
      }
    },
    {
      immediate: true
    }
);

watch(
    () => formData.configuration.parameter?.byteCount,
    () => {
      if (formData.configuration.parameter?.byteCount) {
        writeByteConfig.value = true;
      }
    },
    {deep: true, immediate: true},
);

watch(() => formData.configuration.codec?.provider, (val) => {
  showDeathArea.value = val && ['int8', 'int16', 'int32', 'int64', 'ieee754_float', 'ieee754_double'].includes(val) && !['Coils', 'DiscreteInputs'].includes(formData.configuration.function)
}, {
  immediate: true,
})
</script>
<style></style>
