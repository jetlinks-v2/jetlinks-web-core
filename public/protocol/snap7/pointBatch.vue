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
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { request } from '@jetlinks-web/core'
import { PointEditTable } from '@components'
import { useLocales } from '@hooks'
import { EventEmitter, randomString } from '@jetlinks-web/utils'
import { get, set } from 'lodash-es'
import {commandRequest, queryCodecProvider, queryPointMetadata} from 'request'
import {handlePointConfigMetadata} from 'local-utils'

const { $lang } = useLocales('snap7')

const collector = inject('point-batch-collector-data', ref({}))
const dataSource = ref([])
const tableRef = ref()
const optionsMap = new Map()

const requestColumns = ref([])

const daveAreaList = ref([])
const dataTypesList = ref([])

const deviceType = computed(() => collector.value?.configuration?.type)

const accessModeOptions = computed(() => [
  { label: $lang('snap7.point.20250207-30'), value: 'read' },
  { label: $lang('snap7.point.20250207-31'), value: 'write' },
])

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

const codecList = ref([])

const requiredRule = (message) => {
  return {
    asyncValidator(_rule, value) {
      if (
          value === undefined ||
          value === null ||
          value === '' ||
          (Array.isArray(value) && !value.length)
      ) {
        return Promise.reject(message)
      }
      return Promise.resolve()
    },
  }
}

const columns = computed(() => [
  {
    title: '名称',
    dataIndex: 'name',
    template: {
      components: 'a-input',
      props: {
        allowClear: true,
      },
      check: false,
    },
    form: {
      required: true,
      rules: [requiredRule('请输入名称')],
    },
    ellipsis: true,
    fixed: 'left',
    width: 180,
  },
  ...requestColumns.value,
  {
    title: '访问类型',
    dataIndex: 'accessModes',
    template: {
      components: 'a-select',
      props: {
        style: { width: '100%' },
        options: accessModeOptions.value,
        mode: 'multiple',
        allowClear: true,
      },
    },
    form: {
      required: true,
      rules: [requiredRule('请选择访问类型')],
    },
    ellipsis: true,
    width: 180,
  },
  {
    title: '采集频率',
    dataIndex: 'interval',
    template: {
      components: 'a-input-number',
      props: {
        style: { width: '100%' },
        min: 0,
        max: 2147483648,
        precision: 0,
        controls: false,
      },
    },
    form: {
      required: true,
      rules: [requiredRule('请输入采集频率')],
    },
    ellipsis: true,
    width: 240,
  },
  {
    title: '说明',
    dataIndex: 'description',
    template: {
      components: 'a-input',
      props: {
        allowClear: true,
      },
      check: false,
    },
    ellipsis: true,
    width: 220,
  },
  {
    title: '只推送变化数据',
    dataIndex: 'features',
    key: 'features',
    ellipsis: true,
    template: {
      components: 'a-switch',
      getValue(data) {
        return (data || []).some((key) => key === 'changedOnly')
      },
      handleChange: (value, index) => {
        let features = dataSource.value[index].features || []
        if (value) {
          features = [...new Set([...features, 'changedOnly'])]
        } else {
          features = features.filter((key) => key !== 'changedOnly')
        }
        return features
      },
    },
    width: 160,
  },
  {
    title: '标准数据类型',
    dataIndex: 'codec',
    key: 'codec',
    ellipsis: true,
    template: {
      components: 'a-select',
      props: {
        parseKey: 'supportCodecs',
        options: codecList.value,
      }
    },
    width: 220,
  },
  {
    title: '内存布局',
    dataIndex: 'byteLayout',
    key: 'byteLayout',
    ellipsis: true,
    template: {
      components: 'a-select',
      props: {
        style: {width: '100%'},
        options: [
          {
            "label": "AB",
            "value": "AB"
          },
          {
            "label": "BA",
            "value": "BA"
          },
          {
            "label": "AB_CD",
            "value": "AB_CD"
          },
          {
            "label": "CD_AB",
            "value": "CD_AB"
          },
          {
            "label": "BA_DC",
            "value": "BA_DC"
          },
          {
            "label": "DC_BA",
            "value": "DC_BA"
          },
          {
            "label": "AB_CD_EF_GH",
            "value": "AB_CD_EF_GH"
          },
          {
            "label": "GH_EF_CD_AB",
            "value": "GH_EF_CD_AB"
          },
          {
            "label": "BA_DC_FE_HG",
            "value": "BA_DC_FE_HG"
          },
          {
            "label": "HG_FE_DC_BA",
            "value": "HG_FE_DC_BA"
          }
        ],
        allowClear: true,
      }
    },
    width: 220,
  },
])

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

