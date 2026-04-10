import { defineComponent, ref } from "vue";
import type { CSSProperties, PropType } from "vue";
import { Modal } from 'ant-design-vue'
import { VueCropper } from 'vue-cropper';
import { useRequest } from '@jetlinks-web/hooks'
import { fileUpload } from '@jetlinks-web-core/api/comm'
import 'vue-cropper/dist/index.css'

const CropperModalProps = {
  title: {
    type: String
  },
  img: {
    type: String
  },
  width: {
    type: Number,
    default: 400
  },
  bodyStyle: {
    type: Object as PropType<CSSProperties>,
    default: () => ({})
  },
  fixedBox: {
    type: Boolean,
    default: true
  },
  autoCrop: {
    type: Boolean,
    default: true
  },
  autoCropWidth: {
    type: Number,
    default: 200
  },
  autoCropHeight: {
    type: Number,
    default: 200
  },
  outputSize: {
    type: Number,
    default: 1
  },
  outputType: {
    type: String,
    default: 'jpeg'
  },
  openServer: {
    type: Boolean,
    default: true
  },
  /** 高于 Popover(1030) 等浮层，避免裁剪弹窗被挡住 */
  zIndex: {
    type: Number,
    default: 1100
  },
  /** 禁止滚轮缩放图片，以拖动裁剪框 / 拖动图片为主 */
  canScale: {
    type: Boolean,
    default: false
  },
  canMove: {
    type: Boolean,
    default: true
  },
  canMoveBox: {
    type: Boolean,
    default: true
  },
  fixed: {
    type: Boolean,
    default: true
  },
  fixedNumber: {
    type: Array as PropType<[number, number]>,
    default: () => [1, 1] as [number, number]
  },
  centerBox: {
    type: Boolean,
    default: true
  }
}

const CropperModal = defineComponent({
  name: 'CropperModal',
  props: CropperModalProps,
  emits: ['cancel', 'ok', 'change'],
  setup( props, { emit }) {

    const { loading, run } = useRequest(fileUpload, {
      immediate: false,
      onSuccess(resp) {
        if (resp.success) {
          emit('ok', resp.result.accessUrl)
        }
      }
    })

    const cropperRef = ref()
    const imgUrl = ref()

    const onCancel = () => {
      emit('cancel')
    }

    const onOk = () => {
      cropperRef.value.getCropBlob( async (data: Blob) => {
        if (props.openServer) {
          const formData = new FormData()
          formData.append('file', data, new Date().getTime() + '.jpg')
          imgUrl.value = data
          loading.value = true
          // 上传文件
          run(formData)
        } else {
          emit('change', data)
          emit('ok', data)
        }
      })
    }

    return () => {
      const { title, width, bodyStyle, zIndex, ...cropper } = props
      return (
        <Modal
          open
          maskClosable={false}
          title={title}
          width={width}
          zIndex={zIndex}
          confirmLoading={loading.value}
          onCancel={onCancel}
          onOk={onOk}
        >
          <div
            style={{
              height: '300px',
              width: '100%',
              ...(bodyStyle || {})
            }}
            onMousedown={(e: MouseEvent) => e.stopPropagation()}
          >
            <VueCropper ref={cropperRef} {...cropper}/>
          </div>
        </Modal>
      )
    }
  }
})

export default CropperModal
