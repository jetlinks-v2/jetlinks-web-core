<script setup>
import {inject, ref} from "vue";

const pointColumns = inject("point-extra-columns", ref([]))
pointColumns.value = [
  {
    title: '缩放因子',
    dataIndex: ['managedConfiguration', 'converter', 'configuration', 'factor'],
    key: 'factor',
    // scopedSlots: true,
    width: 200,
  },
  {
    title: '小数保留位',
    dataIndex: ['managedConfiguration', 'converter', 'configuration', 'scale'],
    key: 'scale',
    // scopedSlots: true,
    ellipsis: true,
    width: 100,
  },
]
</script>
