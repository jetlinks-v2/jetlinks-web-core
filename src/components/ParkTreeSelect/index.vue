<template>
  <a-tree-select
    v-model:value="innerValue"
    class="park-tree-select"
    :tree-data="parkTreeData"
    :loading="mergedLoading"
    :allow-clear="allowClear"
    :show-search="showSearch"
    :tree-default-expand-all="treeDefaultExpandAll"
    :field-names="fieldNames"
    :filter-tree-node="filterParkTreeNode"
    :placeholder="currentPlaceholder"
    v-bind="$attrs"
    @change="handleChange"
  />
</template>

<script setup lang="ts">
import { request } from '@jetlinks-web/core'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ParkTreeModelValue, ParkTreeNode, RawParkTreeNode } from './types'

type BasicResponse<T> = {
  result?: T
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  value?: ParkTreeModelValue
  placeholder?: string
  api?: string
  immediate?: boolean
  allowClear?: boolean
  showSearch?: boolean
  treeDefaultExpandAll?: boolean
  loading?: boolean
}>(), {
  api: '/user/park/tree/current',
  immediate: true,
  allowClear: true,
  showSearch: true,
  treeDefaultExpandAll: true,
  loading: false,
})

const emit = defineEmits<{
  (e: 'update:value', value: ParkTreeModelValue): void
  (e: 'change', value: ParkTreeModelValue, label: unknown, extra: unknown, selected: ParkTreeNode | ParkTreeNode[] | undefined): void
  (e: 'loaded', options: ParkTreeNode[], rawTree: RawParkTreeNode[]): void
  (e: 'error', error: unknown): void
}>()

defineOptions({
  name: 'ParkTreeSelect',
  inheritAttrs: false,
})

const { t } = useI18n()
const loadingParks = ref(false)
const rawTree = ref<RawParkTreeNode[]>([])
const parkTreeData = ref<ParkTreeNode[]>([])
const parkMap = ref(new Map<string, ParkTreeNode>())

const fieldNames = { label: 'title', value: 'value', children: 'children' }

const innerValue = computed({
  get: () => props.value,
  set: value => emit('update:value', value),
})

const mergedLoading = computed(() => props.loading || loadingParks.value)
const currentPlaceholder = computed(() => props.placeholder || t('components.ParkTreeSelect.placeholder'))

const unwrapResult = <T,>(response: BasicResponse<T> | T): T => {
  if (response && typeof response === 'object' && 'result' in response) {
    return (response as BasicResponse<T>).result as T
  }

  return response as T
}

const getParkValue = (node: RawParkTreeNode) => String(node.parkId || node.id || node.key || '')

const createGroupValue = (node: RawParkTreeNode, path: string) => {
  const value = String(node.id || node.orgId || node.key || node.name || path)
  return `org:${value || path}`
}

const collectParkMap = (nodes: ParkTreeNode[], map = new Map<string, ParkTreeNode>()) => {
  nodes.forEach((node) => {
    if (node.selectable) {
      map.set(node.value, node)
    }

    if (node.children?.length) {
      collectParkMap(node.children, map)
    }
  })

  return map
}

const mapParkTreeData = (nodes: RawParkTreeNode[] = [], path = ''): ParkTreeNode[] => (
  nodes
    .map((node, index) => {
      const isPark = node.type === 'park'
      const value = isPark ? getParkValue(node) : createGroupValue(node, `${path}${index}`)
      const children = isPark ? undefined : mapParkTreeData(node.children || [], `${value}-`)

      if (isPark && !value) {
        return undefined
      }

      if (!isPark && !children?.length) {
        return undefined
      }

      return {
        title: String(node.name || value),
        value,
        key: value,
        selectable: isPark,
        disabled: !isPark,
        type: node.type,
        raw: node,
        children,
      }
    })
    .filter(Boolean) as ParkTreeNode[]
)

const findSelectedPark = (value: ParkTreeModelValue) => {
  if (Array.isArray(value)) {
    return value
      .map(item => parkMap.value.get(String(item)))
      .filter(Boolean) as ParkTreeNode[]
  }

  return value === undefined || value === null ? undefined : parkMap.value.get(String(value))
}

const filterParkTreeNode = (input: string, node: { title?: unknown }) =>
  String(node.title || '').toLowerCase().includes(input.toLowerCase())

const loadParkOptions = async () => {
  loadingParks.value = true
  try {
    // 当前用户园区树包含组织分组和园区节点，表单只能选择 park 节点，组织节点仅用于分组展示。
    const response = await request.get(props.api)
    const nodes = unwrapResult<RawParkTreeNode[]>(response)
    rawTree.value = Array.isArray(nodes) ? nodes : []
    parkTreeData.value = mapParkTreeData(rawTree.value)
    parkMap.value = collectParkMap(parkTreeData.value)
    emit('loaded', parkTreeData.value, rawTree.value)
  } catch (error) {
    rawTree.value = []
    parkTreeData.value = []
    parkMap.value = new Map()
    emit('error', error)
  } finally {
    loadingParks.value = false
  }
}

const handleChange = (value: ParkTreeModelValue, label: unknown, extra: unknown) => {
  emit('change', value, label, extra, findSelectedPark(value))
}

watch(() => props.api, () => {
  if (props.immediate) {
    loadParkOptions()
  }
})

onMounted(() => {
  if (props.immediate) {
    loadParkOptions()
  }
})

defineExpose({
  loadParkOptions,
  parkTreeData,
  rawTree,
})
</script>

<style scoped lang="less">
.park-tree-select {
  width: 100%;
}
</style>
