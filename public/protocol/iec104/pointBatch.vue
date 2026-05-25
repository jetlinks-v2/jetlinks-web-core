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
import { PointEditTable } from '@components'
import { useLocales } from '@hooks'
import { randomString } from '@jetlinks-web/utils'
import { cloneDeep, get, set } from 'lodash-es'
import { commandRequest } from 'request'
import { handlePointConfigMetadata } from 'local-utils'

const { $lang } = useLocales('iec104')

const collector = inject('point-batch-collector-data', ref({}))
const dataSource = ref([])
const tableRef = ref()
const requestColumns = ref([])
const requestRecord = ref({})

const accessModeOptions = [
  { label: '读', value: 'read' },
  { label: '写', value: 'write' },
  { label: '订阅', value: 'subscribe' },
]

const booleanOptions = computed(() => [
  { label: $lang('iec104.common.20260424-1'), value: true },
  { label: $lang('iec104.common.20260424-2'), value: false },
])

const isEmpty = (value) => {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && !value.length)
  )
}

const requiredRule = (message) => ({
  asyncValidator(_rule, value) {
    if (isEmpty(value)) {
      return Promise.reject(message)
    }
    return Promise.resolve()
  },
})

const buildSameConfig = () => {
  const sames = {
    accessModes: true,
    interval: true,
    features: true,
  }

  requestColumns.value.forEach((column) => {
    sames[column.dataIndex] = true
  })

  return sames
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
        options: accessModeOptions,
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
    width: 180,
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
])

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
    configuration: cloneDeep(requestRecord.value),
    sames: { ...sames },
  }

  if (Object.prototype.hasOwnProperty.call(record.configuration, 'isRemoteControl')) {
    record.configuration.isRemoteControl = false
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

const normalizeConfigColumn = (column) => {
  column.ellipsis = true

  if (column.dataIndex === 'isRemoteControl') {
    column.template.props = {
      ...(column.template.props || {}),
      style: { width: '100%' },
      options: booleanOptions.value,
    }
    column.template.handleChange = (value, index) => {
      if (!value) {
        set(dataSource.value[index], ['configuration', 'typeIdentifierName'], undefined)
      }
      return value
    }
  }

  if (column.dataIndex === 'typeIdentifierName') {
    column.template.props = {
      ...(column.template.props || {}),
      style: { width: '100%' },
      allowClear: true,
      showSearch: true,
      filterOption: (input, option) => String(option?.label || '')
        .toLowerCase()
        .includes(input.toLowerCase()),
    }
  }

  if (column.dataIndex === 'pointAddress') {
    column.template.props = {
      ...(column.template.props || {}),
      style: { width: '100%' },
      min: 0,
      precision: 0,
      controls: false,
    }
  }

  return column
}

const getConfigMetadata = async () => {
  const resp = await commandRequest.pointConfigMetadata('iec104')
  if (resp.success) {
    const { values, columns: _columns } = handlePointConfigMetadata(resp.result, 'configuration')
    requestColumns.value = _columns.map(normalizeConfigColumn)
    requestRecord.value = values
  }
}

const addOne = () => {
  dataSource.value.push(createRecord())
}

getConfigMetadata()

defineExpose({
  onSave: async () => {
    const result = await tableRef.value?.onSave?.()
    if (result) {
      return result.map((item) => ({
        ...item,
        configuration: {
          ...item.configuration,
          typeIdentifierName: item.configuration?.isRemoteControl
            ? item.configuration?.typeIdentifierName
            : undefined,
        },
      }))
    }
    return false
  },
})
</script>

<style scoped></style>
