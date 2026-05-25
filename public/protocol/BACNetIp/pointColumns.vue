<script setup>
import { inject, ref } from 'vue'

const pointColumns = inject('point-extra-columns', ref([]))
pointColumns.value = [
  {
    title: '对象类型',
    dataIndex: ['configuration', 'objectId', 'type'],
    key: 'objectType',
    ellipsis: true,
    width: 140,
  },
  {
    title: '对象实例号',
    dataIndex: ['configuration', 'objectId', 'instanceNumber'],
    key: 'objectInstanceNumber',
    ellipsis: true,
    width: 140,
  },
  {
    title: '属性ID',
    dataIndex: ['configuration', 'propertyId'],
    key: 'propertyId',
    ellipsis: true,
    width: 140,
  },
  {
    title: '值类型',
    dataIndex: ['configuration', 'valueType'],
    key: 'valueType',
    ellipsis: true,
    width: 120,
  },
]
</script>
