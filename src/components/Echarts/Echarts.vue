<template>
  <div ref="echartsDom" class="echarts-warp"></div>
</template>

<script lang="ts" setup>
import { ref, defineProps, defineOptions, defineExpose, type PropType } from 'vue'
import { useEcharts, type EchartsRenderErrorStage, type EchartsProps, type EchartsLayoutProfile, type EchartsRenderer, type EchartsEvents } from '@jetlinks-web-core/hooks/Echarts/useEcharts'
import type { ECharts } from 'echarts/core'

defineOptions({
  name: 'JEcharts'
})

const props = defineProps({
  option: {
    type: Object as PropType<EchartsProps['option']>,
    default: undefined,
  },
  library: {
    type: Array as PropType<EchartsProps['library']>,
    default: () => [],
  },
  events: { type: Object as PropType<EchartsEvents>, default: undefined },
  renderer: {
    type: String as PropType<EchartsRenderer>,
    default: 'canvas',
  },
  // Opt-in renderer policy; canonical options and ordinary page charts retain their existing semantics.
  layoutProfile: {
    type: String as PropType<EchartsLayoutProfile>,
    default: 'native',
  },
})
const emit = defineEmits<{
  (event: 'error', error: unknown, stage: EchartsRenderErrorStage): void
  (event: 'ready', instance: ECharts): void
  (event: 'dispose', instance: ECharts): void
}>()

const echartsDom = ref<HTMLDivElement>()
const { getDataURL } = useEcharts(echartsDom, props, {
  onError: (error, stage) => emit('error', error, stage),
  onReady: instance => emit('ready', instance),
  onDispose: instance => emit('dispose', instance),
})

defineExpose({ getDataURL })

</script>

<style scoped>
.echarts-warp {
  width: 100%;
  height: 100%;
}</style>
