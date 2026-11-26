<template>
  <JPagination
    v-if="total > 0"
    :class="{ 'core-pagination--unknown-total': !totalKnown }"
    v-bind="{ ...$attrs, ...paginationAppearance }"
    :page-index="current - 1"
    :page-size="pageSize"
    :total="total"
    :disabled="disabled"
    :page-size-options="pageSizeOptions"
    :show-size-changer="showSizeChanger"
    :is-show-content="false"
    @change="changePage"
  />
</template>

<script setup lang="ts">
/// <reference path="./j-pagination.d.ts" />
import JPagination from '@jetlinks-web/components/es/ProTable/Pagination.js'

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, paginationAppearance } from './defaults'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  current?: number
  pageSize?: number
  total?: number
  /** 无精确总数的流式接口仍可翻页，但不能将推断的下一页边界显示为总数。 */
  totalKnown?: boolean
  pageSizeOptions?: string[]
  showSizeChanger?: boolean
  disabled?: boolean
}>(), {
  current: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalKnown: true,
  pageSizeOptions: () => [...PAGE_SIZE_OPTIONS], showSizeChanger: true,
})
const emit = defineEmits<{
  'update:current': [page: number]
  'update:pageSize': [size: number]
  change: [page: number, size: number]
}>()

function changePage(page: number, size: number) {
  // 与 JProTable 一致：换容量回首页，两个模型同步后只发一次业务 change。
  const next = size === props.pageSize ? page : 1
  if (size !== props.pageSize) emit('update:pageSize', size)
  if (next !== props.current) emit('update:current', next)
  emit('change', next, size)
}
</script>

<style scoped>
.jtable-pagination {
  flex: none;
  min-width: 0;
}
.jtable-pagination :deep(.ant-pagination) {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  row-gap: 4px;
}
.core-pagination--unknown-total :deep(.ant-pagination-total-text) {
  display: none;
}
</style>
