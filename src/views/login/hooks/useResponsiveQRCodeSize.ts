import { computed, nextTick, onMounted, onUnmounted, ref, type Ref } from 'vue'

const MIN_QRCODE_SIZE = 198
const MAX_QRCODE_SIZE = 300

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const useResponsiveQRCodeSize = (containerRef: Ref<HTMLElement | null>) => {
  const qrcodeSize = ref(MIN_QRCODE_SIZE)

  const updateQRCodeSize = () => {
    if (typeof window === 'undefined') {
      return
    }

    const viewportSize = Math.min(window.innerWidth * 0.2, window.innerHeight * 0.42)
    const containerSize = containerRef.value?.clientWidth
      ? containerRef.value.clientWidth - 24
      : MAX_QRCODE_SIZE

    qrcodeSize.value = Math.round(clamp(Math.min(viewportSize, containerSize), MIN_QRCODE_SIZE, MAX_QRCODE_SIZE))
  }

  const updateQRCodeSizeAfterRender = () => {
    nextTick(updateQRCodeSize)
  }

  const qrcodeIconStyle = computed(() => {
    const size = Math.round(qrcodeSize.value * 0.3)

    return {
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: `${Math.max(12, Math.round(qrcodeSize.value * 0.06))}px`
    }
  })

  onMounted(() => {
    updateQRCodeSize()
    window.addEventListener('resize', updateQRCodeSize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateQRCodeSize)
  })

  return {
    qrcodeSize,
    qrcodeIconStyle,
    updateQRCodeSize: updateQRCodeSizeAfterRender
  }
}
