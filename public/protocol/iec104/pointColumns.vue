<script setup>
import { inject, ref } from 'vue'

const pointColumns = inject('point-extra-columns', ref([]))
pointColumns.value = [
  {
    title: 'IOA(信息体地址)',
    dataIndex: ['configuration', 'pointAddress'],
    key: 'pointAddress',
    ellipsis: true,
    width: 160,
  },
  {
    title: '类型标识',
    dataIndex: ['configuration', 'typeIdentifierName'],
    key: 'typeIdentifierName',
    ellipsis: true,
    width: 160,
  },
]
</script>
