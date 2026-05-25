<template>
  <div class="bacnet-scan">
    <div class="bacnet-scan__sidebar">
      <div class="bacnet-scan__header">
        <span>{{ $lang('BACNetIp.scan.20260428-1') }}</span>
        <a-button block @click="toggleAll">
          {{ dataSource.length ? $lang('BACNetIp.scan.20260428-2') : $lang('BACNetIp.scan.20260428-3') }}
        </a-button>
      </div>
      <a-spin :spinning="treeLoading">
        <div v-if="treeData.length" class="bacnet-scan__tree">
          <VirtualScroll :data="treeData" :itemHeight="40">
            <template #renderItem="item">
              <div class="bacnet-scan__tree-item" @click="addSelectedNode(item)">
                <AIcon type="icon-dianwei" />
                <div :class="['bacnet-scan__tree-title', selectedKeys.includes(item.pointKey) ? 'is-selected' : '']">
                  <j-ellipsis>{{ item.name }}</j-ellipsis>
                </div>
              </div>
            </template>
          </VirtualScroll>
        </div>
        <a-empty v-else class="bacnet-scan__empty" />
      </a-spin>
    </div>
    <div class="bacnet-scan__content">
      <j-edit-table
        ref="tableRef"
        :dataSource="dataSource"
        :serial="false"
        :columns="columns"
        :height="540"
      >
        <template #name="{ record, index }">
          <j-edit-table-form-item :name="[index, 'name']">
            <a-input
              v-model:value="record.name"
              allowClear
              :placeholder="$lang('BACNetIp.scan.20260428-4')"
              style="width: 100%;"
            />
          </j-edit-table-form-item>
        </template>
        <template #objectType="{ record }">
          <j-ellipsis>{{ record.objectId?.type }}</j-ellipsis>
        </template>
        <template #instanceNumber="{ record }">
          <j-ellipsis>{{ record.objectId?.instanceNumber }}</j-ellipsis>
        </template>
        <template #propertyId="{ record, index }">
          <j-edit-table-form-item :name="[index, 'propertyId']">
            <a-select
              v-model:value="record.propertyId"
              show-search
              allowClear
              class="bacnet-scan__grow"
              :placeholder="$lang('BACNetIp.scan.20260428-5')"
              :options="getPropertyOptions(record)"
              :filter-option="filterOption"
              @focus="loadPropertyIds(record)"
            />
          </j-edit-table-form-item>
        </template>
        <template #valueType="{ record, index }">
          <j-edit-table-form-item :name="[index, 'valueType']">
            <a-select
              v-model:value="record.valueType"
              show-search
              allowClear
              class="bacnet-scan__grow"
              :placeholder="$lang('BACNetIp.scan.20260428-6')"
              :options="valueTypeOptions"
              :filter-option="filterOption"
            />
          </j-edit-table-form-item>
        </template>
        <template #accessModes="{ record, index }">
          <j-edit-table-form-item :name="[index, 'accessModes']">
            <div class="bacnet-scan__ditto">
              <a-select
                v-model:value="record.accessModes"
                class="bacnet-scan__grow"
                mode="multiple"
                allowClear
                :disabled="index !== 0 && record.accessModesCheck"
                :placeholder="$lang('BACNetIp.scan.20260428-7')"
                :options="accessModeOptions"
                @change="valueChange(index, 'accessModes')"
              />
              <a-checkbox
                v-if="index !== 0"
                v-model:checked="record.accessModesCheck"
                @change="(e) => changeCheckbox(record, 'accessModes', index, e)"
              >
                {{ $lang('BACNetIp.scan.20260428-8') }}
              </a-checkbox>
            </div>
          </j-edit-table-form-item>
        </template>
        <template #interval="{ record, index }">
          <j-edit-table-form-item :name="[index, 'interval']">
            <div class="bacnet-scan__ditto">
              <a-input-number
                v-model:value="record.interval"
                class="bacnet-scan__grow"
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
                {{ $lang('BACNetIp.scan.20260428-8') }}
              </a-checkbox>
            </div>
          </j-edit-table-form-item>
        </template>
        <template #features="{ record, index }">
          <div class="bacnet-scan__ditto">
            <a-select
              v-model:value="record.features"
              class="bacnet-scan__grow"
              :disabled="index !== 0 && record.featuresCheck"
              :placeholder="$lang('BACNetIp.scan.20260428-9')"
              :options="featureOptions"
              @change="valueChange(index, 'features')"
            />
            <a-checkbox
              v-if="index !== 0"
              v-model:checked="record.featuresCheck"
              @change="(e) => changeCheckbox(record, 'features', index, e)"
            >
              {{ $lang('BACNetIp.scan.20260428-8') }}
            </a-checkbox>
          </div>
        </template>
        <template #actions="{ record }">
          <j-permission-button
            danger
            type="link"
            :tooltip="{ title: $lang('BACNetIp.scan.20260428-10') }"
            :popConfirm="{
              title: $lang('BACNetIp.scan.20260428-11'),
              onConfirm: () => removeItem(record.pointKey),
            }"
          >
            <AIcon type="DeleteOutlined" />
          </j-permission-button>
        </template>
      </j-edit-table>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import { cloneDeep } from 'lodash-es'
