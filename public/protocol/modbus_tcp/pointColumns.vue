<script setup>
import {inject, ref} from "vue";

const pointColumns = inject("point-extra-columns", ref([]))
pointColumns.value = [
  {
    title: '寄存器数量',
    dataIndex: '11',
    key: '11',
    ellipsis: true,
    scopedSlots: true,
    width: 100
  },
  {
    title: '缩放因子',
    dataIndex: '22',
    key: '22',
    scopedSlots: true,
    width: 200,
  },
  {
    title: '小数保留位',
    dataIndex: '33',
    key: '33',
    scopedSlots: true,
    ellipsis: true,
    width: 100
  },
]

</script>

<template>
  <div>哈哈哈哈哈哈哈</div>
</template>
