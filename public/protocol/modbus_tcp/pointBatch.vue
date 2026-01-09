<template>
  <div style="display: flex; flex-direction: column; gap: 16px; height: 100%">
    <div style="flex: 1; min-height: 0; overflow-y: auto">
      <PointEditTable
          :columns="columns"
          :fieldPathMap="fieldPathMap"
          v-model:dataSource="dataSource"
          ref="tableRef"
      />
    </div>
    <div style="display: flex; gap: 16px">
      <a-button type="link" @click="addOne">新增一条</a-button>
      <a-button type="link" @click="visible = true">新增多条</a-button>
    </div>
  </div>
  <a-modal v-if="visible" open title="新增多条" :width="700" @cancel="visible = false" @ok="onSaveData">
    <a-alert
        message="快速生成多行数据, 生成行数 = (结束地址 − 起始地址 + 1) ÷ 寄存器数量，无法整除的剩余寄存器将被忽略"
        type="info"
        show-icon
        style="margin-bottom: 16px"
    />
    <a-form :model="formData" layout="vertical" ref="formRef">
      <a-form-item label="功能码" name="function" :rules="[{required: true, message: '请选择功能码'}]">
        <a-select
            v-model:value="formData.function"
            :options="options"
            placeholder="请选择功能码"
        />
      </a-form-item>
      <a-form-item label="起始地址" name="startAddress" :rules="[{required: true, message: '请输入起始地址'}]">
        <a-input-number
            style="width: 100%"
            v-model:value="formData.startAddress"
            :controls="false"
            :max="255"
            :min="0"
            :precision="0"
            placeholder="请输入起始地址"
        />
      </a-form-item>
      <a-form-item label="结束地址" name="endAddress" :rules="[{required: true, message: '请输入结束地址'}]">
        <a-input-number
            style="width: 100%"
            v-model:value="formData.endAddress"
            :controls="false"
            :max="255"
            :min="0"
            :precision="0"
            placeholder="请输入结束地址"
        />
      </a-form-item>
      <a-form-item label="寄存器数量(word)" :name="['parameter', 'quantity']"
                   :rules="[{required: true, message: '请输入寄存器数量'}]">
        <a-input-number v-model:value="formData.parameter.quantity" :controls="false" :max="65535" :min="1"
                        :precision="0"
                        :placeholder="$lang('MODBUS_RTU.point.20250207-7')" style="width: 100%"/>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
<script setup>
import {inject, reactive, ref, computed} from "vue";
import {PointEditTable} from '@components'
import {useLocales} from '@hooks'
import { commandRequest } from 'request'
import { handlePointConfigMetadata, SameEngine } from 'local-utils'
import { randomString } from '@jetlinks-web/utils'
import { cloneDeep } from 'lodash-es'

const {$lang} = useLocales('modbus_tcp')

const collector = inject('point-batch-collector-data', ref({}))
const dataSource = ref([])
const formRef = ref()
const formData = reactive({
  parameter: {
    quantity: undefined
  },
  function: undefined,
  startAddress: undefined,
  endAddress: undefined,
})
const requestColumns = ref([])
const requestRecord = ref({})
const fieldPathMap = ref({})

const visible = ref(false)
const tableRef = ref()

const options = computed(() => [
  {label: $lang('MODBUS_TCP.point.20250207-24'), value: 'Coils'},
  {label: $lang('MODBUS_TCP.point.20250207-25'), value: 'DiscreteInputs'},
  {label: $lang('MODBUS_TCP.point.20250207-26'), value: 'HoldingRegisters'},
  {label: $lang('MODBUS_TCP.point.20250207-27'), value: 'InputRegisters'}
])