import { request } from '@jetlinks-web/core'
import { useLocales } from '@hooks'
import { queryPointNoPaging } from 'request'

const { $lang } = useLocales('BACNetIp')
const scanSetting = inject('plugin-scan-point', ref({
  columns: [],
  selectedData: [],
  handleData: undefined,
}))
const collectorData = inject('collector-data', ref({}))

const fallbackValueTypes = ['Boolean', 'String', 'Number', 'Integer', 'UnsignedInteger', 'Real', 'Double', 'Enum']
const fallbackPropertyIds = []

const treeLoading = ref(false)
const tableRef = ref()
const treeData = ref([])
const selectedKeys = ref([])
const selectedMap = ref(new Map())
const selectedPointKeys = ref([])
const dataSource = ref([])
const valueTypeList = ref([])
const propertyIdMap = ref(new Map())

const accessModeOptions = computed(() => ([
  { label: $lang('BACNetIp.scan.20260428-12'), value: 'read' },
  { label: $lang('BACNetIp.scan.20260428-13'), value: 'write' },
  { label: $lang('BACNetIp.scan.20260428-14'), value: 'subscribe' },
]))

const featureOptions = computed(() => ([
  { label: $lang('BACNetIp.scan.20260428-15'), value: true },
  { label: $lang('BACNetIp.scan.20260428-16'), value: false },
]))

const valueTypeOptions = computed(() => createOptions(valueTypeList.value.length ? valueTypeList.value : fallbackValueTypes))

