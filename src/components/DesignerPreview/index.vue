<template>
  <div class="ai-preview">
    <!-- {{ data }} -->
    <Preview
      :canvas="pageInfo.canvas"
      :components="pageInfo.components"
    />
  </div>
</template>

<script setup lang="ts">
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({})
  }
})
const { Preview } = moduleRegistry.getResource('visualization-designer-ui', 'components')
const { useDesignerHook } = moduleRegistry.getResource('visualization-designer-ui', 'hooks')
const { ResourceBasicComponentsInstance } = moduleRegistry.getResource('visualization-resources', 'events')
const { initPreview } = useDesignerHook()
const pageInfo = ref<any>({
  canvas: {
    width: 1920,
    height: 1080,
    scale: 0.6,
    name: '画布',
    adaptationType: 'AUTO',
    backgroundColor: '#424242',
    backgroundImage: {
      fileId: ''
    },
    gridLayout: {
      backgroundColor: '',
      marginHorizontal: 8,
      marginVertical: 8,
      borderColor: '',
      borderWidth: 1,
      borderStyle: 'solid',
      fontColor: 'rgba(0,0,0,1)'
    },
    enablePreviewZoom: false,
    filter: {
      hue: 0,
      saturation: 0,
      brightness: 0,
      contrast: 0,
      opacity: 100,
      grayscale: 0
    }
  },
  components:[]
})

onMounted(() => {
  initPreview(ResourceBasicComponentsInstance)
})

watch(
  () => props.data,
  (val) => {
    pageInfo.value = val
  },
  { deep: true, immediate: true }
)
</script>

<style lang="less" scoped>
.ai-preview {
  height: 216px;
  width: 384px;
}
</style>
