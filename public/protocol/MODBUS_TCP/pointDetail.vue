<template>
  <a-row :gutter="24">
    <a-col :span="12">
      <FormItemEditable
          label="配置类型"
          :name="['configuration', 'unitId']"
          :rules="[
              {required: true, message: '请选择配置类型'},
            ]"
          v-model:value="formData.configuration.unitId"
          :componentProps="{
            placeholder: $lang('MODBUS_TCP.collector.20250207-2'),
            options: [
              { label: '功能码+地址', value: '1' },
              { label: 'PLC地址', value: '2' },
            ]
          }"
          type="select"
          @change="onChange"
      />
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('MODBUS_TCP.point.20250207-1')"
          :name="['configuration', 'function']"
          :rules="[
            {required: true, message: $lang('MODBUS_TCP.point.20250207-2')},
          ]"
          type="select"
          v-model:value="formData.configuration.function"
          :componentProps="{
            placeholder: $lang('MODBUS_TCP.point.20250207-2'),
            options: [
              { label: $lang('MODBUS_TCP.point.20250207-24'), value: 'Coils' },
              { label: $lang('MODBUS_TCP.point.20250207-25'), value: 'DiscreteInputs' },
              { label: $lang('MODBUS_TCP.point.20250207-26'), value: 'HoldingRegisters' },
              { label: $lang('MODBUS_TCP.point.20250207-27'), value: 'InputRegisters' },
            ]
          }"
          @change="functionChange"
      >
      </FormItemEditable>
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :label="$lang('MODBUS_TCP.point.20250207-3')"
          :name="['pointKey']"
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
          type="number"
          v-model:value="formData.pointKey"
          :componentProps="{
            placeholder: $lang('MODBUS_TCP.point.20250207-4'),
            max: 255,
            min: 0,
            precision: 0,
            controls: false
          }"
          @change="onChange"
      >
      </FormItemEditable>
    </a-col>
    <a-col :span="12">
      <FormItemEditable
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
          type="number"
          v-model:value="formData.configuration.parameter.quantity"
          :componentProps="{
            placeholder: $lang('MODBUS_TCP.point.20250207-9'),
            max: 65535,
            min: 0,
            precision: 0,
            controls: false
          }"
          @change="onChange"
      >
      </FormItemEditable>
    </a-col>
  </a-row>
  <div v-if="showWriteByteConfig">
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
  </div>
  <a-row v-if="writeByteConfig">
    <a-col :span="12">
      <FormItemEditable
          :name="['configuration', 'parameter', 'writeByteCount']"
          :rules="[
      {
        required: true,
        message: $lang('MODBUS_TCP.point.20250207-16')
      },
    ]" :label="$lang('MODBUS_TCP.point.20250207-17')"
          type="select"
          v-model:value="formData.configuration.parameter.writeByteCount"
          :componentProps="{
            placeholder: $lang('MODBUS_TCP.point.20250207-2'),
            options: [
              { label: $lang('MODBUS_TCP.point.20250207-18'), value: true },
              { label: $lang('MODBUS_TCP.point.20250207-19'), value: false }
            ]
          }"
          @change="functionChange"
      >
      </FormItemEditable>
    </a-col>
    <a-col :span="12">
      <FormItemEditable
          :name="['configuration', 'parameter', 'byteCount']"
          :rules="[
            {
              required: true,
              message: $lang('MODBUS_TCP.point.20250207-20')
            },
          ]"
          :label="$lang('MODBUS_TCP.point.20250207-21')"
          type="string"
          v-model:value="formData.configuration.parameter.byteCount"
          :componentProps="{
            placeholder: $lang('MODBUS_TCP.point.20250207-20'),
          }"
          @change="functionChange"
      >
      </FormItemEditable>
    </a-col>
  </a-row>
</template>
<script setup>
import {useLocales} from '@hooks'
import {computed, inject, ref, watch} from "vue";
import {request} from "@jetlinks-web/core";

const {$lang} = useLocales('MODBUS_TCP')

const formData = inject('plugin-point-detail-form', {})
const events = inject("plugin-point-detail-events");

const oldPointKey = formData.pointKey;

if (!('configuration' in formData)) {
  formData.configuration = {
    function: undefined,
    interval: 3000,
    parameter: {
      quantity: 1,
      writeByteCount: undefined,
      byteCount: undefined,
      address: undefined,
    },
    codec: {
      provider: undefined,
      configuration: {
        scaleFactor: 1,
        scale: undefined,
      },
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

if (!('codec' in formData.configuration)) {
  formData.configuration.codec = {
    provider: undefined,
    configuration: {
      scaleFactor: 1,
      scale: undefined,
    },
  }
}

if (!('pointKey' in formData)) {
  formData.pointKey = undefined
}

if (!('accessModes' in formData)) {
  formData.accessModes = []
}
const writeByteConfig = ref(false);

const showWriteByteConfig = computed(() => true
    // formData.configuration.function === 'HoldingRegisters' && formData.accessModes.includes('write')
)

const onChange = () => {
  events.onValueChange('configuration', formData.configuration)
}

const functionChange = (v) => {
  formData.accessModes = [];
  if (!['HoldingRegisters', 'InputRegisters'].includes(formData.configuration.function)) {
    formData.configuration.codec.provider = 'int8'
  } else {
    formData.configuration.codec.provider = undefined
  }
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
</script>
<style></style>
