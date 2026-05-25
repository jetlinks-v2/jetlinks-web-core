<template>
  <div class="opc-scan">
    <div class="opc-scan__sidebar">
      <div class="opc-scan__header">
        <span>{{ $lang('OPC_UA.scan.20260422-1') }}</span>
        <a-button block @click="toggleCurrentPage">
          {{ hasSelectedCurrentPage ? $lang('OPC_UA.scan.20260422-2') : $lang('OPC_UA.scan.20260422-3') }}
        </a-button>
      </div>
      <a-spin :spinning="treeLoading">
        <a-breadcrumb class="opc-scan__breadcrumb">
          <a-breadcrumb-item
              v-for="(item, index) in breadcrumb"
              :key="`${item.nodeId || 'root'}-${index}`"
          >
            <a href="javascript:void(0);" @click="jumpTo(index, item.nodeId)">{{ item.breadcrumbName }}</a>
          </a-breadcrumb-item>
        </a-breadcrumb>
        <div v-if="treeData.length" class="opc-scan__tree">
          <VirtualScroll :data="treeData" :itemHeight="40">
            <template #renderItem="item">
              <div class="opc-scan__tree-item" @click="handleNodeClick(item)">
                <AIcon :type="item?.folder ? 'icon-wenjianjia' : 'icon-dianwei'"/>
                <div :class="['opc-scan__tree-title', selectedKeys.includes(item.id) ? 'is-selected' : '']">
                  <j-ellipsis>{{ item.name }}</j-ellipsis>
                </div>
              </div>
            </template>
          </VirtualScroll>
        </div>
        <a-empty v-else class="opc-scan__empty"/>
      </a-spin>
    </div>
    <div class="opc-scan__content">
      <j-edit-table
          ref="tableRef"
          :dataSource="dataSource"
          :serial="false"
          :columns="columns"
          :height="540"
      >
        <template #name="{ record, index }">
          <j-edit-table-form-item :name="[index, 'name']">
            <div class="opc-scan__ditto">
              <a-input
                  v-model:value="record.name"
                  allowClear
                  :placeholder="$lang('OPC_UA.scan.20250414-1')"
                  class="opc-scan__grow"
                  style="width: 100%;"
                  @change="valueChange(index, 'name')"
              />
            </div>
          </j-edit-table-form-item>
        </template>
        <template #accessModes="{ record, index }">
          <j-edit-table-form-item :name="[index, 'accessModes']">
            <div class="opc-scan__ditto">
              <a-select
                  v-model:value="record.accessModes"
                  class="opc-scan__grow"
                  mode="multiple"
                  allowClear
                  :disabled="index !== 0 && record.accessModesCheck"
                  :options="accessModeOptions"
                  @change="valueChange(index, 'accessModes')"
              />
              <a-checkbox
                  v-if="index !== 0"
                  v-model:checked="record.accessModesCheck"
                  @change="(e) => changeCheckbox(record, 'accessModes', index, e)"
              >
                {{ $lang('OPC_UA.scan.20260422-4') }}
              </a-checkbox>
            </div>
          </j-edit-table-form-item>
        </template>
        <template #interval="{ record, index }">
          <j-edit-table-form-item :name="[index, 'interval']">
            <div class="opc-scan__ditto">
              <a-input-number
                  v-model:value="record.interval"
                  class="opc-scan__grow"
                  :min="0"
                  :max="2147483647"
                  :precision="0"
                  addon-after="ms"
                  :disabled="index !== 0 && record.intervalCheck"
                  @change="valueChange(index, 'interval')"
              />
              <a-checkbox
                  v-if="index !== 0"
                  v-model:checked="record.intervalCheck"
                  @change="(e) => changeCheckbox(record, 'interval', index, e)"
              >
                {{ $lang('OPC_UA.scan.20260422-4') }}
              </a-checkbox>
            </div>
          </j-edit-table-form-item>
        </template>
        <template #samplingInterval="{ record, index }">
          <j-edit-table-form-item :name="[index, 'samplingInterval']">
            <div class="opc-scan__ditto">
              <a-input-number
                  v-model:value="record.samplingInterval"
                  class="opc-scan__grow"
                  :min="0"
                  :max="1000"
                  :precision="0"
                  :disabled="index !== 0 && record.samplingIntervalCheck"
                  @change="valueChange(index, 'samplingInterval')"
              />
              <a-checkbox
                  v-if="index !== 0"
                  v-model:checked="record.samplingIntervalCheck"
                  @change="(e) => changeCheckbox(record, 'samplingInterval', index, e)"
              >
                {{ $lang('OPC_UA.scan.20260422-4') }}
              </a-checkbox>
            </div>
          </j-edit-table-form-item>
        </template>
        <template #monitoringMode="{ record, index }">
          <j-edit-table-form-item :name="[index, 'monitoringMode']">
            <div class="opc-scan__ditto">
              <a-select
                  v-model:value="record.monitoringMode"
                  class="opc-scan__grow"
                  :disabled="index !== 0 && record.monitoringModeCheck"
                  :options="monitoringModeOptions"
                  @change="valueChange(index, 'monitoringMode')"
              />
              <a-checkbox
                  v-if="index !== 0"
                  v-model:checked="record.monitoringModeCheck"
                  @change="(e) => changeCheckbox(record, 'monitoringMode', index, e)"
              >
                {{ $lang('OPC_UA.scan.20260422-4') }}
              </a-checkbox>
            </div>
          </j-edit-table-form-item>
        </template>
        <template #queueSize="{ record, index }">
          <j-edit-table-form-item :name="[index, 'queueSize']">
            <div class="opc-scan__ditto">
              <a-input-number
                  v-model:value="record.queueSize"
                  class="opc-scan__grow"
                  :min="1"
                  :max="65535"
                  :precision="0"
                  :disabled="index !== 0 && record.queueSizeCheck"
                  @change="valueChange(index, 'queueSize')"
              />
              <a-checkbox
                  v-if="index !== 0"
                  v-model:checked="record.queueSizeCheck"
                  @change="(e) => changeCheckbox(record, 'queueSize', index, e)"
              >
                {{ $lang('OPC_UA.scan.20260422-4') }}
              </a-checkbox>
            </div>
          </j-edit-table-form-item>
        </template>
        <template #arrayType="{ record, index }">
          <j-edit-table-form-item :name="[index, 'arrayType']">
            <div class="opc-scan__ditto">
              <a-select
                  v-model:value="record.arrayType"
                  class="opc-scan__grow"
                  :disabled="index !== 0 && record.arrayTypeCheck"
                  :options="booleanOptions"
                  @change="valueChange(index, 'arrayType')"
              />
              <a-checkbox
                  v-if="index !== 0"
                  v-model:checked="record.arrayTypeCheck"
                  @change="(e) => changeCheckbox(record, 'arrayType', index, e)"
              >
                {{ $lang('OPC_UA.scan.20260422-4') }}
              </a-checkbox>
            </div>
          </j-edit-table-form-item>
        </template>
        <template #valueRank="{ record, index }">
          <j-edit-table-form-item :name="[index, 'valueRank']">
            <div class="opc-scan__ditto">
              <a-input-number
                  v-model:value="record.valueRank"
                  class="opc-scan__grow"
                  :precision="0"
                  :disabled="index !== 0 && record.valueRankCheck"
                  @change="valueChange(index, 'valueRank')"
              />
              <a-checkbox
                  v-if="index !== 0"
                  v-model:checked="record.valueRankCheck"
                  @change="(e) => changeCheckbox(record, 'valueRank', index, e)"
              >
                {{ $lang('OPC_UA.scan.20260422-4') }}
              </a-checkbox>
            </div>
          </j-edit-table-form-item>
        </template>
        <template #features="{ record, index }">
          <div class="opc-scan__ditto">
            <a-select
                v-model:value="record.features"
                class="opc-scan__grow"
                :disabled="index !== 0 && record.featuresCheck"
                :options="featureOptions"
                @change="valueChange(index, 'features')"
            />
            <a-checkbox
                v-if="index !== 0"
                v-model:checked="record.featuresCheck"
                @change="(e) => changeCheckbox(record, 'features', index, e)"
            >
              {{ $lang('OPC_UA.scan.20260422-4') }}
            </a-checkbox>
          </div>
        </template>
        <template #actions="{ record }">
          <j-permission-button
              danger
              type="link"
              :tooltip="{ title: $lang('OPC_UA.scan.20260422-5') }"
              :popConfirm="{
                title: $lang('OPC_UA.scan.20260422-6'),
                onConfirm: () => removeItem(record.id),
              }"
          >
            <AIcon type="DeleteOutlined"/>
          </j-permission-button>
        </template>
      </j-edit-table>
    </div>
  </div>
