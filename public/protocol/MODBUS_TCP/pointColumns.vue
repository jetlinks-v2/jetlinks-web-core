<script setup>
import {inject, ref, h} from "vue";
import { Ellipsis } from '@jetlinks-web/components'

const pointColumns = inject("point-extra-columns", ref([]))
pointColumns.value = [
  {
    title: '寄存器数量',
    dataIndex: 'quantity',
    key: 'quantity',
    ellipsis: true,
    width: 150,
    scopedSlots: true,
    customRender: ({record}) => {
      return h('span', {}, `${record.configuration?.parameter?.quantity || '--'}`)
    }
  },
  {
    title: '缩放因子',
    dataIndex: 'scaleFactor',
    key: 'scaleFactor',
    scopedSlots: true,
    width: 100,
    customRender: ({record}) => {
      return h('span', {}, `${record.configuration?.codec?.configuration?.scaleFactor || '--'}`)
    }
  },
  {
    title: '小数保留位',
    dataIndex: 'scale',
    key: 'scale',
    scopedSlots: true,
    ellipsis: true,
    width: 150,
    customRender: ({record}) => {
      return h('span', {}, `${record.configuration?.codec?.configuration?.scale || '--'}`)
    }
  },
]

</script>