const buildSameConfig = () => ({
  daveArea: true,
  areaNumber: true,
  type: true,
  bytes: true,
  bits: true,
  offset: true,
  accessModes: true,
  interval: true,
  features: true,
})

const syncSameField = (index, sameKey, path, value) => {
  for (let i = index; i < dataSource.value.length; i++) {
    if (i !== index && !dataSource.value[i]?.sames?.[sameKey]) {
      break
    }
    set(dataSource.value[i], path, value)
  }
}

const createRecord = () => {
  const sames = buildSameConfig()
  const record = {
    id: randomString(),
    pointKey: randomString(9),
    name: undefined,
    provider: collector.value.provider,
    collectorId: collector.value.id,
    collectorName: collector.value.name,
    channelId: collector.value.channelId,
    channelName: collector.value.channelName,
    description: undefined,
    interval: 3000,
    inheritBreaker: true,
    circuitBreaker: undefined,
    priority: undefined,
    features: [],
    accessModes: [],
    managedConfiguration: {},
    configuration: {
      daveArea: undefined,
      type: undefined,
      areaNumber: undefined,
      bytes: undefined,
      bits: undefined,
      offset: undefined,
      interval: 3000,
      terms: [],
      scaleFactor: 1,
      codec: undefined
    },
    sames: { ...sames },
  }

  if (dataSource.value.length >= 1) {
    const lastRecord = dataSource.value[dataSource.value.length - 1]
    Object.keys(sames).forEach((key) => {
      const column = columns.value.find((item) => item.dataIndex === key)
      const formName = column?.form?.name || key
      set(record, formName, get(lastRecord, formName))
    })
  }

  return record
}

const getConfigMetadata = async () => {
  const resp = await commandRequest.pointConfigMetadata('snap7')
  if (resp.success) {
    const {
      values,
      columns: _columns,
      fieldPathMap: _fieldPathMap
    } = handlePointConfigMetadata(resp.result, 'configuration')
    requestColumns.value = _columns.filter(item => {
      return item.dataIndex !== 'codec'
    }).map(item => {
      if(item.dataIndex === 'daveArea') {
        let result = daveAreaList.value
        if (deviceType.value && dataAreaFilter[deviceType.value]) {
          result = daveAreaList.value.filter((item) => dataAreaFilter[deviceType.value].includes(item.id))
        }

        if (deviceType.value === 'S200') {
          result = [
            ...result,
            {
              id: 'DB',
              name: $lang('snap7.point.20250207-28'),
            },
          ]
        }

        item.template.props.options = result.map((item) => ({
          label: item.name,
          value: item.id,
        }))
      }
      item.ellipsis = true
      return item
    })
    // requestRecord.value = values
    // fieldPathMap.value = _fieldPathMap
  }

  queryCodecProvider().then(res => { // 数据类型
    if (res.success) {
      codecList.value = res.result.map(item => ({
        label: item.name,
        value: item.id,
      }))
    }
  })
}

getConfigMetadata()

const addOne = () => {
  dataSource.value.push(createRecord())
}

getAreaList()
getTypes()

defineExpose({
  onSave: async () => {
    const result = await tableRef.value?.onSave?.()
    if (result) {
      return result.map(i => {
        return {
          ...i,
          configuration: {
            ...i.configuration,
            codec: i.codec,
          },
          managedConfiguration: {
            ...i.managedConfiguration,
            byteLayout: i.byteLayout,
            codec: i.codec,
          }

        }
      })
    }
    return false
  },
})
</script>

<style scoped></style>
