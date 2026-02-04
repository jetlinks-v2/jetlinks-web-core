<script setup name="Captcha">
import { Modal, Spin } from "ant-design-vue"
import { useCaptcha } from './useCaptha'

const props = defineProps({
  config: {
    type: Object,
    default: () => ({}),
  },
  open: {
    type: Boolean,
    default: false,
  }
})

const emit = defineEmits(['success', 'fail', 'error', 'close', 'update:open'])

const components = {
  SLIDER: defineAsyncComponent(() => import('./Slider.vue')),
  WORD_CLICK: defineAsyncComponent(() => import('./WordClick.vue')),
  ROTATE: defineAsyncComponent(() => import('./Slider.vue')),
  CONCAT: defineAsyncComponent(() => import('./Concat.vue')),
}
const { captchaData, loading, error, generate, refresh, validate } = useCaptcha(computed(() => props.config))
const _open = ref(false)

const onCancel = () => {
  emit('update:open', false)
  emit('close')
}

const handleSuccess = (v) => {
  emit('success', v)
  emit('update:open', false)
}

const handleFail = (f) => {
  emit('fail', f)
}

const handleError = (err) => {
  emit('error', err)
}

watch(() => props.open, () => {
  _open.value = props.open
  if (props.open) {
    generate()
  }
}, { immediate: true })

</script>

<template>
  <Modal
    title="请完成安全验证"
    v-model:open="_open"
    :footer="null"
    :width="648"
    @cancel="onCancel"
  >
    <Spin :spinning="loading" size="large">
      <div style="height: 416px">
        <component
          v-if="captchaData && captchaData.type"
          :is="components[captchaData.type]"
          :validate="validate"
          :captchaData="captchaData"
          :type="captchaData.type"
          @success="handleSuccess"
          @fail="handleFail"
          @error="handleError"
        />
      </div>
    </Spin>
  </Modal>
</template>

<style scoped lang="less">

</style>