</template>

<script setup>
import {computed, inject, ref, watch} from 'vue'
import {cloneDeep} from 'lodash-es'
import {useLocales} from '@hooks'
import {queryPointNoPaging} from 'request'
import { request } from '@jetlinks-web/core'

const { $lang } = useLocales('OPC_UA')
const scanSetting = inject('plugin-scan-point', ref({
  columns: [],
  selectedData: [],
  handleData: undefined,
}))
const collectorData = inject('collector-data', ref({}))

const treeLoading = ref(false)
const tableRef = ref()
const treeData = ref([])
const selectedKeys = ref([])
const selectedMap = ref(new Map())
const selectedPointKeys = ref([])
const dataSource = ref([])
const breadcrumb = ref([])

const createRootBreadcrumb = () => ({
  breadcrumbName: $lang('OPC_UA.scan.20260422-7'),
  nodeId: undefined,
})

const accessModeOptions = computed(() => ([
  { label: $lang('OPC_UA.scan.20260422-8'), value: 'read' },
  { label: $lang('OPC_UA.scan.20260422-9'), value: 'write' },
  { label: $lang('OPC_UA.scan.20260422-10'), value: 'subscribe' },
]))

const featureOptions = computed(() => ([
  { label: $lang('OPC_UA.scan.20260422-11'), value: true },
  { label: $lang('OPC_UA.scan.20260422-12'), value: false },
]))