const columns = computed(() => ([
  {
    title: $lang('BACNetIp.scan.20260428-17'),
    dataIndex: 'name',
    key: 'name',
    ellipsis: true,
    width: 180,
    fixed: 'left',
    form: {
      required: true,
      rules: [
        {
          validator: (_rule, value) => value ? Promise.resolve() : Promise.reject($lang('BACNetIp.scan.20260428-4')),
        },
        {
          validator: (_rule, value) => !value || String(value).length <= 64
            ? Promise.resolve()
            : Promise.reject($lang('BACNetIp.scan.20260428-18')),
        },
      ],
    },
  },
  {
    title: $lang('BACNetIp.scan.20260428-19'),
    dataIndex: 'objectType',
    key: 'objectType',
    ellipsis: true,
    width: 140,
  },
  {
    title: $lang('BACNetIp.scan.20260428-20'),
    dataIndex: 'instanceNumber',
    key: 'instanceNumber',
    ellipsis: true,
    width: 140,
  },
  {
    title: $lang('BACNetIp.scan.20260428-21'),
    dataIndex: 'propertyId',
    key: 'propertyId',
    ellipsis: true,
    width: 220,
    form: {
      required: true,
      rules: [
        {
          validator: (_rule, value) => value ? Promise.resolve() : Promise.reject($lang('BACNetIp.scan.20260428-5')),
        },
      ],
    },
  },
  {
    title: $lang('BACNetIp.scan.20260428-22'),
    dataIndex: 'valueType',
    key: 'valueType',
    ellipsis: true,
    width: 200,
    form: {
      required: true,
      rules: [
        {
          validator: (_rule, value) => value ? Promise.resolve() : Promise.reject($lang('BACNetIp.scan.20260428-6')),
        },
      ],
    },
  },
  {
    title: $lang('BACNetIp.scan.20260428-23'),
    dataIndex: 'accessModes',
    key: 'accessModes',
    width: 280,
    form: {
      required: true,
      rules: [
        {
          validator: (_rule, value) => value?.length ? Promise.resolve() : Promise.reject($lang('BACNetIp.scan.20260428-7')),
        },
      ],
    },
  },
  {
    title: $lang('BACNetIp.scan.20260428-24'),
    dataIndex: 'interval',
    key: 'interval',
    width: 220,
    form: {
      required: true,
      rules: [
        {
          validator: (_rule, value) => value !== undefined && value !== null
            ? Promise.resolve()
            : Promise.reject($lang('BACNetIp.scan.20260428-25')),
        },
      ],
    },
  },
  {
    title: $lang('BACNetIp.scan.20260428-26'),
    dataIndex: 'features',
    key: 'features',
    width: 180,
  },
  {
    title: $lang('BACNetIp.scan.20260428-27'),
    dataIndex: 'actions',
    width: 80,
    fixed: 'right',
  },
]))

const createOptions = (list) => list.map((item) => ({
  label: item?.label || item?.name || item?.text || item,
  value: item?.value || item?.id || item?.key || item,
}))

const filterOption = (input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())

const getObjectKey = (objectId) => `${objectId?.type ?? ''}:${objectId?.instanceNumber ?? ''}`

const getPointKey = (item) => {
  const objectId = item?.objectId || {}
  return item?.pointKey || `${objectId.type}:${objectId.instanceNumber}:${item?.propertyId || 'presentValue'}`
}

const getPropertyOptions = (record) => {
  const objectKey = getObjectKey(record.objectId)
  const propertyIds = propertyIdMap.value.get(objectKey) || fallbackPropertyIds
  const usedPropertyIds = dataSource.value
    .filter((item) => item.pointKey !== record.pointKey && getObjectKey(item.objectId) === objectKey)
    .map((item) => item.propertyId)
  return createOptions(propertyIds.filter((item) => !usedPropertyIds.includes(item?.value || item?.id || item?.key || item)))
}

const loadPropertyIds = async (record) => {
  const objectKey = getObjectKey(record.objectId)
  if (propertyIdMap.value.has(objectKey)) {
    return
  }
  const resp = await request.post('/data-collect/BACNetIp/command/QueryPropertyIds', {
    collectorId: collectorData.value?.id,
    objectId: record.objectId,
  }).catch(() => undefined)
  if (resp?.success) {
    propertyIdMap.value.set(objectKey, resp.result || [])
  }
}

const getValueTypes = async () => {
  const resp = await request.post('/data-collect/BACNetIp/command/QueryValueTypes').catch(() => undefined)
  if (resp?.success) {
    valueTypeList.value = resp.result || []
  }
}

const syncSelectedData = () => {
  dataSource.value = Array.from(selectedMap.value.values())
  scanSetting.value.selectedData = dataSource.value
}

const createPointRow = (item) => ({
  id: item?.id || item?.address || getPointKey(item),
  pointKey: getPointKey(item),
  name: item?.name || '',
  objectId: item?.objectId || {},
  objectType: item?.objectId?.type,
  instanceNumber: item?.objectId?.instanceNumber,
  propertyId: item?.propertyId,
  valueType: item?.valueType,
  accessModes: item?.accessModes || ['read'],
  accessModesCheck: true,
  interval: item?.configuration?.interval ?? 3000,
  intervalCheck: true,
  features: (item?.features || []).includes('changedOnly'),
  featuresCheck: true,
})

