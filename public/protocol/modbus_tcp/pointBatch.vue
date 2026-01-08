<template>
  <div style="display: flex; flex-direction: column; gap: 16px; height: 100%">
    <div style="flex: 1; min-height: 0; overflow-y: auto">
      <PointEditTable
          :columns="columns"
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

const visible = ref(false)
const tableRef = ref()

const options = computed(() => [
  {label: $lang('MODBUS_TCP.point.20250207-24'), value: 'Coils'},
  {label: $lang('MODBUS_TCP.point.20250207-25'), value: 'DiscreteInputs'},
  {label: $lang('MODBUS_TCP.point.20250207-26'), value: 'HoldingRegisters'},
  {label: $lang('MODBUS_TCP.point.20250207-27'), value: 'InputRegisters'}
])

console.log($lang('MODBUS_TCP.point.20250207-24'), 'columns', options)

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
    }
  },
  {
    title: '功能码',
    dataIndex: 'function',
    template: {
      components: 'a-select',
      props: {
        allowClear: true,
        options: options.value
      }
    },
    ellipsis: true,
    form: {
      required: true,
      name: ['configuration', 'function']
    }
  },
  {
    title: '地址',
    dataIndex: 'pointKey',
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
    }
  },
  // {
  //   title: '访问类型',
  //   dataIndex: 'accessModes',
  //   key: 'accessModes',
  //   template: {
  //     components: 'a-select',
  //     props: {
  //       allowClear: true,
  //       style: {
  //         width: '100%'
  //       }
  //     }
  //   },
  //   form: {
  //     required: true,
  //     rules: [
  //       {
  //         asyncValidator: (rule, value, cb) => {
  //           const _value = isArray(value) ? value : value.value
  //           if (!_value?.length) {
  //             return Promise.reject('请选择访问类型');
  //           }
  //           return Promise.resolve();
  //         },
  //       }
  //     ]
  //   }
  // },
  // {
  //   title: '采集频率',
  //   dataIndex: 'interval',
  //   template: {
  //     components: 'a-input',
  //     props: {
  //       allowClear: true
  //     },
  //     tooltip: '1111111'
  //   },
  //   ellipsis: true,
  //   form: {
  //     required: true,
  //   }
  // },
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
  },
  // {
  //   title: '寄存器数量',
  //   dataIndex: 'quantity',
  //   template: {
  //     components: 'a-input',
  //     props: {
  //       allowClear: true
  //     }
  //   },
  //   ellipsis: true,
  // },
  // {
  //   title: '非标准协议写入配置',
  //   dataIndex: 'writeByteConfig',
  //   key: 'writeByteConfig',
  //   ellipsis: true,
  //   template: {
  //     components: 'a-switch',
  //     props: {
  //       allowClear: true
  //     }
  //   },
  // },
  // {
  //   title: '是否写入数据长度',
  //   dataIndex: 'writeByteCount',
  //   key: 'writeByteCount',
  //   ellipsis: true,
  //   template: {
  //     components: 'a-input-number',
  //     props: {
  //       allowClear: true
  //     }
  //   },
  // },
  // {
  //   title: '自定义数据区长度(byte)',
  //   dataIndex: 'byteCount',
  //   key: 'byteCount',
  //   ellipsis: true,
  //   template: {
  //     components: 'a-input-number',
  //     props: {
  //       allowClear: true
  //     }
  //   },
  // },
  // {
  //   title: '只推送变化数据',
  //   dataIndex: 'features',
  //   key: 'features',
  //   ellipsis: true,
  //   template: {
  //     components: 'a-switch',
  //   },
  // },
  // {
  //   title: '数据类型',
  //   dataIndex: 'dataTYpe',
  //   key: 'dataTYpe',
  //   ellipsis: true,
  //   template: {
  //     components: 'a-select',
  //   },
  // },
  // {
  //   title: '内存布局',
  //   dataIndex: 'memoryLayout',
  //   key: 'memoryLayout',
  //   ellipsis: true,
  //   template: {
  //     components: 'a-select',
  //   },
  // },
])

const onSaveData = () => {
  formRef.value.validate().then(() => {
    const arr = []
    for (let i = formData.startAddress; i <= formData.endAddress; i++) {
      arr.push({
        configuration: {
          function: formData.function,
          parameter: {
            quantity: formData.parameter.quantity
          }
        },
        pointKey: i
      })
    }
    dataSource.value.push(...arr)
  })
}

const addOne = () => {
  dataSource.value.push({
    name: undefined,
    provider: collector.value.provider || 'OPC_UA',
    collectorId: collector.value.id,
    collectorName: collector.value.name,
    pointKey: undefined,
    configuration: {
      interval: undefined,
      type: undefined,
    },
    features: [],
    accessModes: []
  })
}

defineExpose({
  onSave: async () => {
    const result = await tableRef.value.onSave?.()
    console.log(result)
    if (result) {
      return result
    }
    return false
  }
})
</script>

<style lang="less" scoped>

</style>