const booleanOptions = computed(() => ([
  { label: $lang('OPC_UA.scan.20260422-11'), value: true },
  { label: $lang('OPC_UA.scan.20260422-12'), value: false },
]))

const monitoringModeOptions = computed(() => ([
  { label: $lang('OPC_UA.point.20260423-12'), value: 'Sampling' },
  { label: $lang('OPC_UA.point.20260423-13'), value: 'Reporting' },
]))

const columns = computed(() => ([
  {
    title: $lang('OPC_UA.scan.20250414-1'),
    dataIndex: 'name',
    key: 'name',
    ellipsis: true,
    width: 200,
    form: {
      required: true,
      rules: [
        {
          validator: (_rule, value) => {
            return value ? Promise.resolve() : Promise.reject($lang('OPC_UA.scan.20250414-1'))
          },
        },
      ],
    }
  },
  {
    title: 'nodeId',
    dataIndex: 'id',
    key: 'id',
    width: 240,
    ellipsis: true,
  },
  {
    title: $lang('OPC_UA.scan.20260422-15'),
    dataIndex: 'accessModes',
    key: 'accessModes',
    width: 320,
    form: {
      required: true,
      rules: [
        {
          validator: (_rule, value) => {
            return value?.length ? Promise.resolve() : Promise.reject($lang('OPC_UA.scan.20260422-13'))
          },
        },
      ],
    },
  },
  {
    title: $lang('OPC_UA.scan.20260422-16'),
    dataIndex: 'interval',
    key: 'interval',
    width: 220,
    form: {
      required: true,
      rules: [
        {
          validator: (_rule, value) => {
            return value !== undefined && value !== null
              ? Promise.resolve()
              : Promise.reject($lang('OPC_UA.scan.20260422-14'))
          },
        },
      ],
    },
  },
  {
    title: $lang('OPC_UA.scan.20260423-7'),
    dataIndex: 'samplingInterval',
    key: 'samplingInterval',
    width: 220,
    form: {
      required: true,
      rules: [
        {
          validator: (_rule, value) => {
            return value !== undefined && value !== null
              ? Promise.resolve()
              : Promise.reject($lang('OPC_UA.scan.20260423-8'))
          },
        },
      ],
    },
  },
  {
    title: $lang('OPC_UA.scan.20260423-1'),
    dataIndex: 'monitoringMode',
    key: 'monitoringMode',
    width: 220,
    form: {
      required: true,
      rules: [
        {
          validator: (_rule, value) => {
            return value ? Promise.resolve() : Promise.reject($lang('OPC_UA.scan.20260423-2'))
          },
        },
      ],
    },
  },
  {
    title: $lang('OPC_UA.scan.20260423-3'),
    dataIndex: 'queueSize',
    key: 'queueSize',
    width: 180,
    form: {
      required: true,
      rules: [
        {
          validator: (_rule, value) => {
            return value !== undefined && value !== null
              ? Promise.resolve()
              : Promise.reject($lang('OPC_UA.scan.20260423-4'))
          },
        },
      ],
    },
  },
  {
    title: $lang('OPC_UA.scan.20260423-5'),
    dataIndex: 'arrayType',
    key: 'arrayType',
    width: 180,
  },
  {
    title: $lang('OPC_UA.scan.20260423-6'),
    dataIndex: 'valueRank',
    key: 'valueRank',
    width: 180,
  },
  {
    title: $lang('OPC_UA.scan.20260422-17'),
    dataIndex: 'features',
    key: 'features',
    width: 180,
  },
  {
    title: $lang('OPC_UA.scan.20260422-18'),
    dataIndex: 'actions',
    width: 80,
  },
]))

