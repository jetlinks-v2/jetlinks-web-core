<template>
  <div ref="echartsDom" class="echarts-warp"></div>
</template>

<script lang="ts" setup>
import { ref, defineProps, defineOptions, defineExpose } from 'vue'
import { useEcharts, type EchartsRenderErrorStage } from '@jetlinks-web-core/hooks'

defineOptions({
  name: 'JEcharts'
})

const props = defineProps({
  option: {
    type: Object,
    default: undefined,
  },
  library: {
    type: Array,
    default: () => [],
  }
})
const emit = defineEmits<{
  (event: 'error', error: unknown, stage: EchartsRenderErrorStage): void
}>()

const echartsDom = ref<HTMLDivElement>()
const { getDataURL } = useEcharts(echartsDom, props, {
  onError: (error, stage) => emit('error', error, stage),
})

defineExpose({ getDataURL })

</script>

<style scoped>
.echarts-warp {
  width: 100%;
  height: 100%;
}</style>
