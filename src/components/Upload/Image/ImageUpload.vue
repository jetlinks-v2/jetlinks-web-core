<template>
  <div
    class="upload-image-warp"
    @click.stop
    @mousedown.stop
    @mouseup.stop
  >
    <div class="upload-image-border" :style="borderStyle">
      <a-upload
        list-type="picture-card"
        class="avatar-uploader"
        :name="name || 'file'"
        :accept="accept"
        :show-upload-list="false"
        :beforeUpload="beforeUpload"
        :custom-request="uploadByRequest"
        @change="handleChange"
      >
        <div class="upload-image-content" :style="style">
          <slot name="content" :imageUrl="imageUrl" :loading="loading">
            <template v-if="imageUrl">
              <img :src="imageUrl" width="100%" class="upload-image" />
              <div class="upload-image-mask">{{ $t('Image.ImageUpload.825077-0') }}</div>
            </template>
            <AIcon
              v-else
              type="PlusOutlined"
              style="font-size: var(--fs-20)"
            />
          </slot>
        </div>
      </a-upload>
      <div class="upload-loading-mask" v-if="disabled"></div>
      <div class="upload-loading-mask" v-if="imageUrl && loading">
        <AIcon type="LoadingOutlined" style="font-size: var(--fs-20)" />
      </div>
    </div>
  </div>
  <Teleport to="body">
    <CropperModal
      v-if="cropper.visible"
      v-bind="mergedCropperProps"
      :img="cropper.img"
      :title="cropperTitle"
      @cancel="handleCropCancel"
      @ok="saveImage"
      @processing-change="handleCropProcessingChange"
    />
  </Teleport>
</template>

<script setup lang="ts" name="ImageUpload">
import { onlyMessage, getBase64ByImg } from "@jetlinks-web/utils";
import type { CSSProperties, PropType } from "vue";
import type { UploadChangeParam } from 'ant-design-vue';
import CropperModal from "./CropperModal";
import { useI18n } from "vue-i18n";
import i18n from "@jetlinks-web-core/locales";
import { uploadByRequest } from '../utils'

const { t: $t } = useI18n();
const props = defineProps({
  value: {
    type: String,
    default: undefined
  },
  size: {
    type: Number,
    default: 2
  },
  types: {
    type: Array as PropType<Array<string>>,
    default: ['image/jpeg', 'image/png']
  },
  disabled: {
    type: Boolean,
    default: false
  },
  accept:{
    type: String,
    default: undefined
  },
  name: {
    type: String,
    default: 'file'
  },
  style: {
    type: Object as PropType<CSSProperties>,
    default: () => ({})
  },
  borderStyle: {
    type: Object as PropType<CSSProperties>,
    default: () => ({})
  },
  cropperStyle: {
    type: Object as PropType<CSSProperties>,
    default: () => ({})
  },
  cropperTitle: {
    type: String,
    default: i18n.global.t('Image.ImageUpload.825077-1')
  },
  cropperProps: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits<{
  'update:value': [v: string]
  cropVisibleChange: [visible: boolean]
  cropInteractBusy: [busy: boolean]
}>()

const cropper = reactive({
  visible: false,
  img: ''
})
const loading = ref(false) // 上传图片状态
const imageUrl = ref<string | undefined >('')

const mergedCropperProps = computed(() => ({
  zIndex: 200000,
  ...(props.cropperProps || {})
}))

const beforeUpload = (file: any) => {
  const types = (props.types || []) as Array<string>
  const inType = types.includes(file.type)
  const maxSize = (props.size || 2) as number // 文件最大多少兆
  const isMaxSize = (file.size / 1024 / 1024) < maxSize

  if (!inType) {
    onlyMessage($t('Image.ImageUpload.825077-2'), 'error')
    return false
  }

  if (!isMaxSize) {
    onlyMessage($t('Image.ImageUpload.825077-3', [maxSize]), 'error')
    return false
  }

  emit('cropInteractBusy', true)
  getBase64ByImg(file, (base64Url) => {
    cropper.img = base64Url
    cropper.visible = true
    emit('cropInteractBusy', false)
  })

  return false
}

const handleChange = (info: UploadChangeParam) => {
  if (info.file.status === 'uploading') {
    loading.value = true;
  }
  if (info.file.status === 'done') {
    imageUrl.value = info.file.response?.result.accessUrl;
    loading.value = false;
    emit('update:value', info.file.response?.result.accessUrl);
  }
  if (info.file.status === 'error') {
    loading.value = false;
    onlyMessage($t('Image.ImageUpload.825077-4'), 'error');
  }
}

const saveImage = (url: string) => {
  imageUrl.value = url
  emit('update:value', url);
  nextTick(() => {
    cropper.visible = false
    emit('cropInteractBusy', false)
  })
}

watch(() => props.value, (newValue) => {
  imageUrl.value = newValue as string
}, {
  immediate: true
})

watch(
  () => cropper.visible,
  (v) => {
    emit('cropVisibleChange', v)
  },
)

function abortCrop() {
  cropper.visible = false
  cropper.img = ''
  emit('cropInteractBusy', false)
}

defineExpose({ abortCrop })

function handleCropCancel() {
  cropper.visible = false
  emit('cropInteractBusy', false)
}

function handleCropProcessingChange(busy: boolean) {
  emit('cropInteractBusy', busy)
}

</script>

<style scoped>
.upload-image-warp {
  display: flex;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
}
.upload-image-warp .upload-image-border {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  transition: all 0.3s;
  border: 1px dashed var(--jet-theme-primary, var(--accent));
}
.upload-image-warp .upload-image-border:hover {
  border-color: var(--jet-theme-primary-hover);
}
.upload-image-warp .upload-image-border :deep(.ant-upload-picture-card-wrapper) {
  width: 100%;
  height: 100%;
}
.upload-image-warp .upload-image-border :deep(.ant-upload) {
  width: 100%;
  height: 100%;
}
.upload-image-warp .upload-image-border .upload-image-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: color-mix(in srgb, var(--ink-1) 6%, transparent);
  cursor: pointer;
  padding: var(--space-2);
}
.upload-image-warp .upload-image-border .upload-image-content .upload-image-mask {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  width: 100%;
  height: 100%;
  color: var(--accent-ink);
  font-size: var(--fs-16);
  align-items: center;
  justify-content: center;
  background-color: color-mix(in srgb, var(--ink-1) 25%, transparent);
}
.upload-image-warp .upload-image-border .upload-image-content .upload-image {
  width: 100%;
  height: 100%;
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
}
.upload-image-warp .upload-image-border .upload-image-content:hover .upload-image-mask {
  display: flex;
}
.upload-image-warp .upload-loading-mask {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--accent-ink);
  background-color: color-mix(in srgb, var(--ink-1) 25%, transparent);
}</style>