const hasSelectedCurrentPage = computed(() => treeData.value.some((item) => !item.folder && selectedKeys.value.includes(item.id)))

const syncSelectedData = () => {
  dataSource.value = Array.from(selectedMap.value.values())
  scanSetting.value.selectedData = dataSource.value
}

const createPointRow = (item) => ({
  id: item?.id || '',
  name: item?.name || '',
  type: item?.others?.type,
  accessModes: [],
  accessModesCheck: true,
  interval: item?.configuration?.interval,
  intervalCheck: true,
  samplingInterval: item?.configuration?.samplingInterval,
  samplingIntervalCheck: true,
  monitoringMode: item?.configuration?.monitoringMode,
  monitoringModeCheck: true,
  queueSize: item?.configuration?.queueSize,
  queueSizeCheck: true,
  arrayType: item?.configuration?.arrayType,
  arrayTypeCheck: true,
  valueRank: item?.configuration?.valueRank,
  valueRankCheck: true,
  features: (item?.features || []).includes('changedOnly'),
  featuresCheck: true,
})

const copySameAsPrevious = (row, previous) => {
  if (!previous) {
    return row
  }

  const sameFields = [
    'accessModes',
    'features',
    'interval',
    'samplingInterval',
    'monitoringMode',
    'queueSize',
    'arrayType',
    'valueRank',
  ]

  sameFields.forEach((field) => {
    row[field] = cloneDeep(previous[field])
    row[`${field}Check`] = true
  })

  return row
}

const valueChange = (index, field) => {
  if (dataSource.value.length <= 1) {
    return
  }

  const current = dataSource.value[index]
  let pointer = index

  while (pointer < dataSource.value.length - 1) {
    const nextIndex = pointer + 1
    const nextItem = dataSource.value[nextIndex]
    if (nextItem?.[`${field}Check`]) {
      nextItem[field] = cloneDeep(current[field])
      pointer = nextIndex
    } else {
      break
    }
  }
}

const changeCheckbox = (record, field, index, e) => {
  if (!e.target.checked) {
    return
  }
  const lastItem = dataSource.value[index - 1]
  if (!lastItem) {
    return
  }
  record[field] = cloneDeep(lastItem[field])
  valueChange(index, field)
}

const removeItem = (id) => {
  selectedMap.value.delete(id)
  selectedKeys.value = selectedKeys.value.filter((item) => item !== id)
  syncSelectedData()
}

const addSelectedNode = (node) => {
  if (selectedMap.value.has(node.id)) {
    return
  }
  selectedKeys.value.push(node.id)

  const row = createPointRow(node)
  const previous = dataSource.value[dataSource.value.length - 1]
  selectedMap.value.set(node.id, copySameAsPrevious(row, previous))
  syncSelectedData()
}