const copySameAsPrevious = (row, previous) => {
  if (!previous) {
    return row
  }

  ;['accessModes', 'interval', 'features'].forEach((field) => {
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

const addSelectedNode = async (node) => {
  if (selectedMap.value.has(node.pointKey)) {
    return
  }
  selectedKeys.value.push(node.pointKey)
  const row = createPointRow(node)
  const previous = dataSource.value[dataSource.value.length - 1]
  selectedMap.value.set(node.pointKey, copySameAsPrevious(row, previous))
  await loadPropertyIds(row)
  syncSelectedData()
}

const removeItem = (pointKey) => {
  selectedMap.value.delete(pointKey)
  selectedKeys.value = selectedKeys.value.filter((item) => item !== pointKey)
  syncSelectedData()
}

const toggleAll = async () => {
  if (dataSource.value.length) {
    selectedMap.value = new Map()
    selectedKeys.value = []
    syncSelectedData()
    return
  }
  for (const item of treeData.value) {
    await addSelectedNode(item)
  }
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

const loadTree = async () => {
  treeLoading.value = true
  const resp = await request.post(`/data-collect/channel:${collectorData.value?.channelId}/command/GetDeviceObjects`, {
    instanceNumber: Number(collectorData.value?.configuration?.instanceNumber),
  }).finally(() => {
    treeLoading.value = false
  })
  const result = Array.isArray(resp?.result) ? resp.result : []
  treeData.value = result
    .map((item) => {
      const row = {
        ...item,
        pointKey: getPointKey(item),
      }
      return {
        ...row,
        key: row.pointKey,
        title: row.name,
      }
    })
    .filter((item) => !selectedPointKeys.value.includes(item.pointKey))
}

scanSetting.value.handleData = (rows) => rows.map((item) => ({
  name: item.name,
  provider: 'BACNetIp',
  collectorId: collectorData.value.id,
  collectorName: collectorData.value.name,
  channelId: collectorData.value.channelId,
  channelName: collectorData.value.channelName,
  pointKey: `${item.objectId?.type}:${item.objectId?.instanceNumber}:${item.propertyId}`,
  configuration: {
    interval: item.interval,
    valueType: item.valueType,
    propertyId: item.propertyId,
    objectId: item.objectId,
  },
  features: item.features ? ['changedOnly'] : [],
  accessModes: item.accessModes || [],
}))

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
    selectedKeys.value = []
    selectedMap.value = new Map()
    dataSource.value = []
    scanSetting.value.selectedData = []
    propertyIdMap.value = new Map()
    await getValueTypes()
    await loadCurrentPoints()
    await loadTree()
  },
  { immediate: true },
)

defineExpose({
  onSave: async () => tableRef.value?.validate?.(),
})
</script>

<style scoped>
.bacnet-scan {
  display: flex;
  gap: 16px;
  min-height: 560px;
}

.bacnet-scan__sidebar {
  width: 300px;
  flex: none;
}

.bacnet-scan__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.bacnet-scan__header .ant-btn {
  width: 120px;
}

.bacnet-scan__tree {
  height: 540px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  border-radius: 2px;
}

.bacnet-scan__tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 10px;
  cursor: pointer;
}

.bacnet-scan__tree-title {
  min-width: 0;
  flex: 1;
}

.bacnet-scan__tree-title.is-selected {
  color: #1677ff;
}

.bacnet-scan__content {
  min-width: 0;
  flex: 1;
}

.bacnet-scan__ditto {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bacnet-scan__grow {
  min-width: 0;
  flex: 1;
  width: 100%;
}

.bacnet-scan__empty {
  margin-top: 120px;
}
</style>