const columns = computed(() => [
  {
    title: '名称',
    dataIndex: 'name',
    template: {
      components: 'a-input',
      props: {
        allowClear: true
      },
      check: false
    },
    ellipsis: true,
    form: {
      required: true,
    },
    fixed: 'left',
    width: 200,
  },
  ...requestColumns.value,
  {
    title: '采集频率',
    dataIndex: 'interval',
    template: {
      components: 'a-input',
      props: {
        allowClear: true
      },
    },
    ellipsis: true,
    form: {
      required: true,
    },
    width: 200,
  },
  {
    title: '说明',
    dataIndex: 'description',
    template: {
      components: 'a-input',
      props: {
        allowClear: true
      },
      check: false
    },
    ellipsis: true,
    width: 220,
  },
  {
    title: '寄存器数量',
    dataIndex: 'quantity',
    template: {
      components: 'a-input',
      props: {
        allowClear: true
      }
    },
    ellipsis: true,
    width: 220,
  },
  {
    title: '非标准协议写入配置',
    dataIndex: 'writeByteConfig',
    key: 'writeByteConfig',
    ellipsis: true,
    template: {
      components: 'a-switch',
      props: {
        allowClear: true
      }
    },
    width: 180,
  },
  {
    title: '是否写入数据长度',
    dataIndex: 'writeByteCount',
    key: 'writeByteCount',
    ellipsis: true,
    template: {
      components: 'a-input-number',
      props: {
        allowClear: true
      }
    },
    width: 220,
  },
  {
    title: '自定义数据区长度(byte)',
    dataIndex: 'byteCount',
    key: 'byteCount',
    ellipsis: true,
    template: {
      components: 'a-input-number',
      props: {
        allowClear: true
      }
    },
    width: 220,
  },
  {
    title: '只推送变化数据',
    dataIndex: 'features',
    key: 'features',
    ellipsis: true,
    template: {
      components: 'a-switch',
    },
    width: 160,
  },
  {
    title: '数据类型',
    dataIndex: 'dataTYpe',
    key: 'dataTYpe',
    ellipsis: true,
    template: {
      components: 'a-select',
    },
    width: 220,
  },
  {
    title: '内存布局',
    dataIndex: 'memoryLayout',
    key: 'memoryLayout',
    ellipsis: true,
    template: {
      components: 'a-select',
      props: {
        style: { width: '100%' }
      }
    },
    width: 220,
  },
])

/**
 * 初始化同上状态
 * @returns {{features: boolean, quantity: boolean, writeByteCount: boolean, byteCount: boolean, dataTYpe: boolean, writeByteConfig: boolean, interval: boolean, memoryLayout: boolean}}
 */
const handleSames = () => {
  const defaultValue = dataSource.value.length >= 1
  const _sames = {
    quantity: defaultValue,
    writeByteConfig: defaultValue,
    writeByteCount: defaultValue,
    byteCount: defaultValue,
    features: defaultValue,
    dataTYpe: defaultValue,
    memoryLayout: defaultValue,
    interval: defaultValue,
  }

  requestColumns.value.forEach(column => {
    if (column.dataIndex !== 'address') {
      _sames[column.dataIndex] = defaultValue
    }
  })

  return _sames
}

const handleRecord = () => {

  return {
    id: randomString(),
    name: undefined,
    provider: collector.value.provider,
    collectorId: collector.value.id,
    collectorName: collector.value.name,
    channelId: undefined,
    channelName: undefined,
    description: undefined,
    interval: 3000,
    inheritBreaker: false, // 是否继承熔断
    circuitBreaker: undefined, // 错误处理方式
    priority: undefined, // 优先级
    features: [],
    pointKey: undefined,
    accessModes: [], // 可选值： read , write ,subscribe
    managedConfiguration: {}, // 点位管理配置
    configuration: cloneDeep(requestRecord.value),
    sames: handleSames()
  }
}


const onSaveData = () => {
  formRef.value.validate().then(() => {
    const arr = []
    for (let i = formData.startAddress; i <= formData.endAddress; i++) {
      arr.push({
        ...handleRecord(),
        pointKey: i
      })
    }
    dataSource.value.push(...arr)
  })
}

/**
 * 新增单条数据
 */
const addOne = () => {
  dataSource.value.push(handleRecord())
}

const getConfigMetadata = async () => {
  const resp = await commandRequest.pointConfigMetadata('modbus_tcp')
  if (resp.success) {
    const { values, columns: _columns, fieldPathMap:_fieldPathMap } = handlePointConfigMetadata(resp.result, 'configuration')
    requestColumns.value = _columns.map(item => {
      if (item.dataIndex === 'address') {
        item.template.check = false
      }
      return item
    })
    requestRecord.value = values
    fieldPathMap.value = _fieldPathMap
  }
}

getConfigMetadata()

defineExpose({
  onSave: async () => {
    const result = await tableRef.value.onSave?.()
    return result || false
  }
})
</script>

<style lang="less" scoped>

</style>