const handleNodeClick = async (node) => {
  if (node?.folder) {
    await loadTree(node.id)
    breadcrumb.value.push({
      breadcrumbName: node.name,
      nodeId: node.id,
    })
    return
  }
  addSelectedNode(node)
}

const toggleCurrentPage = () => {
  const points = treeData.value.filter((item) => !item.folder)
  if (hasSelectedCurrentPage.value) {
    points.forEach((item) => {
      selectedMap.value.delete(item.id)
    })
    selectedKeys.value = selectedKeys.value.filter((item) => !points.some((point) => point.id === item))
  } else {
    points.forEach(addSelectedNode)
  }
  syncSelectedData()
}

const jumpTo = async (index, nodeId) => {
  breadcrumb.value.splice(index + 1)
  await loadTree(nodeId)
}

const loadCurrentPoints = async () => {
  const resp = await queryPointNoPaging({
    paging: false,
    terms: [
      {
        terms: [
          {
            column: 'collectorId',
            value: collectorData.value?.id,
          },
        ],
      },
    ],
  })
  if (resp?.success) {
    selectedPointKeys.value = resp.result.map((item) => item.pointKey)
  }
}

const loadTree = async (nodeId) => {
  treeLoading.value = true
  const resp = await request.post(`/data-collect/channel:${collectorData.value?.channelId}/command/DiscoveryPoint`, { depth: 1, address: nodeId }).finally(() => {
    treeLoading.value = false
  })
  const result = Array.isArray(resp?.result) ? resp.result : []
  treeData.value = result
      .filter((item) => !selectedPointKeys.value.includes(item.address))
      .map((item) => ({
        ...item,
        id: item.address,
        key: item.address,
        title: item.name,
        folder: item.nodeType === 'directory',
      }))
}

scanSetting.value.handleData = (rows) => {
  return rows.map((item) => ({
    name: item.name,
    provider: 'OPC_UA',
    collectorId: collectorData.value.id,
    collectorName: collectorData.value.name,
    channelId: collectorData.value.channelId,
    channelName: collectorData.value.channelName,
    pointKey: item.id,
    configuration: {
      interval: item.interval,
      samplingInterval: item.samplingInterval,
      monitoringMode: item.monitoringMode,
      queueSize: item.queueSize,
      arrayType: item.arrayType,
      valueRank: item.valueRank,
      type: item.type,
      nodeId: item.id
    },
    features: item.features ? ['changedOnly'] : [],
    accessModes: item.accessModes || [],
  }))
}

watch(
    () => dataSource.value,
    (value) => {
      scanSetting.value.selectedData = value
    },
    { deep: true },
)

watch(
    () => collectorData.value?.id,
    async (id) => {
      if (!id) {
        return
      }
      breadcrumb.value = [
        createRootBreadcrumb(),
      ]
      selectedKeys.value = []
      selectedMap.value = new Map()
      dataSource.value = []
      scanSetting.value.selectedData = []
      await loadCurrentPoints()
      await loadTree(undefined)
    },
    { immediate: true },
)

watch(
    () => $lang('OPC_UA.scan.20260422-7'),
    () => {
      if (breadcrumb.value.length) {
        breadcrumb.value[0] = createRootBreadcrumb()
      }
    },
    { immediate: true },
)

defineExpose({
  onSave: async () => tableRef.value?.validate?.(),
})
</script>

<style scoped>
.opc-scan {
  display: flex;
  gap: 16px;
  min-height: 600px;
}

.opc-scan__sidebar {
  width: 300px;
  border-right: 1px solid #f0f0f0;
  padding-right: 16px;
}

.opc-scan__header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.opc-scan__breadcrumb {
  margin-bottom: 12px;
}

.opc-scan__tree {
  height: 500px;
  overflow: hidden;
}

.opc-scan__tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  cursor: pointer;
}

.opc-scan__tree-title {
  flex: 1;
  min-width: 0;
}

.opc-scan__content {
  flex: 1;
  min-width: 0;
}

.opc-scan__ditto {
  display: flex;
  align-items: center;
  gap: 8px;
}

.opc-scan__grow {
  flex: 1;
}

.opc-scan__empty {
  margin-top: 120px;
}

</style>
