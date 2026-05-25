<script setup>
import { inject, ref, watchEffect } from 'vue'
import { useLocales } from '@hooks'

const { $lang } = useLocales('snap7')

const pointColumns = inject('point-extra-columns', ref([]))

watchEffect(() => {
  pointColumns.value = [
    {
      title: $lang('snap7.point.20250207-1'),
      name: $lang('snap7.point.20250207-1'),
      dataIndex: ['configuration', 'daveArea'],
      key: 'daveArea',
      ellipsis: true,
      width: 120,
    },
    {
      title: $lang('snap7.point.20250207-3'),
      name: $lang('snap7.point.20250207-3'),
      dataIndex: ['configuration', 'areaNumber'],
      key: 'areaNumber',
      ellipsis: true,
      width: 120,
    },
    {
      title: $lang('snap7.point.20250207-5'),
      name: $lang('snap7.point.20250207-5'),
      dataIndex: ['configuration', 'type'],
      key: 'type',
      ellipsis: true,
      width: 120,
    },
    {
      title: $lang('snap7.point.20250207-13'),
      name: $lang('snap7.point.20250207-13'),
      dataIndex: ['configuration', 'offset'],
      key: 'offset',
      ellipsis: true,
      width: 120,
    },
    {
      title: $lang('snap7.point.20250207-10'),
      name: $lang('snap7.point.20250207-10'),
      dataIndex: ['configuration', 'bits'],
      key: 'bits',
      ellipsis: true,
      width: 140,
    },
    {
      title: $lang('snap7.point.20250207-7'),
      name: $lang('snap7.point.20250207-7'),
      dataIndex: ['configuration', 'bytes'],
      key: 'bytes',
      ellipsis: true,
      width: 160,
    },
    {
      title: $lang('snap7.point.20250207-16'),
      name: $lang('snap7.point.20250207-16'),
      dataIndex: ['managedConfiguration', 'converter', 'configuration', 'factor'],
      key: 'factor',
      ellipsis: true,
      width: 120,
    },
    {
      title: $lang('snap7.point.20250207-18'),
      name: $lang('snap7.point.20250207-18'),
      dataIndex: ['managedConfiguration', 'converter', 'configuration', 'scale'],
      key: 'scale',
      ellipsis: true,
      width: 120,
    },
  ]
})
</script>
